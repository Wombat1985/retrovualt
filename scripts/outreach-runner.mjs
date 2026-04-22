import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const targetFile = 'marketing/collector-outreach-100.md'
const progressFile = 'marketing/outreach-progress.local'
const siteUrl = 'https://www.retrovaultelite.com/'
const bestFirstIds = new Set([2, 1, 86, 61, 62, 76, 25, 26, 27, 29])

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)

const limit = Number(args.get('limit') || 12)
const categoryFilter = args.get('category')?.toLowerCase()
const bestOnly = args.has('best')
const dryRun = args.has('dry-run')

function parseTargets() {
  const markdown = readFileSync(targetFile, 'utf8')
  const targets = []
  let category = 'General'

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (.+)$/)
    if (heading) {
      category = heading[1].replace(/ And .+$/, '').replace('Discord', 'Discord/Facebook')
      continue
    }

    const target = line.match(/^(\d+)\. \[(.+?)\]\((.+?)\)/)
    if (!target) {
      continue
    }

    targets.push({
      id: Number(target[1]),
      name: target[2],
      url: target[3],
      category,
    })
  }

  return targets
}

function loadProgress() {
  if (!existsSync(progressFile)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(progressFile, 'utf8'))
  } catch {
    return {}
  }
}

function saveProgress(progress) {
  writeFileSync(progressFile, `${JSON.stringify(progress, null, 2)}\n`)
}

function statusFor(progress, target) {
  return progress[target.id]?.status || 'todo'
}

function trackingUrl(target) {
  const source = target.category.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const campaign = target.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${siteUrl}?utm_source=${encodeURIComponent(source)}&utm_medium=review_request&utm_campaign=${encodeURIComponent(campaign)}`
}

function messageFor(target) {
  const opener = target.category === 'Reddit Communities'
    ? `Hey everyone, I have been building a free retro game collection tracker called Retro Vault Elite and I would really value feedback from ${target.name} collectors.`
    : 'Hey, I have been building a free retro game collection tracker called Retro Vault Elite and I would really value feedback from someone who actually likes retro games.'

  return `${opener}

It tracks owned games, wanted games, loose/CIB value, paid prices, favourites, and console completion.

Could you have a quick look and tell me what feels good, what feels confusing, or what would make you use it?

${trackingUrl(target)}

No pressure at all. I am just trying to make it genuinely useful for collectors.`
}

function composerUrl(target) {
  const redditMatch = target.url.match(/reddit\.com\/r\/([^/]+)/i)
  if (!redditMatch) {
    return target.url
  }

  const subreddit = redditMatch[1]
  const title = 'I built a free retro game collection tracker and would love honest feedback'
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/submit?selftext=true&title=${encodeURIComponent(title)}&text=${encodeURIComponent(messageFor(target))}`
}

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const child = spawn('clip.exe')
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`clip.exe exited with ${code}`))
      }
    })
    child.stdin.end(text)
  })
}

function openUrl(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
    })
    child.on('error', reject)
    child.unref()
    resolve()
  })
}

function chooseQueue(targets, progress) {
  return targets
    .filter((target) => statusFor(progress, target) === 'todo')
    .filter((target) => !categoryFilter || target.category.toLowerCase().includes(categoryFilter))
    .filter((target) => !bestOnly || bestFirstIds.has(target.id))
    .sort((a, b) => {
      const bestDelta = Number(bestFirstIds.has(b.id)) - Number(bestFirstIds.has(a.id))
      return bestDelta || a.id - b.id
    })
    .slice(0, limit)
}

function stamp(progress, target, status) {
  progress[target.id] = {
    name: target.name,
    category: target.category,
    status,
    updatedAt: new Date().toISOString(),
    url: target.url,
    trackingUrl: trackingUrl(target),
  }
}

async function main() {
  const targets = parseTargets()
  const progress = loadProgress()
  const queue = chooseQueue(targets, progress)

  if (queue.length === 0) {
    console.log('No outreach targets match the current filters.')
    return
  }

  console.log(`Retro Vault Elite outreach runner`)
  console.log(`Queue: ${queue.length} target${queue.length === 1 ? '' : 's'}`)
  console.log('Enter = mark contacted and open next. s = skip. r = mark replied. q = quit.')
  console.log('The message is copied to clipboard before each target opens.\n')

  const rl = createInterface({ input, output })

  for (const target of queue) {
    const message = messageFor(target)
    const url = composerUrl(target)

    console.log(`\n#${target.id} ${target.name}`)
    console.log(`${target.category}`)
    console.log(url)

    if (dryRun) {
      continue
    }

    await copyToClipboard(message)
    await openUrl(url)
    console.log('Message copied and page/composer opened. Review it, paste if needed, and you hit Send/Post.')

    const answer = (await rl.question('Done? [Enter=contacted, s=skip, r=replied, q=quit] ')).trim().toLowerCase()

    if (answer === 'q') {
      break
    }

    if (answer === 's') {
      stamp(progress, target, 'skipped')
    } else if (answer === 'r') {
      stamp(progress, target, 'replied')
    } else {
      stamp(progress, target, 'contacted')
    }

    saveProgress(progress)
  }

  rl.close()
  if (dryRun) {
    console.log('\nDry-run only. No pages opened and no progress saved.')
  } else {
    saveProgress(progress)
    console.log(`\nProgress saved to ${progressFile}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
