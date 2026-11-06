import { apply } from '../index.js'

const disposers = []
let route
let rejectWith

const ctx = {
  effect(fn) {
    const dispose = fn()
    disposers.push(dispose)
    return dispose
  },
  webServer: {
    register(registration) {
      route = registration
      return () => {}
    },
  },
  connection: {
    requestRejection: () => rejectWith,
  },
}

apply(ctx, { intervalMs: 500 })

if (!route || route.path !== '/hardware-monitor/stream' || route.kind !== 'exact') {
  console.error('route registration failed', route)
  process.exit(1)
}

rejectWith = 401
const denied = route.resource(new Request('http://localhost/hardware-monitor/stream'))
console.log('denied status:', denied.status)
if (denied.status !== 401) process.exit(1)

rejectWith = undefined
const controller = new AbortController()
const response = route.resource(
  new Request('http://localhost/hardware-monitor/stream', { signal: controller.signal }),
)
console.log('stream status:', response.status)
console.log('content-type:', response.headers.get('content-type'))
if (response.status !== 200) process.exit(1)

const reader = response.body.getReader()
const decoder = new TextDecoder()
let text = ''
const deadline = Date.now() + 6000
while (Date.now() < deadline) {
  const { value, done } = await reader.read()
  if (done) break
  text += decoder.decode(value, { stream: true })
  const frames = text.split('\n\n').filter((part) => part.trim().length > 0)
  if (frames.length >= 2) break
}

const frames = text.split('\n\n').filter((part) => part.trim().length > 0)
console.log('frames received:', frames.length)
if (frames.length < 2) {
  console.error('not enough frames')
  process.exit(1)
}

const first = JSON.parse(frames[0].replace(/^data: /, ''))
const second = JSON.parse(frames[1].replace(/^data: /, ''))
console.log('sample keys:', Object.keys(first).join(','))
console.log('cpu usage:', second.cpu.usage, 'cores:', second.cpu.perCore.length)
console.log('memory usage:', second.mem.usage)
console.log('disk:', second.disk ? `${second.disk.mount} ${Math.round(second.disk.usage * 100)}%` : null)
console.log('net:', second.net ? `${Math.round(second.net.rxPerSec)} B/s down` : null)
console.log('gpu:', second.gpu ? `${second.gpu.name} ${second.gpu.temp}C ${Math.round(second.gpu.usage * 100)}%` : null)

controller.abort()
await new Promise((resolve) => setTimeout(resolve, 100))
for (const dispose of disposers.reverse()) {
  try {
    await dispose()
  } catch {
    // ignore cleanup noise
  }
}
console.log('ok')
process.exit(0)
