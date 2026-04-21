const DEFAULT_URL = 'http://127.0.0.1:8787'
const DEFAULT_REQUESTS = 1000
const DEFAULT_CONCURRENCY = 50
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

const scenarios = {
  health: [
    {
      method: 'GET',
      path: '/health',
    },
  ],
  analytics: [
    {
      method: 'POST',
      path: '/analytics/page-view',
      body: () => ({
        path: '/',
        referrer: '',
        signedIn: false,
      }),
    },
  ],
  mixed: [
    {
      method: 'GET',
      path: '/health',
      weight: 8,
    },
    {
      method: 'POST',
      path: '/analytics/page-view',
      weight: 2,
      body: (index) => ({
        path: index % 5 === 0 ? '/retro-console-collection-tracker.html' : '/',
        referrer: index % 3 === 0 ? 'https://www.google.com/' : '',
        signedIn: index % 10 === 0,
      }),
    },
  ],
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    requests: DEFAULT_REQUESTS,
    concurrency: DEFAULT_CONCURRENCY,
    scenario: 'mixed',
    timeoutMs: 10000,
    allowProduction: false,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg === '--allow-production') {
      options.allowProduction = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--url' && next) {
      options.url = next
      index += 1
      continue
    }

    if ((arg === '--requests' || arg === '-n') && next) {
      options.requests = Number(next)
      index += 1
      continue
    }

    if ((arg === '--concurrency' || arg === '-c') && next) {
      options.concurrency = Number(next)
      index += 1
      continue
    }

    if (arg === '--scenario' && next) {
      options.scenario = next
      index += 1
      continue
    }

    if (arg === '--timeout-ms' && next) {
      options.timeoutMs = Number(next)
      index += 1
    }
  }

  return options
}

function printHelp() {
  console.log(`
Retro Vault Elite load test

Usage:
  npm run load:test -- --url http://127.0.0.1:8787 --scenario mixed --requests 1000 --concurrency 50

Options:
  --url <url>             Target backend URL. Defaults to ${DEFAULT_URL}
  --scenario <name>       health, analytics, or mixed. Defaults to mixed
  --requests, -n <count>  Total requests to send. Defaults to ${DEFAULT_REQUESTS}
  --concurrency, -c <n>   Concurrent virtual users. Defaults to ${DEFAULT_CONCURRENCY}
  --timeout-ms <ms>       Per-request timeout. Defaults to 10000
  --dry-run               Print the planned test and exit
  --allow-production      Required for non-local targets or very high concurrency

Safe examples:
  npm run load:test -- --scenario health --requests 500 --concurrency 25
  npm run load:test -- --scenario mixed --requests 5000 --concurrency 200

50k-style local simulation:
  npm run load:test -- --scenario health --requests 50000 --concurrency 1000 --allow-production
`)
}

function assertOptions(options) {
  if (!Number.isInteger(options.requests) || options.requests < 1) {
    throw new Error('Requests must be a positive integer.')
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error('Concurrency must be a positive integer.')
  }

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100) {
    throw new Error('Timeout must be at least 100ms.')
  }

  if (!scenarios[options.scenario]) {
    throw new Error(`Unknown scenario "${options.scenario}". Use one of: ${Object.keys(scenarios).join(', ')}.`)
  }

  const target = new URL(options.url)
  const isLocal = LOCAL_HOSTS.has(target.hostname)
  const riskyConcurrency = options.concurrency > 1000

  if ((!isLocal || riskyConcurrency) && !options.allowProduction) {
    throw new Error(
      'Refusing to run a high-risk load test. Use a local URL, reduce concurrency, or pass --allow-production intentionally.',
    )
  }
}

function buildWeightedRequests(scenario) {
  return scenario.flatMap((request) => Array.from({ length: request.weight ?? 1 }, () => request))
}

function percentile(values, p) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

function summarize(results, startedAt, endedAt) {
  const durationSeconds = Math.max((endedAt - startedAt) / 1000, 0.001)
  const latencies = results.filter((result) => Number.isFinite(result.ms)).map((result) => result.ms)
  const statusCounts = results.reduce((counts, result) => {
    const key = result.status ?? result.error ?? 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  const failures = results.filter((result) => result.error || result.status >= 400).length

  return {
    total: results.length,
    failures,
    successRate: Number((((results.length - failures) / results.length) * 100).toFixed(2)),
    requestsPerSecond: Number((results.length / durationSeconds).toFixed(2)),
    latencyMs: {
      min: latencies.length ? Math.min(...latencies) : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Math.max(...latencies) : 0,
    },
    statusCounts,
  }
}

async function sendRequest(baseUrl, request, index, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()

  try {
    const body = request.body?.(index)
    const response = await fetch(new URL(request.path, baseUrl), {
      method: request.method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const ms = Math.round(performance.now() - startedAt)

    await response.arrayBuffer().catch(() => null)
    return { status: response.status, ms }
  } catch (error) {
    const ms = Math.round(performance.now() - startedAt)
    return { error: error?.name === 'AbortError' ? 'timeout' : 'network_error', ms }
  } finally {
    clearTimeout(timeout)
  }
}

async function runLoadTest(options) {
  const requestSet = buildWeightedRequests(scenarios[options.scenario])
  const results = []
  let nextIndex = 0

  const startedAt = performance.now()

  async function worker() {
    while (nextIndex < options.requests) {
      const index = nextIndex
      nextIndex += 1
      const request = requestSet[index % requestSet.length]
      results.push(await sendRequest(options.url, request, index, options.timeoutMs))
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.concurrency, options.requests) }, worker))

  return summarize(results, startedAt, performance.now())
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  assertOptions(options)

  console.log(
    JSON.stringify(
      {
        target: options.url,
        scenario: options.scenario,
        requests: options.requests,
        concurrency: options.concurrency,
        timeoutMs: options.timeoutMs,
        dryRun: options.dryRun,
      },
      null,
      2,
    ),
  )

  if (options.dryRun) {
    return
  }

  const summary = await runLoadTest(options)
  console.log(JSON.stringify(summary, null, 2))

  if (summary.failures > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
