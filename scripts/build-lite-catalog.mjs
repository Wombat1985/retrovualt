import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')
const fullCatalogPath = path.join(catalogsDir, 'retro-catalog.json')
const liteCatalogPath = path.join(catalogsDir, 'retro-catalog-lite.json')
const COVER_PREFIX = 'https://storage.googleapis.com/images.pricecharting.com/'
const SOURCE_PREFIX = 'https://www.pricecharting.com/game/'

function stripPrefix(value, prefix) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

async function main() {
  const parsed = JSON.parse(await readFile(fullCatalogPath, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : []
  const rows = entries.map((entry) => [
    entry.id,
    entry.title,
    entry.console,
    entry.year,
    entry.region,
    stripPrefix(entry.coverUrl, COVER_PREFIX),
    entry.priceLoose,
    entry.priceComplete,
    stripPrefix(entry.priceSourceUrl, SOURCE_PREFIX),
    entry.trendDelta,
    entry.rarity,
    entry.releaseType ?? '',
    entry.variantLabel ?? '',
  ])

  const payload = {
    version: 2,
    coverPrefix: COVER_PREFIX,
    sourcePrefix: SOURCE_PREFIX,
    rows,
  }

  await writeFile(liteCatalogPath, JSON.stringify(payload))
  console.log(`Built lite catalog with ${rows.length} entries.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
