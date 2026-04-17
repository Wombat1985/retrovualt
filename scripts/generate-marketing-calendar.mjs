import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outputDir = join(process.cwd(), 'marketing')
const outputPath = join(outputDir, 'retro-vault-30-day-calendar.csv')
const baseUrl = 'https://www.retrovaultelite.com'
const channels = ['Facebook group', 'Reddit', 'Discord', 'TikTok caption', 'YouTube Short comment', 'X post']
const hooks = [
  'What is the rarest game in your retro collection?',
  'Loose carts or complete in box: which collector are you?',
  'What console are you closest to completing?',
  'What game did you sell and regret forever?',
  'What is your best bargain retro pickup?',
  'What game is too expensive now but still on your grail list?',
  'What is the first game you would mark as owned in a collection tracker?',
  'Which retro library deserves more love?',
  'What is your strongest console shelf?',
  'What game would you never sell?',
]
const angles = [
  'Ask for feedback from real collectors.',
  'Invite people to compare collector rank.',
  'Show the value of tracking loose versus CIB.',
  'Invite people to build a wishlist of grails.',
  'Ask spreadsheet users what would convert them.',
  'Talk about completion percentage and shelf goals.',
]

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function campaignFor(channel) {
  return channel.toLowerCase().replaceAll(' ', '_').replaceAll('/', '_')
}

function buildPost(day, channel, hook, angle) {
  const campaign = campaignFor(channel)
  const url = `${baseUrl}/?utm_source=${campaign}&utm_medium=organic&utm_campaign=day_${day}_collector_growth`

  return [
    hook,
    '',
    'I am building Retro Vault Elite, a free retro game collection tracker for owned games, wanted games, loose/CIB value, paid prices, and console completion.',
    angle,
    '',
    `Try it here: ${url}`,
  ].join('\n')
}

const rows = [['Day', 'Channel', 'Hook', 'Angle', 'Post']]

for (let day = 1; day <= 30; day += 1) {
  const channel = channels[(day - 1) % channels.length]
  const hook = hooks[(day - 1) % hooks.length]
  const angle = angles[(day - 1) % angles.length]
  rows.push([day, channel, hook, angle, buildPost(day, channel, hook, angle)])
}

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputPath, rows.map((row) => row.map(csvEscape).join(',')).join('\n'))
console.log(`Wrote ${outputPath}`)
