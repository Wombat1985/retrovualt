export type RarityTier = 'Common' | 'Classic' | 'Grail'
export type ReleaseType = 'licensed' | 'unlicensed' | 'homebrew' | 'custom'

export type CatalogEntry = {
  id: string
  title: string
  console: string
  year: number | null
  region: string
  coverUrl: string
  priceLoose: number
  priceComplete: number | null
  priceSourceUrl: string
  coverSourceUrl: string
  trendDelta: number
  rarity: RarityTier
  releaseType?: ReleaseType
  variantLabel?: string
}

export const priceSnapshotDate = 'April 11, 2026'

export const sampleCatalog: CatalogEntry[] = [
  {
    id: 'nes-super-mario-bros',
    title: 'Super Mario Bros',
    console: 'NES',
    year: 1985,
    region: 'North America',
    coverUrl: 'https://storage.googleapis.com/images.pricecharting.com/m3qipe5bhqmddlov/1600.jpg',
    priceLoose: 16.95,
    priceComplete: 199.99,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/super-mario-bros',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/super-mario-bros',
    trendDelta: 2.8,
    rarity: 'Classic',
  },
  {
    id: 'nes-legend-of-zelda',
    title: 'Legend of Zelda',
    console: 'NES',
    year: 1987,
    region: 'North America',
    coverUrl:
      'https://storage.googleapis.com/images.pricecharting.com/2c1ff6d856bc29b818c51d1faa491c3d99a5290c3ddc9e53504866495adc396d/1600.jpg',
    priceLoose: 33.31,
    priceComplete: 162.78,
    priceSourceUrl: 'https://www.pricecharting.com/game/nes/legend-of-zelda',
    coverSourceUrl: 'https://www.pricecharting.com/game/nes/legend-of-zelda',
    trendDelta: 4.2,
    rarity: 'Grail',
  },
  {
    id: 'snes-chrono-trigger',
    title: 'Chrono Trigger',
    console: 'Super Nintendo',
    year: 1995,
    region: 'North America',
    coverUrl: 'https://storage.googleapis.com/images.pricecharting.com/rfif6ydrmbugtrol/1600.jpg',
    priceLoose: 254.1,
    priceComplete: 886.45,
    priceSourceUrl: 'https://www.pricecharting.com/game/super-nintendo/chrono-trigger',
    coverSourceUrl: 'https://www.pricecharting.com/game/super-nintendo/chrono-trigger',
    trendDelta: 7.3,
    rarity: 'Grail',
  },
  {
    id: 'genesis-gunstar-heroes',
    title: 'Gunstar Heroes',
    console: 'Sega Genesis',
    year: 1993,
    region: 'North America',
    coverUrl:
      'https://storage.googleapis.com/images.pricecharting.com/AMIfv975WPB-7tTSl6USnW0yG4BORuhYXcuiKvo0WT0jNoFjt6ckeod8Ftd0HApN8KX53bC1FH-MPaqGCoI_Aa1hmdaAUffZWZB-zXta7eEBPZh17TKSYe0RaNb_1S3f-mo2ZQ7kz4HagAsC2Ba3vnCujBSucBviVw/1600.jpg',
    priceLoose: 65,
    priceComplete: 143.67,
    priceSourceUrl: 'https://www.pricecharting.com/game/sega-genesis/gunstar-heroes',
    coverSourceUrl: 'https://www.pricecharting.com/game/sega-genesis/gunstar-heroes',
    trendDelta: 6.1,
    rarity: 'Grail',
  },
  {
    id: 'n64-ocarina-of-time',
    title: 'Zelda Ocarina of Time',
    console: 'Nintendo 64',
    year: 1998,
    region: 'North America',
    coverUrl: 'https://storage.googleapis.com/images.pricecharting.com/bidbex33joqxpepk/1600.jpg',
    priceLoose: 44.93,
    priceComplete: 165.52,
    priceSourceUrl: 'https://www.pricecharting.com/game/nintendo-64/zelda-ocarina-of-time',
    coverSourceUrl: 'https://www.pricecharting.com/game/nintendo-64/zelda-ocarina-of-time',
    trendDelta: 3.9,
    rarity: 'Classic',
  },
  {
    id: 'ps1-castlevania-symphony-of-the-night',
    title: 'Castlevania Symphony of the Night',
    console: 'PlayStation',
    year: 1997,
    region: 'North America',
    coverUrl: 'https://storage.googleapis.com/images.pricecharting.com/4dayo4ooyvlepe44/1600.jpg',
    priceLoose: 90,
    priceComplete: 165,
    priceSourceUrl: 'https://www.pricecharting.com/game/playstation/castlevania-symphony-of-the-night',
    coverSourceUrl: 'https://www.pricecharting.com/game/playstation/castlevania-symphony-of-the-night',
    trendDelta: 6.4,
    rarity: 'Grail',
  },
  {
    id: 'game-boy-pokemon-red',
    title: 'Pokemon Red',
    console: 'Game Boy',
    year: 1998,
    region: 'North America',
    coverUrl: 'https://storage.googleapis.com/images.pricecharting.com/3ox5t3qvv32l6bjh/1600.jpg',
    priceLoose: 79.25,
    priceComplete: 391.61,
    priceSourceUrl: 'https://www.pricecharting.com/game/gameboy/pokemon-red',
    coverSourceUrl: 'https://www.pricecharting.com/game/gameboy/pokemon-red',
    trendDelta: 4.9,
    rarity: 'Grail',
  },
  {
    id: 'dreamcast-jet-grind-radio',
    title: 'Jet Grind Radio',
    console: 'Dreamcast',
    year: 2000,
    region: 'North America',
    coverUrl: 'https://storage.googleapis.com/images.pricecharting.com/4u6wcebuxdhzql6d/1600.jpg',
    priceLoose: 44.95,
    priceComplete: 74.99,
    priceSourceUrl: 'https://www.pricecharting.com/game/sega-dreamcast/jet-grind-radio',
    coverSourceUrl: 'https://www.pricecharting.com/game/sega-dreamcast/jet-grind-radio',
    trendDelta: 4.4,
    rarity: 'Classic',
  },
]
