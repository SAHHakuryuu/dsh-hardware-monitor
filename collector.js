/**
 * Host-side hardware sampler for the hardware-monitor bundle.
 *
 * Only Node built-ins are used so the bundle needs no install step and no
 * dependency on the Harness package tree. Slow probes (disk, network counters,
 * GPU) run at their own cadence and are cached between CPU samples.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'

const DISK_EVERY = 5
const GPU_EVERY = 10
const DISK_PATH = process.platform === 'win32'
  ? (path.parse(process.cwd()).root || 'C:\\')
  : '/'

function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function cpuTimes() {
  return os.cpus().map((cpu) => {
    const t = cpu.times
    return {
      idle: t.idle,
      total: t.user + t.nice + t.sys + t.idle + t.irq,
    }
  })
}

function cpuDelta(prev, next) {
  const perCore = []
  let idle = 0
  let total = 0
  const count = Math.min(prev.length, next.length)
  for (let i = 0; i < count; i += 1) {
    const dTotal = next[i].total - prev[i].total
    const dIdle = next[i].idle - prev[i].idle
    perCore.push(dTotal > 0 ? clamp01(1 - dIdle / dTotal) : 0)
    if (dTotal > 0) {
      total += dTotal
      idle += Math.max(0, dIdle)
    }
  }
  return { usage: total > 0 ? clamp01(1 - idle / total) : 0, perCore }
}

function readDisk() {
  try {
    const stat = fs.statfsSync(DISK_PATH)
    const total = stat.blocks * stat.bsize
    const free = stat.bavail * stat.bsize
    if (!Number.isFinite(total) || total <= 0) return null
    const used = Math.max(0, total - free)
    return { mount: DISK_PATH, total, used, free, usage: clamp01(used / total) }
  } catch {
    return null
  }
}

function parseLinuxNet(text) {
  let rx = 0
  let tx = 0
  for (const line of text.split('\n')) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const fields = line.slice(colon + 1).trim().split(/\s+/)
    if (fields.length < 9) continue
    rx += Number(fields[0]) || 0
    tx += Number(fields[8]) || 0
  }
  return { rx, tx }
}

function parseMacNet(text) {
  let rx = 0
  let tx = 0
  for (const line of text.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 10 || fields[0] === 'lo0' || fields[0] === 'Name') continue
    rx += Number(fields[6]) || 0
    tx += Number(fields[9]) || 0
  }
  return { rx, tx }
}

function parseWindowsNet(text) {
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length !== 3) continue
    if (!/^\d+$/.test(fields[1]) || !/^\d+$/.test(fields[2])) continue
    return { rx: Number(fields[1]), tx: Number(fields[2]) }
  }
  return null
}

function runFile(file, args, timeout) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    try {
      const child = execFile(
        file,
        args,
        { windowsHide: true, timeout, maxBuffer: 1024 * 1024 },
        (error, stdout) => finish(error ? null : stdout),
      )
      child.on('error', () => finish(null))
    } catch {
      // A sandbox that forbids extra pipes can refuse the spawn synchronously.
      finish(null)
    }
  })
}

function readNetTotals() {
  if (process.platform === 'linux') {
    return new Promise((resolve) => {
      fs.readFile('/proc/net/dev', 'utf8', (error, text) => {
        resolve(error ? null : parseLinuxNet(text))
      })
    })
  }
  if (process.platform === 'darwin') {
    return runFile('netstat', ['-ib'], 2500).then((stdout) => (stdout ? parseMacNet(stdout) : null))
  }
  return runFile('netstat', ['-e'], 2500).then((stdout) => (stdout ? parseWindowsNet(stdout) : null))
}

function readGpu() {
  return runFile(
    'nvidia-smi',
    [
      '--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu',
      '--format=csv,noheader,nounits',
    ],
    3000,
  ).then((stdout) => {
    if (!stdout) return null
    const line = stdout.split(/\r?\n/).find((item) => item.trim().length > 0)
    if (!line) return null
    const [name, util, memUsed, memTotal, temp] = line.split(',').map((item) => item.trim())
    const usage = Number(util)
    return {
      name: name || 'GPU',
      usage: Number.isFinite(usage) ? clamp01(usage / 100) : 0,
      memUsed: Number(memUsed) || 0,
      memTotal: Number(memTotal) || 0,
      temp: Number.isFinite(Number(temp)) ? Math.round(Number(temp)) : null,
    }
  })
}

function hostInfo() {
  const cpus = os.cpus()
  return {
    name: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model?.trim() || 'CPU',
    cores: cpus.length,
    speedMHz: cpus[0]?.speed || 0,
  }
}

/**
 * Start one sampler. No timer or child process runs until the first subscriber
 * arrives, and everything stops again when the last subscriber leaves.
 */
export function startCollector(options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs >= 250
    ? Math.round(options.intervalMs)
    : 1000
  const listeners = new Set()
  const host = hostInfo()
  let timer = null
  let kickoff = null
  let prevCpu = null
  let disk = null
  let netTotals = null
  let netAt = 0
  let netRate = null
  let gpu = null
  let gpuGone = false
  let latest = null
  let tick = 0

  function publish(snapshot) {
    latest = snapshot
    const frame = JSON.stringify(snapshot)
    for (const listener of [...listeners]) {
      try {
        listener(frame)
      } catch {
        listeners.delete(listener)
      }
    }
  }

  async function refreshDisk() {
    const next = readDisk()
    if (next) disk = next
  }

  async function refreshNet() {
    const totals = await readNetTotals()
    const now = Date.now()
    if (!totals) return
    if (netTotals && netAt > 0) {
      const seconds = (now - netAt) / 1000
      if (seconds > 0.2) {
        netRate = {
          rxPerSec: Math.max(0, totals.rx - netTotals.rx) / seconds,
          txPerSec: Math.max(0, totals.tx - netTotals.tx) / seconds,
        }
      }
    }
    netTotals = totals
    netAt = now
  }

  async function refreshGpu() {
    if (gpuGone) return
    const next = await readGpu()
    if (next) gpu = next
    else gpuGone = true
  }

  function sample() {
    tick += 1
    const nextCpu = cpuTimes()
    const cpu = prevCpu ? cpuDelta(prevCpu, nextCpu) : { usage: 0, perCore: [] }
    prevCpu = nextCpu

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = Math.max(0, totalMem - freeMem)
    const app = process.memoryUsage()
    const load = os.loadavg()

    publish({
      ts: Date.now(),
      host,
      uptimeSec: Math.round(os.uptime()),
      cpu: {
        usage: cpu.usage,
        perCore: cpu.perCore,
        speedMHz: host.speedMHz,
        load: [load[0], load[1], load[2]],
      },
      mem: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usage: clamp01(usedMem / totalMem),
      },
      disk,
      net: netTotals
        ? {
            rxTotal: netTotals.rx,
            txTotal: netTotals.tx,
            rxPerSec: netRate ? netRate.rxPerSec : 0,
            txPerSec: netRate ? netRate.txPerSec : 0,
          }
        : null,
      gpu,
      app: { rss: app.rss, heapUsed: app.heapUsed },
    })

    if (tick % DISK_EVERY === 0) void refreshDisk().catch(() => {})
    if (tick % DISK_EVERY === 0) void refreshNet().catch(() => {})
    if (tick % GPU_EVERY === 0) void refreshGpu().catch(() => {})
  }

  function start() {
    if (timer || kickoff) return
    latest = null
    prevCpu = cpuTimes()
    tick = 0
    disk = readDisk()
    gpuGone = false
    gpu = null
    netTotals = null
    netAt = 0
    netRate = null
    void refreshNet().catch(() => {})
    void refreshGpu().catch(() => {})
    kickoff = setTimeout(() => {
      kickoff = null
      sample()
      timer = setInterval(sample, intervalMs)
    }, 300)
  }

  function stop() {
    if (kickoff) {
      clearTimeout(kickoff)
      kickoff = null
    }
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    latest = null
    prevCpu = null
    disk = null
    netTotals = null
    netRate = null
    gpu = null
    netAt = 0
  }

  function subscribe(listener) {
    listeners.add(listener)
    start()
    if (latest) {
      try {
        listener(JSON.stringify(latest))
      } catch {
        listeners.delete(listener)
      }
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) stop()
    }
  }

  return {
    subscribe,
    stop() {
      listeners.clear()
      stop()
    },
    get subscriberCount() {
      return listeners.size
    },
  }
}
