import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateVideo } from './generate-video.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const videoGeneratorDir = path.resolve(__dirname, '..')
const repoRootDir = path.resolve(videoGeneratorDir, '..')
const assetsDir = path.join(repoRootDir, 'video-assets')
const generatedDir = path.join(repoRootDir, 'generated-videos')
const configPath = path.join(assetsDir, 'short-form-videos.json')

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
      continue
    }
    options[key] = next
    index += 1
  }
  return options
}

async function loadConfig() {
  return JSON.parse(await readFile(configPath, 'utf8'))
}

async function ensureDemoAccount(config) {
  const auth = config.auth ?? {}
  const apiBaseUrl = String(config.apiBaseUrl ?? '').trim()
  const email = String(auth.email ?? '').trim().toLowerCase()
  const password = String(auth.password ?? '')
  const displayName = String(auth.displayName ?? 'Video Demo').trim()

  if (!apiBaseUrl || !email || !password) {
    return { ready: false, reason: 'No auth seed configured.' }
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      displayName,
    }),
  })

  if (response.ok || response.status === 409) {
    return { ready: true }
  }

  const payload = await response.json().catch(() => ({}))
  throw new Error(payload.error || `Could not ensure demo account (${response.status}).`)
}

function authActions(config) {
  const auth = config.auth ?? {}
  return [
    { type: 'goto', path: '/' },
    { type: 'wait', ms: 900 },
    {
      type: 'seedAuthSession',
      apiBaseUrl: String(config.apiBaseUrl ?? '').trim(),
      email: String(auth.email ?? '').trim().toLowerCase(),
      password: String(auth.password ?? ''),
      afterMs: 1600,
      waitForMs: 45000,
    },
    { type: 'wait', ms: 1400 },
  ]
}

function searchActions(query, { openDetails = false } = {}) {
  const actions = [
    { type: 'goto', path: '/' },
    { type: 'wait', ms: 1200 },
    { type: 'clickIfVisible', selector: "[data-action='clear-filters']" },
    { type: 'wait', ms: 500 },
    { type: 'click', selector: '#search-input' },
    { type: 'type', selector: '#search-input', text: query, delay: 50 },
    { type: 'wait', ms: 1400 },
  ]

  if (openDetails) {
    actions.push(
      { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='open-details']" },
      { type: 'wait', ms: 1800 },
    )
  }

  return actions
}

function buildHeroScene(video) {
  return {
    id: `${video.slug}-hook`,
    durationMs: 6500,
    overlay: {
      headline: video.hook,
      subheadline: video.subheadline,
    },
    caption: video.captions?.[0] ?? video.hook,
    actions: [
      { type: 'goto', path: '/' },
      { type: 'wait', ms: 1600 },
      { type: 'smoothScroll', by: 380, durationMs: 2200 },
      { type: 'wait', ms: 1500 },
    ],
  }
}

function buildCtaScene(video, config) {
  return {
    id: `${video.slug}-cta`,
    durationMs: 5500,
    overlay: {
      headline: config.defaultCta?.headline ?? 'Take a look and tell me what to build next',
      subheadline: config.defaultCta?.subheadline ?? 'retrovaultelite.com',
    },
    caption: video.captions?.[2] ?? 'Try it, break it, and tell me what to build next.',
    actions: [
      { type: 'goto', path: '/' },
      { type: 'wait', ms: 1000 },
      { type: 'smoothScroll', by: 220, durationMs: 1800 },
      { type: 'wait', ms: 1700 },
    ],
  }
}

function buildStoryScenes(video, config) {
  const query = video.searchTerm
  const edition = video.edition ?? 'loose'

  switch (video.story) {
    case 'collection_add':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-add`,
          durationMs: 8000,
          overlay: {
            headline: 'Add the copy you own',
            subheadline: 'Loose, boxed, CiB, sealed, graded',
          },
          caption: video.captions?.[1] ?? 'Pick the copy you own and keep moving.',
          actions: [
            ...searchActions(query),
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-owned']" },
            { type: 'wait', ms: 700 },
            { type: 'click', selector: `.ownership-picker [data-action='confirm-owned'][data-edition='${edition}']` },
            { type: 'wait', ms: 1600 },
            { type: 'clickIfVisible', selector: "[data-action='trade-prompt-no']" },
            { type: 'wait', ms: 500 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'duplicate_trade':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-duplicate`,
          durationMs: 9500,
          overlay: {
            headline: 'Offer the extra copy',
            subheadline: 'Duplicates can turn into trade stock',
          },
          caption: video.captions?.[1] ?? 'Add the duplicate and offer the spare copy for trade.',
          actions: [
            ...authActions(config),
            { type: 'clickIfVisible', selector: "[data-action='clear-filters']" },
            { type: 'wait', ms: 500 },
            { type: 'click', selector: '#search-input' },
            { type: 'type', selector: '#search-input', text: query, delay: 50 },
            { type: 'wait', ms: 1400 },
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-owned']" },
            { type: 'wait', ms: 700 },
            { type: 'click', selector: `.ownership-picker [data-action='confirm-owned'][data-edition='${edition}']` },
            { type: 'wait', ms: 1200 },
            { type: 'clickIfVisible', selector: "[data-action='trade-prompt-no']" },
            { type: 'wait', ms: 400 },
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-owned']" },
            { type: 'wait', ms: 700 },
            { type: 'click', selector: `.ownership-picker [data-action='confirm-owned'][data-edition='${edition}']` },
            { type: 'wait', ms: 1200 },
            { type: 'clickIfVisible', selector: "[data-action='trade-prompt-yes']" },
            { type: 'wait', ms: 700 },
            { type: 'clickIfVisible', selector: ".trade-prompt-toast [data-action='trade-prompt-pick-copy']" },
            { type: 'wait', ms: 1600 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'wanted_list':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-wanted`,
          durationMs: 8000,
          overlay: {
            headline: 'Wanted lives in the same flow',
            subheadline: 'No separate hunt list app needed',
          },
          caption: video.captions?.[1] ?? 'Mark it wanted without leaving the vault.',
          actions: [
            ...searchActions(query),
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-wanted']" },
            { type: 'wait', ms: 2000 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'trade_matches':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-wanted-trade`,
          durationMs: 9000,
          overlay: {
            headline: 'Wanted games feed trade discovery',
            subheadline: 'Open the inbox and see what is starting to connect',
          },
          caption: video.captions?.[1] ?? 'Wanted games should help surface trade leads.',
          actions: [
            ...authActions(config),
            { type: 'clickIfVisible', selector: "[data-action='clear-filters']" },
            { type: 'wait', ms: 500 },
            { type: 'click', selector: '#search-input' },
            { type: 'type', selector: '#search-input', text: query, delay: 50 },
            { type: 'wait', ms: 1400 },
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-wanted']" },
            { type: 'wait', ms: 1800 },
            { type: 'domClick', selector: "[data-action='trade-open-inbox']" },
            { type: 'wait', ms: 2600 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'spreadsheet_alt':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-search`,
          durationMs: 7500,
          overlay: {
            headline: 'Search, own, wanted, custom',
            subheadline: 'Keep it all in one place',
          },
          caption: video.captions?.[1] ?? 'The point is to keep the collector flow in one place.',
          actions: [
            ...searchActions(query, { openDetails: true }),
            { type: 'clickIfVisible', selector: '.modal-close' },
            { type: 'wait', ms: 700 },
            { type: 'click', selector: "[data-action='open-custom-entry']" },
            { type: 'wait', ms: 900 },
            { type: 'type', selector: "input[name='title']", text: 'Spreadsheet Refuge Demo', delay: 40 },
            { type: 'wait', ms: 1200 },
            { type: 'click', selector: "[data-action='close-custom-entry']" },
            { type: 'wait', ms: 800 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'collector_vision':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-vision`,
          durationMs: 7800,
          overlay: {
            headline: 'Track more than the obvious stuff',
            subheadline: 'Variants, odd entries, wanted lists, trade direction',
          },
          caption: video.captions?.[1] ?? 'The goal is a real collector home base.',
          actions: [
            ...searchActions(query),
            { type: 'smoothScroll', by: 520, durationMs: 2200 },
            { type: 'wait', ms: 1200 },
            { type: 'click', selector: "[data-action='open-custom-entry']" },
            { type: 'wait', ms: 900 },
            { type: 'type', selector: "input[name='title']", text: 'Future Vision Prototype', delay: 40 },
            { type: 'wait', ms: 1400 },
            { type: 'click', selector: "[data-action='close-custom-entry']" },
            { type: 'wait', ms: 700 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'feature_feedback':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-feedback`,
          durationMs: 7800,
          overlay: {
            headline: 'Collector feedback changes the product',
            subheadline: 'That is how custom entries and trade work got here',
          },
          caption: video.captions?.[1] ?? 'Real collector feedback keeps changing the roadmap.',
          actions: [
            ...searchActions(query),
            { type: 'click', selector: "[data-action='open-custom-entry']" },
            { type: 'wait', ms: 900 },
            { type: 'type', selector: "input[name='title']", text: 'Feedback Driven Feature', delay: 40 },
            { type: 'wait', ms: 1200 },
            { type: 'click', selector: "[data-action='close-custom-entry']" },
            { type: 'wait', ms: 700 },
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-wanted']" },
            { type: 'wait', ms: 1200 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'discogs_games':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-detail`,
          durationMs: 8200,
          overlay: {
            headline: 'Scanner, detail, and missing-game flow',
            subheadline: 'That is the path toward deeper collector data',
          },
          caption: video.captions?.[1] ?? 'The long goal is richer collector detail, not just a bare checklist.',
          actions: [
            ...searchActions(query, { openDetails: true }),
            { type: 'wait', ms: 1200 },
            { type: 'clickIfVisible', selector: '.modal-close' },
            { type: 'wait', ms: 600 },
            { type: 'click', selector: "[data-action='open-scanner']" },
            { type: 'wait', ms: 1200 },
            { type: 'clickIfVisible', selector: "[data-action='close-scanner']" },
            { type: 'wait', ms: 600 },
            { type: 'click', selector: "[data-action='open-custom-entry']" },
            { type: 'wait', ms: 700 },
            { type: 'click', selector: "[data-action='close-custom-entry']" },
            { type: 'wait', ms: 700 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'private_trading':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-inbox`,
          durationMs: 8500,
          overlay: {
            headline: 'Discovery and messaging only',
            subheadline: 'Collector-to-collector trading, no middleman',
          },
          caption: video.captions?.[1] ?? 'The site helps collectors discover and message each other. That is it.',
          actions: [
            ...authActions(config),
            { type: 'domClick', selector: "[data-action='trade-open-inbox']" },
            { type: 'wait', ms: 2400 },
            { type: 'smoothScroll', by: 320, durationMs: 1600 },
            { type: 'wait', ms: 1200 },
          ],
        },
        buildCtaScene(video, config),
      ]

    case 'built_for_collectors':
      return [
        buildHeroScene(video),
        {
          id: `${video.slug}-collector-tools`,
          durationMs: 8200,
          overlay: {
            headline: 'Built for real collector habits',
            subheadline: 'Owned, wanted, weird entries, better trade direction',
          },
          caption: video.captions?.[1] ?? 'The goal is simply better collector tools.',
          actions: [
            ...searchActions(query),
            { type: 'domClick', selector: ".catalog-grid .game-card:first-child [data-action='toggle-wanted']" },
            { type: 'wait', ms: 1100 },
            { type: 'click', selector: "[data-action='open-custom-entry']" },
            { type: 'wait', ms: 900 },
            { type: 'type', selector: "input[name='title']", text: 'Collector Grade Demo', delay: 40 },
            { type: 'wait', ms: 1200 },
            { type: 'click', selector: "[data-action='close-custom-entry']" },
            { type: 'wait', ms: 700 },
          ],
        },
        buildCtaScene(video, config),
      ]

    default:
      throw new Error(`Unknown short-form story: ${video.story}`)
  }
}

function buildTemplate(video, config) {
  return {
    type: `short_form_${video.number}`,
    name: video.youtubeTitle,
    baseUrl: config.baseUrl,
    voiceoverScript: video.voiceoverText,
    youtubeTitleOptions: [video.youtubeTitle],
    youtubeDescription: video.youtubeDescription,
    socialPostText: {
      reddit: `${video.redditAdTitle}\n${config.baseUrl}`,
      youtube_shorts: video.youtubeDescription,
      x: `${video.xPost}\n${config.baseUrl}`,
      tiktok: `${video.hook} ${config.baseUrl}`,
    },
    thumbnailTextIdeas: video.thumbnailIdeas,
    defaultFormats: ['vertical_1080x1920'],
    capture: {
      viewport: { width: 1600, height: 900 },
      fps: 30,
      browserChannel: 'msedge',
    },
    scenes: buildStoryScenes(video, config),
  }
}

function buildAggregateText(videos) {
  const captions = videos
    .map((video) => {
      const captionLines = Array.isArray(video.captions) ? video.captions : []
      return [`${String(video.number).padStart(2, '0')} ${video.filename}`, ...video.voiceoverText, ...captionLines]
        .join('\n')
    })
    .join('\n\n---\n\n')

  const redditTitles = videos
    .map((video) => `${String(video.number).padStart(2, '0')}. ${video.redditAdTitle}`)
    .join('\n')

  const youtubeDescriptions = videos
    .map((video) => `${String(video.number).padStart(2, '0')}. ${video.youtubeTitle}\n${video.youtubeDescription}\n`)
    .join('\n')

  const xPosts = videos
    .map((video) => `${String(video.number).padStart(2, '0')}. ${video.xPost}`)
    .join('\n\n')

  return { captions, redditTitles, youtubeDescriptions, xPosts }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const config = await loadConfig()
  await mkdir(path.join(assetsDir, 'music'), { recursive: true })
  await mkdir(path.join(assetsDir, 'screenshots'), { recursive: true })
  await mkdir(generatedDir, { recursive: true })

  if (!args.skipAuthSeed) {
    await ensureDemoAccount(config)
  }

  const selectedVideos = args.only
    ? config.videos.filter((video) => String(video.number) === String(args.only) || video.filename === args.only || video.slug === args.only)
    : config.videos

  if (!selectedVideos.length) {
    throw new Error('No matching videos were found for this run.')
  }

  for (const video of selectedVideos) {
    const template = buildTemplate(video, config)
    const runId = `short-form-${String(video.number).padStart(2, '0')}-${video.slug}`
    const result = await generateVideo({
      templateData: template,
      runId,
      baseUrl: config.baseUrl,
      browserChannel: 'msedge',
    })

    const verticalOutput = result.outputFiles.find((file) => path.basename(file) === 'vertical_1080x1920.mp4')
    if (!verticalOutput) {
      throw new Error(`No vertical output was produced for ${video.filename}.`)
    }

    const finalMp4 = path.join(generatedDir, video.filename)
    const finalSrt = path.join(generatedDir, video.filename.replace(/\.mp4$/i, '.srt'))
    await copyFile(verticalOutput, finalMp4)
    await copyFile(path.join(result.runDir, 'captions.srt'), finalSrt)
  }

  const aggregate = buildAggregateText(selectedVideos)
  await writeFile(path.join(generatedDir, 'captions.txt'), aggregate.captions)
  await writeFile(path.join(generatedDir, 'reddit-ad-titles.txt'), aggregate.redditTitles)
  await writeFile(path.join(generatedDir, 'youtube-shorts-descriptions.txt'), aggregate.youtubeDescriptions)
  await writeFile(path.join(generatedDir, 'x-posts.txt'), aggregate.xPosts)

  if (args.cleanExports) {
    for (const video of selectedVideos) {
      const runId = `short-form-${String(video.number).padStart(2, '0')}-${video.slug}`
      await rm(path.join(videoGeneratorDir, 'exports', runId), { recursive: true, force: true })
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        generatedDir,
        files: selectedVideos.map((video) => video.filename),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
