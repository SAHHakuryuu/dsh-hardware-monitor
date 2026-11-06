window.__ModuleLoader__.load({
  id: '@local/hardware-monitor',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React

    const NS = 'hardware.monitor'
    const STREAM_URL = '/hardware-monitor/stream'

    const EN = {
      title: 'Hardware monitor',
      detail: 'Details',
      hide: 'Hide',
      cpu: 'CPU',
      memory: 'Memory',
      disk: 'Disk',
      network: 'Network',
      gpu: 'GPU',
      cores: 'cores',
      core: 'Core',
      load: 'Load',
      used: 'Used',
      free: 'Free',
      total: 'Total',
      received: 'Received',
      sent: 'Sent',
      vram: 'VRAM',
      appMemory: 'App RSS',
      uptime: 'Uptime',
      host: 'Host',
      live: 'Live',
      connecting: 'Connecting',
      reconnecting: 'Reconnecting',
      panelNote: 'Sampled on the Host every second',
    }

    const ZH = {
      title: '硬件实时监测',
      detail: '详情',
      hide: '收起',
      cpu: 'CPU',
      memory: '内存',
      disk: '磁盘',
      network: '网络',
      gpu: 'GPU',
      cores: '核心',
      core: '核心',
      load: '负载',
      used: '已用',
      free: '空闲',
      total: '总计',
      received: '累计接收',
      sent: '累计发送',
      vram: '显存',
      appMemory: '应用内存',
      uptime: '运行时长',
      host: '主机',
      live: '实时',
      connecting: '连接中',
      reconnecting: '重连中',
      panelNote: '由 Host 每秒采样',
    }

    const CSS = `
      .dsh-hwm-root { display: flex; flex-direction: column; gap: 6px; width: 100%; font-size: 11.5px; line-height: 1.45; }
      .dsh-hwm-strip {
        display: flex; align-items: center; gap: 12px; width: 100%;
        padding: 5px 10px; border: 0; border-radius: 8px; background: transparent;
        color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer;
        transition: background 140ms ease;
      }
      .dsh-hwm-strip:hover { background: var(--dsw-alias-bg-layer-2); }
      .dsh-hwm-strip:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .dsh-hwm-metric { display: inline-flex; align-items: center; gap: 5px; min-width: 0; white-space: nowrap; }
      .dsh-hwm-label { color: var(--dsw-alias-label-secondary); font-weight: 600; letter-spacing: .02em; }
      .dsh-hwm-value { font-variant-numeric: tabular-nums; font-weight: 600; }
      .dsh-hwm-soft { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dsh-hwm-spark { display: block; color: var(--dsw-alias-brand-primary); opacity: .85; }
      .dsh-hwm-divider { width: 1px; height: 12px; background: var(--dsw-alias-border-l1); flex: none; }
      .dsh-hwm-spacer { flex: 1 1 auto; }
      .dsh-hwm-more { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .dsh-hwm-chevron { transition: transform 140ms ease; }
      .dsh-hwm-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; background: var(--dsw-alias-state-idle-primary); }
      .dsh-hwm-dot--live { background: var(--dsw-alias-state-success-primary); }
      .dsh-hwm-dot--reconnecting { background: var(--dsw-alias-state-warn-primary); animation: dsh-hwm-pulse 1.4s ease-in-out infinite; }
      .dsh-hwm-panel {
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1); padding: 12px 14px 10px;
      }
      .dsh-hwm-panel--empty { color: var(--dsw-alias-label-secondary); }
      .dsh-hwm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 22px; }
      .dsh-hwm-sec { min-width: 0; }
      .dsh-hwm-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
      .dsh-hwm-sec-title { font-size: 10.5px; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
      .dsh-hwm-sec-value { font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .dsh-hwm-bar { height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
      .dsh-hwm-bar > span { display: block; height: 100%; border-radius: 3px; transition: width 420ms ease, background 240ms ease; }
      .dsh-hwm-sub { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 10px; margin-top: 5px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dsh-hwm-cores { display: flex; align-items: flex-end; gap: 2px; height: 20px; margin-top: 7px; }
      .dsh-hwm-core { position: relative; flex: 1 1 0; min-width: 2px; max-width: 12px; height: 100%; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
      .dsh-hwm-core > span { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 2px; transition: height 420ms ease, background 240ms ease; }
      .dsh-hwm-note { margin-top: 5px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dsh-hwm-meta { display: flex; flex-wrap: wrap; gap: 3px 16px; margin-top: 11px; padding-top: 9px; border-top: 1px solid var(--dsw-alias-border-l1); font-size: 10.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      @keyframes dsh-hwm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
      @media (max-width: 640px) {
        .dsh-hwm-strip { gap: 8px; }
        .dsh-hwm-spark { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dsh-hwm-strip, .dsh-hwm-bar > span, .dsh-hwm-core > span, .dsh-hwm-chevron { transition: none; }
        .dsh-hwm-dot--reconnecting { animation: none; }
      }
    `

    function clampPercent(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return 0
      return Math.min(1, Math.max(0, n))
    }

    function pct(value) {
      return `${Math.round(clampPercent(value) * 100)}%`
    }

    function bytes(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
      let scaled = n
      let index = 0
      while (scaled >= 1024 && index < units.length - 1) {
        scaled /= 1024
        index += 1
      }
      return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[index]}`
    }

    function rate(value) {
      return `${bytes(value)}/s`
    }

    function uptime(seconds) {
      const total = Number(seconds) || 0
      const days = Math.floor(total / 86400)
      const hours = Math.floor((total % 86400) / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      if (days > 0) return `${days}d ${hours}h`
      if (hours > 0) return `${hours}h ${minutes}m`
      return `${minutes}m`
    }

    function platformName(platform) {
      if (platform === 'win32') return 'Windows'
      if (platform === 'darwin') return 'macOS'
      if (platform === 'linux') return 'Linux'
      return platform || ''
    }

    function tone(value) {
      const n = clampPercent(value)
      if (n >= 0.9) return 'var(--dsw-alias-state-error-primary)'
      if (n >= 0.7) return 'var(--dsw-alias-state-warn-primary)'
      return 'var(--dsw-alias-brand-primary)'
    }

    function Spark({ values, width = 52, height = 16 }) {
      const points = values.length > 0 ? values : [0]
      const step = points.length > 1 ? width / (points.length - 1) : width
      const path = points
        .map((value, index) => `${(index * step).toFixed(1)},${(height - clampPercent(value) * height).toFixed(1)}`)
        .join(' ')
      return h(
        'svg',
        {
          className: 'dsh-hwm-spark',
          width,
          height,
          viewBox: `0 0 ${width} ${height}`,
          'aria-hidden': true,
          focusable: 'false',
        },
        h('polyline', {
          points: path,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }),
      )
    }

    function metric(label, value, extra) {
      return h(
        'span',
        { className: 'dsh-hwm-metric' },
        h('span', { className: 'dsh-hwm-label' }, label),
        h('span', { className: 'dsh-hwm-value' }, value),
        extra || null,
      )
    }

    function head(title, value) {
      return h(
        'div',
        { className: 'dsh-hwm-sec-head' },
        h('span', { className: 'dsh-hwm-sec-title' }, title),
        h('span', { className: 'dsh-hwm-sec-value' }, value),
      )
    }

    function bar(frac, color) {
      return h(
        'div',
        { className: 'dsh-hwm-bar' },
        h('span', { style: { width: `${clampPercent(frac) * 100}%`, background: color || 'var(--dsw-alias-brand-primary)' } }),
      )
    }

    function sub(left, right) {
      return h(
        'div',
        { className: 'dsh-hwm-sub' },
        h('span', null, left),
        right ? h('span', null, right) : null,
      )
    }

    function Panel({ t, snapshot }) {
      if (!snapshot) {
        return h('div', { className: 'dsh-hwm-panel dsh-hwm-panel--empty' }, `${t('connecting')}…`)
      }
      const cpu = snapshot.cpu || {}
      const mem = snapshot.mem || {}
      const disk = snapshot.disk
      const net = snapshot.net
      const gpu = snapshot.gpu
      const host = snapshot.host || {}
      const app = snapshot.app || {}
      const perCore = Array.isArray(cpu.perCore) ? cpu.perCore : []
      const load = Array.isArray(cpu.load) ? cpu.load : []
      const loadText = load.some((value) => value > 0)
        ? ` · ${t('load')} ${load.map((value) => Number(value).toFixed(2)).join(' ')}`
        : ''

      return h(
        'div',
        { className: 'dsh-hwm-panel' },
        h(
          'div',
          { className: 'dsh-hwm-grid' },
          h(
            'section',
            { className: 'dsh-hwm-sec' },
            head(t('cpu'), pct(cpu.usage)),
            bar(cpu.usage, tone(cpu.usage)),
            sub(`${perCore.length || host.cores || 0} ${t('cores')}${loadText}`),
            perCore.length > 0
              ? h(
                  'div',
                  { className: 'dsh-hwm-cores' },
                  perCore.map((usage, index) =>
                    h(
                      'div',
                      {
                        className: 'dsh-hwm-core',
                        key: index,
                        title: `${t('core')} ${index + 1} · ${pct(usage)}`,
                      },
                      h('span', { style: { height: `${Math.max(3, clampPercent(usage) * 100)}%`, background: tone(usage) } }),
                    ),
                  ),
                )
              : null,
            h('div', { className: 'dsh-hwm-note' }, host.cpuModel || ''),
          ),
          h(
            'section',
            { className: 'dsh-hwm-sec' },
            head(t('memory'), pct(mem.usage)),
            bar(mem.usage, tone(mem.usage)),
            sub(
              `${t('used')} ${bytes(mem.used)} / ${bytes(mem.total)}`,
              `${t('appMemory')} ${bytes(app.rss)}`,
            ),
          ),
          disk
            ? h(
                'section',
                { className: 'dsh-hwm-sec' },
                head(t('disk'), pct(disk.usage)),
                bar(disk.usage, tone(disk.usage)),
                sub(`${t('used')} ${bytes(disk.used)} / ${bytes(disk.total)}`, `${t('free')} ${bytes(disk.free)}`),
                h('div', { className: 'dsh-hwm-note' }, disk.mount || ''),
              )
            : h(
                'section',
                { className: 'dsh-hwm-sec' },
                head(t('disk'), '—'),
                sub(t('free'), '—'),
              ),
          net
            ? h(
                'section',
                { className: 'dsh-hwm-sec' },
                head(t('network'), `↓ ${rate(net.rxPerSec)}`),
                sub(`↑ ${rate(net.txPerSec)}`),
                h(
                  'div',
                  { className: 'dsh-hwm-note' },
                  `${t('received')} ${bytes(net.rxTotal)} · ${t('sent')} ${bytes(net.txTotal)}`,
                ),
              )
            : h(
                'section',
                { className: 'dsh-hwm-sec' },
                head(t('network'), '—'),
                sub(t('received'), '—'),
              ),
          gpu
            ? h(
                'section',
                { className: 'dsh-hwm-sec' },
                head(t('gpu'), pct(gpu.usage)),
                bar(gpu.usage, tone(gpu.usage)),
                sub(
                  `${t('vram')} ${bytes(gpu.memUsed)} / ${bytes(gpu.memTotal)}`,
                  Number.isFinite(gpu.temp) ? `${gpu.temp} °C` : '',
                ),
                h('div', { className: 'dsh-hwm-note' }, gpu.name || ''),
              )
            : null,
        ),
        h(
          'div',
          { className: 'dsh-hwm-meta' },
          h('span', null, `${t('host')} ${host.name || '—'}`),
          h('span', null, `${platformName(host.platform)} ${host.release || ''}`.trim()),
          h('span', null, `${t('uptime')} ${uptime(snapshot.uptimeSec)}`),
          h('span', null, t('panelNote')),
        ),
      )
    }

    function HardwareMonitor({ t }) {
      const [snapshot, setSnapshot] = useState(null)
      const [status, setStatus] = useState('connecting')
      const [open, setOpen] = useState(false)
      const [history, setHistory] = useState({ cpu: [], mem: [] })

      useEffect(() => {
        if (typeof EventSource !== 'function') {
          setStatus('reconnecting')
          return undefined
        }
        const source = new EventSource(STREAM_URL)
        source.onopen = () => setStatus('live')
        source.onerror = () => setStatus('reconnecting')
        source.onmessage = (event) => {
          let next
          try {
            next = JSON.parse(event.data)
          } catch {
            return
          }
          setSnapshot(next)
          setStatus('live')
          setHistory((previous) => ({
            cpu: [...previous.cpu.slice(-59), clampPercent(next?.cpu?.usage)],
            mem: [...previous.mem.slice(-59), clampPercent(next?.mem?.usage)],
          }))
        }
        return () => source.close()
      }, [])

      const cpu = snapshot?.cpu?.usage
      const mem = snapshot?.mem?.usage
      const net = snapshot?.net
      const gpu = snapshot?.gpu
      const live = status === 'live'

      return h(
        'div',
        { className: 'dsh-hwm-root' },
        h('style', { key: 'styles' }, CSS),
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-hwm-strip',
            'aria-expanded': open,
            'aria-label': `${t('title')} · ${t(status)}`,
            title: t('title'),
            onClick: () => setOpen((value) => !value),
          },
          h('span', { className: `dsh-hwm-dot${live ? ' dsh-hwm-dot--live' : status === 'connecting' ? '' : ' dsh-hwm-dot--reconnecting'}` }),
          metric(t('cpu'), live || snapshot ? pct(cpu) : '—', h(Spark, { values: history.cpu })),
          h('span', { className: 'dsh-hwm-divider' }),
          metric(t('memory'), live || snapshot ? pct(mem) : '—'),
          h('span', { className: 'dsh-hwm-divider' }),
          net
            ? h(
                'span',
                { className: 'dsh-hwm-metric' },
                h('span', { className: 'dsh-hwm-label' }, 'NET'),
                h('span', { className: 'dsh-hwm-soft' }, `↓ ${rate(net.rxPerSec)}`),
                h('span', { className: 'dsh-hwm-soft' }, `↑ ${rate(net.txPerSec)}`),
              )
            : metric('NET', '—'),
          gpu
            ? h(React.Fragment, { key: 'gpu' },
                h('span', { className: 'dsh-hwm-divider' }),
                metric(t('gpu'), pct(gpu.usage)))
            : null,
          h('span', { className: 'dsh-hwm-spacer' }),
          h(
            'span',
            { className: 'dsh-hwm-more' },
            h('span', null, open ? t('hide') : t('detail')),
            h(
              'svg',
              {
                className: 'dsh-hwm-chevron',
                width: 10,
                height: 10,
                viewBox: '0 0 10 10',
                'aria-hidden': true,
                focusable: 'false',
                style: { transform: open ? 'rotate(180deg)' : 'none' },
              },
              h('path', {
                d: 'M2 3.5 L5 6.5 L8 3.5',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.4,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ),
        ),
        open ? h(Panel, { key: 'panel', t, snapshot }) : null,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { en: EN, zh: ZH }),
          'hardware-monitor: dictionaries',
        )
        const t = ctx.locale.bind(NS)
        const View = () => h(HardwareMonitor, { t })
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'hardware-monitor',
              order: 20,
              label: () => t('title'),
            },
            View,
          ),
        )
      },
    }
  },
})
