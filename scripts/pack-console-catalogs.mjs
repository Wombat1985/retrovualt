import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')
const COVER_PREFIX = 'https://storage.googleapis.com/images.pricecharting.com/'
const SOURCE_PREFIX = 'https://www.pricecharting.com/game/'

function stripPrefix(value, prefix) {
  if (typeof value !== 'string') return ''
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

async function main() {
  const files = await readdir(catalogsDir)
  const catalogFiles = files.filter((f) => f.startsWith('catalog-') && f.endsWith('.json'))

  let totalBefore = 0
  let totalAfter = 0

  for (const file of catalogFiles) {
    const filePath = path.join(catalogsDir, file)
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      console.log(`Skip ${file} (already packed)`)
      continue
    }

    const rows = parsed.map((entry) => [
      entry.id,
      entry.title,
      entry.console,
      entry.year ?? null,
      entry.region ?? null,
      stripPrefix(entry.coverUrl, COVER_PREFIX),
      entry.priceLoose ?? null,
      entry.priceComplete ?? null,
      entry.priceSealed ?? null,
      stripPrefix(entry.priceSourceUrl, SOURCE_PREFIX),
      stripPrefix(entry.coverSourceUrl, SOURCE_PREFIX),
      entry.trendDelta ?? null,
      entry.rarity ?? '',
      entry.releaseType ?? '',
      entry.variantLabel ?? '',
    ])

    const packed = JSON.stringify({ version: 3, coverPrefix: COVER_PREFIX, sourcePrefix: SOURCE_PREFIX, rows })
    totalBefore += raw.length
    totalAfter += packed.length

    await writeFile(filePath, packed)
    const pct = Math.round(100 - (packed.length / raw.length) * 100)
    console.log(`${file.padEnd(45)} ${(raw.length / 1024).toFixed(0).padStart(5)}KB → ${(packed.length / 1024).toFixed(0).padStart(4)}KB  (-${pct}%)`)
  }

  console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB  (-${Math.round(100 - (totalAfter / totalBefore) * 100)}%)`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
