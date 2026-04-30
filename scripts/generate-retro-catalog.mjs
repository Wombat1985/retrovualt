import { mkdir, writeFile } from 'node:fs/promises'

const snapshotDate = '2026-04-30'
const consoles = [
  ['nes', 'NES'],
  ['famicom', 'Famicom', 'Japan'],
  ['famicom-disk-system', 'Famicom Disk System', 'Japan'],
  ['super-nintendo', 'Super Nintendo'],
  ['super-famicom', 'Super Famicom', 'Japan'],
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
]

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function rarityFromLoosePrice(priceLoose) {
  if (priceLoose >= 100) return 'Grail'
  if (priceLoose >= 30) return 'Classic'
  return 'Common'
}

async function fetchConsolePage(consoleSlug, cursor = '') {
  const body = new URLSearchParams({
    sort: 'name',
    when: 'none',
    'release-date': snapshotDate,
    'exclude-hardware': 'true',
    'exclude-variants': 'true',
  })

  if (cursor) {
    body.set('cursor', cursor)
  }

  const response = await fetch(`https://www.pricecharting.com/console/${consoleSlug}`, {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://www.pricecharting.com',
      referer: `https://www.pricecharting.com/console/${consoleSlug}`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${consoleSlug}: ${response.status}`)
  }

  return response.text()
}

function parseConsolePage(html, consoleSlug, consoleName, consoleRegion = 'North America') {
  const rows = [...html.matchAll(/<tr id="product-\d+" data-product="\d+">[\s\S]*?<\/tr>/g)]
  const entries = []

  for (const row of rows) {
    const block = row[0]
    const titleMatch = block.match(/<a href="\/game\/[^/]+\/([^"?#]+)">([^<]+)<\/a>/)
    const coverMatch = block.match(/<img class="photo" loading="lazy" src="([^"]+)"/)
    const looseMatch = block.match(
      /<td class="price numeric used_price">[\s\S]*?<span class="js-price">\$(\d[\d,]*(?:\.\d{2})?)<\/span>/,
    )
    const completeMatch = block.match(
      /<td class="price numeric cib_price">[\s\S]*?<span class="js-price">\$(\d[\d,]*(?:\.\d{2})?)<\/span>/,
    )

    if (!titleMatch || !coverMatch || !looseMatch) {
      continue
    }

    const slug = titleMatch[1]
    const title = decodeHtml(titleMatch[2])
    const priceLoose = Number.parseFloat(looseMatch[1].replaceAll(',', ''))
    const priceComplete = completeMatch ? Number.parseFloat(completeMatch[1].replaceAll(',', '')) : null
    const coverUrl = coverMatch[1].replace('/60.jpg', '/240.jpg')

    entries.push({
      id: `${consoleSlug}-${slug}`,
      title,
      console: consoleName,
      year: null,
      region: consoleRegion,
      coverUrl,
      priceLoose,
      priceComplete,
      priceSourceUrl: `https://www.pricecharting.com/game/${consoleSlug}/${slug}`,
      coverSourceUrl: `https://www.pricecharting.com/game/${consoleSlug}/${slug}`,
      trendDelta: 0,
      rarity: rarityFromLoosePrice(priceLoose),
    })
  }

  const cursorMatch = html.match(/name="cursor" value="(\d+)"/)

  return {
    entries,
    nextCursor: cursorMatch?.[1] ?? '',
  }
}

async function main() {
  const allEntries = []

  for (const [consoleSlug, consoleName, consoleRegion] of consoles) {
    let cursor = ''
    const seen = new Set()

    do {
      const html = await fetchConsolePage(consoleSlug, cursor)
      const { entries, nextCursor } = parseConsolePage(html, consoleSlug, consoleName, consoleRegion)

      for (const entry of entries) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id)
          allEntries.push(entry)
        }
      }

      cursor = nextCursor
    } while (cursor)
  }

  const consoleCounts = Object.entries(
    allEntries.reduce((accumulator, entry) => {
      accumulator[entry.console] = (accumulator[entry.console] ?? 0) + 1
      return accumulator
    }, {}),
  )
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([console, count]) => ({ console, count }))

  await mkdir('public/catalogs', { recursive: true })
  await writeFile('public/catalogs/retro-catalog.json', JSON.stringify(allEntries))
  await writeFile(
    'public/catalogs/retro-catalog-meta.json',
    JSON.stringify({
      snapshotDate,
      totalGames: allEntries.length,
      consoles: consoleCounts,
    }),
  )

  console.log(`Generated ${allEntries.length} retro entries across ${consoleCounts.length} consoles.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
