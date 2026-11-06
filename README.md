# Hardware monitor

Live hardware telemetry for the DeepSeek Harness Web GUI, rendered as an ambient
strip under the message composer.

```text
● CPU ▁▂▃ 6% | Memory 34% | NET ↓ 118 KB/s ↑ 646 KB/s | GPU 8%      Details ⌄
```

Click the strip to expand per-core CPU bars, memory breakdown, disk usage,
network rates, GPU utilization/temperature, host uptime, and the Harness
process's own RSS.

## Install

This repository is a local DeepSeek Harness plugin bundle: `package.json`
declares `dsh.bundle.patch`, so nothing is published to npm.

1. Clone the repository into a stable folder.
2. Install that folder as a bundle with the Harness Plugin Manager — the folder
   containing `cordis.patch.yml` is the install target. The agent-side equivalent
   is `plugin_manager` with `action: "install_bundle"` and the absolute folder
   path.
3. Open a session: the strip appears under the message composer, and
   **Settings → Plugins** lists the bundle as *Hardware monitor* / *硬件实时监测*.

## Verify locally

Node.js 20 or newer, no dependencies:

```bash
npm test        # SSE route: 401 without auth, then 200 + two live frames
npm run probe   # prints raw sampler snapshots as JSON
```

## What it shows

- **CPU** — overall utilization with a rolling sparkline, per-core bars, model and load average.
- **Memory** — used / total, percentage, and this process's RSS.
- **Disk** — utilization of the volume the Harness process runs from, used / free.
- **Network** — current receive / transmit rates and cumulative counters.
- **GPU** — utilization, VRAM, and temperature when `nvidia-smi` is available.

Click the strip to expand the full readout; click again to collapse it. All data
is sampled on the Host once per second and pushed to the page over a Server-Sent
Events stream, so the widget reflects the machine running the Harness, not the
browser.

## How it works

| File | Role |
|---|---|
| `index.js` | Host half. Injects `webServer` + `connection`, owns the sampler, and serves the authenticated `GET /hardware-monitor/stream` SSE route. |
| `collector.js` | Node-only sampler built on `node:os`, `node:fs.statfsSync`, `netstat` / `/proc/net/dev`, and optional `nvidia-smi`. No npm dependencies. |
| `client.js` | Browser half. Registers one `conversation.composer.dock` entry and renders with the host theme tokens and locale dictionaries. |
| `locale/*.json` | Plugin Manager title/description and the Client UI translations. |
| `icon.svg` | Original plugin artwork. |

## Data and privacy

The stream is served from the Harness origin. The route calls
`ctx.connection.requestRejection(request)` first, so the browser Cookie minted by
the Web shell is required; an unauthenticated request receives 401/403. Sampling
starts only while at least one page is subscribed and stops when the last
subscriber disconnects, so an unopened page costs no CPU.

Slow probes are throttled: disk and network counters every 5 s, GPU every 10 s.
The GPU probe is skipped after its first failure until the sampler restarts.
