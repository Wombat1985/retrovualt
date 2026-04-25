import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')
const outputPath = path.join(catalogsDir, 'retro-catalog.json')

async function main() {
  const files = (await readdir(catalogsDir))
    .filter((file) => file.startsWith('catalog-') && file.endsWith('.json'))
    .sort()

  const seen = new Set()
  const combined = []

  for (const file of files) {
    const parsed = JSON.parse(await readFile(path.join(catalogsDir, file), 'utf8'))
    const entries = Array.isArray(parsed) ? parsed : []

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || seen.has(entry.id)) {
        continue
      }

      seen.add(entry.id)
      combined.push(entry)
    }
  }

  await writeFile(outputPath, JSON.stringify(combined))
  console.log(`Built full catalog with ${combined.length} entries.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
