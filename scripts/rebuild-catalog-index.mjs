import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const snapshotDate = '2026-04-11'
const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')
const manifestPath = path.join(process.cwd(), 'scripts', 'retro-console-manifest.json')

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const consoleLookup = new Map(manifest.map((console) => [console.slug, console]))
  const files = (await readdir(catalogsDir))
    .filter((file) => file.startsWith('catalog-') && file.endsWith('.json'))
    .sort()

  const consoles = []

  for (const file of files) {
    const slug = file.replace(/^catalog-/, '').replace(/\.json$/, '')
    const consoleMeta = consoleLookup.get(slug)

    if (!consoleMeta) {
      continue
    }

    const parsed = JSON.parse(await readFile(path.join(catalogsDir, file), 'utf8'))
    const entries = Array.isArray(parsed) ? parsed : [parsed]
    consoles.push({
      console: consoleMeta.name,
      slug,
      region: consoleMeta.region,
      market: consoleMeta.market,
      count: entries.length,
      file: `/catalogs/${file}`,
    })
  }

  consoles.sort((left, right) => left.console.localeCompare(right.console))

  await writeFile(
    path.join(catalogsDir, 'retro-catalog-meta.json'),
    JSON.stringify({
      snapshotDate,
      totalGames: consoles.reduce((total, consoleMeta) => total + consoleMeta.count, 0),
      consoles,
    }),
  )

  console.log(`Catalog index rebuilt across ${consoles.length} consoles.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
