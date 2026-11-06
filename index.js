/**
 * Host half of the hardware-monitor bundle.
 *
 * Samples hardware facts in this process and publishes them as
 * Server-Sent Events on an authenticated exact route. The Client half is a
 * composer-dock widget that subscribes to that stream.
 */
import { startCollector } from './collector.js'

const ROUTE = '/hardware-monitor/stream'
const encoder = new TextEncoder()

export const inject = ['webServer', 'connection']

export function apply(ctx, config) {
  const intervalMs = Number(config?.intervalMs) > 0 ? Number(config.intervalMs) : 1000
  const collector = startCollector({ intervalMs })

  ctx.effect(() => () => collector.stop(), 'hardware-monitor: sampler')

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ROUTE,
        resource: (request) => respond(request, ctx, collector),
      }),
    'hardware-monitor: event stream route',
  )
}

function respond(request, ctx, collector) {
  const rejection = ctx.connection.requestRejection({ headers: request.headers })
  if (rejection) {
    return new Response(rejection === 401 ? 'Unauthorized' : 'Forbidden', {
      status: rejection,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  let close = () => {}
  const body = new ReadableStream({
    start(controller) {
      let closed = false
      let unsubscribe = () => {}

      const cleanup = () => {
        if (closed) return
        closed = true
        unsubscribe()
        request.signal.removeEventListener('abort', cleanup)
        try {
          controller.close()
        } catch {
          // The stream may already be closed by a client disconnect.
        }
      }

      const send = (frame) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${frame}\n\n`))
        } catch {
          cleanup()
        }
      }

      unsubscribe = collector.subscribe(send)
      close = cleanup
      if (request.signal.aborted) cleanup()
      else request.signal.addEventListener('abort', cleanup, { once: true })
    },
    cancel() {
      close()
    },
  })

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
