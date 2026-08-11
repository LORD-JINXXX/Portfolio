const baseUrl = String(process.env.LOAD_TEST_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '')
const total = Math.max(1, Math.min(5000, Number(process.env.LOAD_TEST_REQUESTS || 200)))
const concurrency = Math.max(1, Math.min(100, Number(process.env.LOAD_TEST_CONCURRENCY || 10)))
const targetPath = String(process.env.LOAD_TEST_PATH || '/health')
const target = new URL(targetPath, `${baseUrl}/`)
const local = ['localhost', '127.0.0.1', '::1'].includes(target.hostname)
if (!local && process.env.ALLOW_REMOTE_LOAD_TEST !== 'true') {
  console.error('Refusing to load-test a non-local host. Set ALLOW_REMOTE_LOAD_TEST=true only for a staging system you control.')
  process.exit(2)
}
const latencies = []
let nextIndex = 0
let failures = 0
const statuses = new Map()

async function worker() {
  while (true) {
    const index = nextIndex++
    if (index >= total) return
    const started = performance.now()
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'dynamic-portfolio-load-smoke/0.6' } })
      latencies.push(performance.now() - started)
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1)
      await response.arrayBuffer()
      if (response.status >= 500) failures += 1
    } catch { failures += 1; latencies.push(performance.now() - started) }
  }
}

const suiteStarted = performance.now()
await Promise.all(Array.from({ length: concurrency }, () => worker()))
latencies.sort((a, b) => a - b)
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.max(0, Math.ceil(latencies.length * p) - 1))] || 0
const seconds = Math.max(.001, (performance.now() - suiteStarted) / 1000)
console.log(JSON.stringify({
  target: target.href,
  requests: total,
  concurrency,
  requestsPerSecond: Number((total / seconds).toFixed(2)),
  failures,
  statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a - b)),
  latencyMs: { p50: Number(percentile(.5).toFixed(2)), p95: Number(percentile(.95).toFixed(2)), p99: Number(percentile(.99).toFixed(2)), max: Number((latencies.at(-1) || 0).toFixed(2)) },
}, null, 2))
if (failures) process.exitCode = 1
