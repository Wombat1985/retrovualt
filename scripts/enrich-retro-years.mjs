import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const catalogsDir = join(projectRoot, 'public', 'catalogs')
const cacheDir = join(projectRoot, 'server', 'data')
const cachePath = join(cacheDir, 'year-cache.json')

const catalogFiles = [
  'catalog-atari-2600.json',
  'catalog-atari-5200.json',
  'catalog-atari-7800.json',
  'catalog-atari-lynx.json',
  'catalog-gameboy.json',
  'catalog-gameboy-advance.json',
  'catalog-gameboy-color.json',
  'catalog-jaguar.json',
  'catalog-neo-geo-aes.json',
  'catalog-neo-geo-cd.json',
  'catalog-neo-geo-pocket-color.json',
  'catalog-nes.json',
  'catalog-nintendo-64.json',
  'catalog-playstation.json',
  'catalog-sega-32x.json',
  'catalog-sega-cd.json',
  'catalog-sega-dreamcast.json',
  'catalog-sega-game-gear.json',
  'catalog-sega-genesis.json',
  'catalog-sega-master-system.json',
  'catalog-sega-saturn.json',
  'catalog-super-nintendo.json',
  'catalog-turbografx-16.json',
  'catalog-virtual-boy.json',
]

const concurrency = Number(process.env.YEAR_ENRICH_CONCURRENCY ?? 6)

async function loadJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function extractYear(html) {
  const faqReleaseMatch = html.match(/"When was .*? released\?"[\s\S]*?"text":"[^"]*?(\d{4})"/i)
  if (faqReleaseMatch) {
    return Number(faqReleaseMatch[1])
  }

  const releaseDateMatch = html.match(/Release Date[^<]*<\/td>\s*<td[^>]*>\s*[^<]*(\d{4})/i)
  if (releaseDateMatch) {
    return Number(releaseDateMatch[1])
  }

  const yearMatch = html.match(/\b(19[78]\d|19[9]\d|20[0-2]\d|2030)\b/)
  return yearMatch ? Number(yearMatch[1]) : null
}

async function fetchYear(entry) {
  const response = await fetch(entry.priceSourceUrl, {
    headers: {
      'User-Agent': 'RetroVaultEliteYearEnricher/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${entry.priceSourceUrl}: ${response.status}`)
  }

  const html = await response.text()
  return extractYear(html)
}

async function runWorker(queue, cache) {
  while (queue.length) {
    const entry = queue.shift()

    if (!entry) {
      return
    }

    if (cache[entry.id] !== undefined) {
      entry.year = cache[entry.id]
      continue
    }

    try {
      const year = await fetchYear(entry)
      cache[entry.id] = year
      entry.year = year
      console.log(`Year ${year ?? 'n/a'} - ${entry.title}`)
    } catch (error) {
      cache[entry.id] = null
      entry.year = null
      console.warn(`Failed year lookup for ${entry.title}: ${error instanceof Error ? error.message : String(error)}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 120))
  }
}

async function main() {
  await mkdir(cacheDir, { recursive: true })
  const cache = await loadJson(cachePath, {})

  for (const fileName of catalogFiles) {
    const filePath = join(catalogsDir, fileName)
    if (!existsSync(filePath)) {
      continue
    }

    const entries = await loadJson(filePath, [])
    const queue = entries.filter((entry) => entry && typeof entry === 'object' && entry.year == null)

    console.log(`Enriching ${fileName}: ${queue.length} entries missing year`)

    const workers = Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, () => runWorker(queue, cache))
    await Promise.all(workers)

    await writeFile(filePath, JSON.stringify(entries))
  }

  await writeFile(cachePath, JSON.stringify(cache, null, 2))
  console.log('Year enrichment complete.')
}

await main()
