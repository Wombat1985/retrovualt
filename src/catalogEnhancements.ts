import type { CatalogEntry, ReleaseType } from './data'

type CatalogEntryOverride = Partial<Pick<CatalogEntry, 'releaseType' | 'variantLabel' | 'year'>>

export const catalogEntryOverrides: Record<string, CatalogEntryOverride> = {
  'nes-action-52': { releaseType: 'unlicensed' },
  'nes-8-bit-xmas-2019': { releaseType: 'homebrew' },
  'nes-8-bit-xmas-2020': { releaseType: 'homebrew' },
  'nes-8bit-music-power-encore': { releaseType: 'homebrew' },
  'nes-gauntlet': { releaseType: 'unlicensed', variantLabel: 'Tengen black cart' },
  'nes-rbi-baseball': { releaseType: 'unlicensed', variantLabel: 'Tengen black cart' },
  'nes-ms-pac-man-tengen': { releaseType: 'unlicensed', variantLabel: 'Tengen release' },
  'nes-pac-man-tengen': { releaseType: 'unlicensed', variantLabel: 'Tengen black cart' },
  'nes-the-untouchables': { releaseType: 'licensed', variantLabel: 'Standard label' },
  'nes-witch-n%27-wiz': { releaseType: 'homebrew' },
}

export const extraCatalogEntries: CatalogEntry[] = [
  {
    id: 'nes-gauntlet-gray-cart',
    title: 'Gauntlet',
    console: 'NES',
    year: 1987,
    region: 'North America',
    coverUrl: '',
    priceLoose: 15.85,
    priceComplete: 47.99,
    priceSourceUrl: 'https://www.pricecharting.com/game/39511',
    coverSourceUrl: 'https://www.pricecharting.com/game/39511',
    trendDelta: 0,
    rarity: 'Common',
    releaseType: 'licensed',
    variantLabel: 'Gray cart',
  },
  {
    id: 'nes-rbi-baseball-gray-cart',
    title: 'RBI Baseball',
    console: 'NES',
    year: 1988,
    region: 'North America',
    coverUrl: '',
    priceLoose: 14.95,
    priceComplete: 55,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/rbi-baseball-gray-cart',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/rbi-baseball-gray-cart',
    trendDelta: 0,
    rarity: 'Common',
    releaseType: 'licensed',
    variantLabel: 'Gray cart',
  },
  {
    id: 'nes-pac-man-tengen',
    title: 'Pac-Man',
    console: 'NES',
    year: 1987,
    region: 'North America',
    coverUrl: '',
    priceLoose: 9.99,
    priceComplete: 30,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/pac-man-tengen',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/pac-man-tengen',
    trendDelta: 0,
    rarity: 'Common',
    releaseType: 'unlicensed',
    variantLabel: 'Tengen black cart',
  },
  {
    id: 'nes-pac-man-tengen-gray',
    title: 'Pac-Man',
    console: 'NES',
    year: 1990,
    region: 'North America',
    coverUrl: '',
    priceLoose: 14.25,
    priceComplete: 37.31,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/pac-man-tengen-gray',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/pac-man-tengen-gray',
    trendDelta: 0,
    rarity: 'Common',
    releaseType: 'licensed',
    variantLabel: 'Tengen gray cart',
  },
  {
    id: 'nes-pac-man-namco',
    title: 'Pac-Man',
    console: 'NES',
    year: 1993,
    region: 'North America',
    coverUrl: '',
    priceLoose: 13.36,
    priceComplete: 38.24,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/pac-man-namco',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/pac-man-namco',
    trendDelta: 0,
    rarity: 'Common',
    releaseType: 'licensed',
    variantLabel: 'Namco release',
  },
  {
    id: 'nes-ms-pac-man-tengen',
    title: 'Ms. Pac-Man',
    console: 'NES',
    year: 1990,
    region: 'North America',
    coverUrl: '',
    priceLoose: 13.8,
    priceComplete: 32.43,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/ms-pac-man-tengen',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/ms-pac-man-tengen',
    trendDelta: 0,
    rarity: 'Common',
    releaseType: 'unlicensed',
    variantLabel: 'Tengen release',
  },
  {
    id: 'nes-ms-pac-man-namco',
    title: 'Ms. Pac-Man',
    console: 'NES',
    year: 1993,
    region: 'North America',
    coverUrl: '',
    priceLoose: 49.97,
    priceComplete: 109.72,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/ms-pac-man-namco',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/ms-pac-man-namco',
    trendDelta: 0,
    rarity: 'Classic',
    releaseType: 'licensed',
    variantLabel: 'Namco release',
  },
  {
    id: 'nes-the-untouchables-blue-label',
    title: 'The Untouchables',
    console: 'NES',
    year: 1991,
    region: 'North America',
    coverUrl: '',
    priceLoose: 43.55,
    priceComplete: 200,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/the-untouchables-blue-label',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/the-untouchables-blue-label',
    trendDelta: 0,
    rarity: 'Classic',
    releaseType: 'licensed',
    variantLabel: 'Blue label',
  },
]

export function getReleaseTypeLabel(releaseType: ReleaseType | undefined) {
  switch (releaseType) {
    case 'licensed':
      return 'Licensed'
    case 'unlicensed':
      return 'Unlicensed'
    case 'homebrew':
      return 'Homebrew'
    case 'custom':
      return 'Custom'
    default:
      return ''
  }
}
