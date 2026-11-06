import { startCollector } from '../collector.js'

const collector = startCollector({ intervalMs: 1000 })
let received = 0
let unsubscribe = () => {}

unsubscribe = collector.subscribe((frame) => {
  received += 1
  const snapshot = JSON.parse(frame)
  console.log(`--- sample ${received} ---`)
  console.log(JSON.stringify(snapshot, null, 2))
  if (received >= 2) {
    unsubscribe()
    collector.stop()
    process.exit(0)
  }
})

setTimeout(() => {
  console.error(`timeout after ${received} samples`)
  unsubscribe()
  collector.stop()
  process.exit(1)
}, 8000)
