import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')
const fullCatalogPath = path.join(catalogsDir, 'retro-catalog.json')
const liteCatalogPath = path.join(catalogsDir, 'retro-catalog-lite.json')

async function main() {
  const parsed = JSON.parse(await readFile(fullCatalogPath, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : []
  const liteEntries = entries.map((entry) => [
    entry.id,
    entry.title,
    entry.console,
    entry.year,
    entry.region,
    entry.coverUrl,
    entry.priceLoose,
    entry.priceComplete,
    entry.priceSourceUrl,
    entry.coverSourceUrl,
    entry.trendDelta,
    entry.rarity,
  ])

  await writeFile(liteCatalogPath, JSON.stringify(liteEntries))
  console.log(`Built lite catalog with ${liteEntries.length} entries.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
