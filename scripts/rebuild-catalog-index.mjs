import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const snapshotDate = '2026-04-11'
const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')

const consoleNames = new Map([
  ['nes', 'NES'],
  ['famicom', 'Famicom'],
  ['famicom-disk-system', 'Famicom Disk System'],
  ['super-nintendo', 'Super Nintendo'],
  ['super-famicom', 'Super Famicom'],
  ['nintendo-64', 'Nintendo 64'],
  ['gameboy', 'Game Boy'],
  ['gameboy-color', 'Game Boy Color'],
  ['gameboy-advance', 'Game Boy Advance'],
  ['virtual-boy', 'Virtual Boy'],
  ['sega-master-system', 'Sega Master System'],
  ['sega-genesis', 'Sega Genesis'],
  ['sega-cd', 'Sega CD'],
  ['sega-32x', 'Sega 32X'],
  ['sega-saturn', 'Sega Saturn'],
  ['sega-dreamcast', 'Dreamcast'],
  ['sega-game-gear', 'Game Gear'],
  ['playstation', 'PlayStation'],
  ['turbografx-16', 'TurboGrafx-16'],
  ['neo-geo-aes', 'Neo Geo AES'],
  ['neo-geo-cd', 'Neo Geo CD'],
  ['neo-geo-pocket-color', 'Neo Geo Pocket Color'],
  ['atari-2600', 'Atari 2600'],
  ['atari-5200', 'Atari 5200'],
  ['atari-7800', 'Atari 7800'],
  ['atari-lynx', 'Atari Lynx'],
  ['jaguar', 'Jaguar'],
])

async function main() {
  const files = (await readdir(catalogsDir))
    .filter((file) => file.startsWith('catalog-') && file.endsWith('.json'))
    .sort()

  const allEntries = []
  const consoles = []

  for (const file of files) {
    const slug = file.replace(/^catalog-/, '').replace(/\.json$/, '')
    const consoleName = consoleNames.get(slug)

    if (!consoleName) {
      continue
    }

    const entries = JSON.parse(await readFile(path.join(catalogsDir, file), 'utf8'))
    allEntries.push(...entries)
    consoles.push({
      console: consoleName,
      slug,
      count: entries.length,
      file: `/catalogs/${file}`,
    })
  }

  consoles.sort((left, right) => left.console.localeCompare(right.console))

  await writeFile(path.join(catalogsDir, 'retro-catalog.json'), JSON.stringify(allEntries))
  await writeFile(
    path.join(catalogsDir, 'retro-catalog-meta.json'),
    JSON.stringify({
      snapshotDate,
      totalGames: allEntries.length,
      consoles,
    }),
  )

  console.log(`Catalog index rebuilt with ${allEntries.length} retro entries across ${consoles.length} consoles.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
