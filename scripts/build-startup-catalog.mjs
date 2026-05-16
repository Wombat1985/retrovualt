import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const catalogsDir = path.join(process.cwd(), 'public', 'catalogs')
const fullCatalogPath = path.join(catalogsDir, 'retro-catalog.json')
const startupCatalogPath = path.join(catalogsDir, 'retro-catalog-startup.json')
const COVER_PREFIX = 'https://storage.googleapis.com/images.pricecharting.com/'
const SOURCE_PREFIX = 'https://www.pricecharting.com/game/'

const LEGENDS_CONSOLES = new Set([
  'NES',
  'Atari 2600',
  'Sega Master System',
  'TurboGrafx-16',
  'Sega Genesis',
  'Super Nintendo',
  'Game Boy',
  'Sega CD',
  'Nintendo 64',
  'PlayStation',
  'Sega Saturn',
  'Atari 7800',
  'Dreamcast',
  'Game Boy Color',
  'PlayStation 2',
  'GameCube',
  'Game Boy Advance',
  'Nintendo DS',
  'Neo Geo AES',
  '3DO',
  'TurboGrafx CD',
])

const LEGENDS_PATTERNS = [
  'mario', 'zelda', 'metroid', 'castlevania', 'contra', 'mega man', 'megaman',
  'sonic', 'final fantasy', 'dragon quest', 'chrono trigger', 'street fighter',
  'resident evil', 'silent hill', 'pokemon', 'pokémon', 'fire emblem', 'f-zero',
  'pilotwings', 'wave race', 'star fox', 'kirby', 'earthbound', 'mother',
  'banjo', 'perfect dark', 'goldeneye', 'tekken', 'ridge racer', 'wipeout',
  'panzer dragoon', 'nights', 'phantasy star', 'shining force', 'outrun',
  'space harrier', 'gunstar heroes', 'alien soldier', 'radiant silvergun',
  'guardian heroes', 'snatcher', 'policenauts', 'gradius', 'parodius', 'r-type',
  'axelay', 'actraiser', 'secret of mana', 'seiken', 'mana', 'xenogears',
  'xenosaga', 'chrono cross', 'vagrant story', 'suikoden', 'breath of fire',
  'lunar', 'skies of arcadia', 'jet grind radio', 'crazy taxi', 'shenmue',
  'virtua fighter', 'virtua cop', 'house of the dead', 'daytona', 'after burner',
  'double dragon', 'bubble bobble', 'bomberman', 'adventure island', 'bonk',
  'splatterhouse', 'darius', 'arkanoid', 'gauntlet', 'paper mario', 'smash bros',
  'super smash bros', 'animal crossing', 'pikmin', 'luigi', 'yoshi',
]

const LEGEND_CONSOLE_RANK = {
  'NES': 1, 'Atari 2600': 2, 'Sega Master System': 3, 'TurboGrafx-16': 4,
  'Sega Genesis': 5, 'Super Nintendo': 6, 'Game Boy': 7, 'Sega CD': 8,
  'Nintendo 64': 9, 'PlayStation': 10, 'Sega Saturn': 11, 'Atari 7800': 12,
  'Dreamcast': 13, 'Game Boy Color': 14, 'PlayStation 2': 15, 'GameCube': 16,
  'Game Boy Advance': 17, 'Nintendo DS': 18, 'Neo Geo AES': 19,
  '3DO': 20, 'TurboGrafx CD': 21,
}

function stripPrefix(value, prefix) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

function normalizeTitleKey(title) {
  return String(title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isLegendGame(entry) {
  if (!LEGENDS_CONSOLES.has(entry.console)) {
    return false
  }

  const title = String(entry.title ?? '').toLowerCase()
  return LEGENDS_PATTERNS.some((pattern) => title.includes(pattern))
}

function deduplicateLegends(entries) {
  const best = new Map()

  for (const entry of entries) {
    const key = normalizeTitleKey(entry.title)
    const existing = best.get(key)

    if (!existing) {
      best.set(key, entry)
      continue
    }

    const entryYear = Number.isFinite(entry.year) ? entry.year : 9999
    const existingYear = Number.isFinite(existing.year) ? existing.year : 9999
    const entryRank = LEGEND_CONSOLE_RANK[entry.console] ?? 99
    const existingRank = LEGEND_CONSOLE_RANK[existing.console] ?? 99

    if (entryYear < existingYear || (entryYear === existingYear && entryRank < existingRank)) {
      best.set(key, entry)
    }
  }

  return [...best.values()]
}

async function main() {
  const parsed = JSON.parse(await readFile(fullCatalogPath, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : []
  const startupEntries = deduplicateLegends(entries.filter(isLegendGame))

  const rows = startupEntries.map((entry) => [
    entry.id,
    entry.title,
    entry.console,
    entry.year,
    entry.region,
    stripPrefix(entry.coverUrl, COVER_PREFIX),
    entry.priceLoose,
    entry.priceComplete,
    entry.priceSealed ?? null,
    stripPrefix(entry.priceSourceUrl, SOURCE_PREFIX),
    stripPrefix(entry.coverSourceUrl, SOURCE_PREFIX),
    entry.trendDelta,
    entry.rarity,
    entry.releaseType ?? '',
    entry.variantLabel ?? '',
  ])

  const payload = {
    version: 1,
    coverPrefix: COVER_PREFIX,
    sourcePrefix: SOURCE_PREFIX,
    rows,
  }

  await writeFile(startupCatalogPath, JSON.stringify(payload))
  console.log(`Built startup catalog with ${rows.length} entries.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
