import ffmpegPath from 'ffmpeg-static'
import { mkdir, writeFile, access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { captureTemplate, exportsDir, loadTemplate, parseArgs } from './capture-site.js'
import { buildTimeline, generateCaptions } from './generate-captions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const repoRootDir = path.resolve(rootDir, '..')
const musicDir = path.join(rootDir, 'assets', 'music')
const sharedMusicDir = path.join(repoRootDir, 'video-assets', 'music')

const formatPresets = {
  landscape_1080p: { width: 1920, height: 1080, mode: 'crop' },
  vertical_1080x1920: { width: 1080, height: 1920, mode: 'blur-pad' },
  square_1080x1080: { width: 1080, height: 1080, mode: 'blur-pad' },
  feed_1080x1350: { width: 1080, height: 1350, mode: 'blur-pad' },
}

function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { cwd, stdio: 'inherit' })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`FFmpeg exited with code ${code}`))
    })
  })
}

async function findMusicTrack() {
  const audioExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg'])
  for (const dir of [sharedMusicDir, musicDir]) {
    try {
      const files = await readdir(dir)
      const track = files.find((file) => audioExtensions.has(path.extname(file).toLowerCase()))
      if (track) {
        return path.join(dir, track)
      }
    } catch {
      // Keep checking fallback locations.
    }
  }

  return null
}

function getFallbackMusicFilter(durationSeconds) {
  const safeDuration = Math.max(2, durationSeconds)
  const bars = [
    '220',
    '246.94',
    '261.63',
    '293.66',
    '329.63',
    '293.66',
    '261.63',
    '246.94',
  ]
  const progression = bars
    .map((freq, index) => `if(between(mod(t\\,16)\\,${index * 2}\\,${index * 2 + 2})\\,${freq}\\,`)
    .join('')
  const closeParens = ')'.repeat(bars.length)
  const bassFreq = `${progression}220${closeParens}`
  const leadFreq = `(${bassFreq})*2`
  const arpFreq = `(${bassFreq})*4`
  const beatGate = '(lt(mod(t\\,0.5)\\,0.11)*0.95+lt(mod(t+0.25\\,0.5)\\,0.06)*0.45)'
  const pulseGate = '(0.32+0.68*lt(mod(t\\,0.25)\\,0.12))'
  const bass = `0.11*sin(2*PI*(${bassFreq})*t)*(0.52+0.48*${beatGate})`
  const chord = `0.06*sin(2*PI*((${bassFreq})*1.5)*t)`
  const lead = `0.035*sgn(sin(2*PI*(${leadFreq})*t))*${pulseGate}`
  const arp = `0.026*sin(2*PI*(${arpFreq})*t)*(0.45+0.55*lt(mod(t\\,0.125)\\,0.055))`
  const kick = `0.09*exp(-24*mod(t\\,0.5))*sin(2*PI*58*t)*lt(mod(t\\,0.5)\\,0.11)`
  const snare = `0.018*(2*random(1)-1)*exp(-32*mod(t+0.25\\,0.5))*lt(mod(t+0.25\\,0.5)\\,0.07)`
  const left = `${bass}+${chord}+${lead}+${arp}+${kick}+${snare}`
  const right = `${bass}+${chord}+(${lead})*0.92+(${arp})*1.08+${kick}+${snare}`
  return `aevalsrc=${left}|${right}:s=44100:d=${safeDuration.toFixed(3)}`
}

function getFilterForPreset(presetName, assFileName) {
  const preset = formatPresets[presetName]
  if (!preset) {
    throw new Error(`Unknown format preset: ${presetName}`)
  }

  const escapedAss = assFileName.replaceAll('\\', '/')

  if (preset.mode === 'crop') {
    return {
      useComplex: false,
      value: `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=increase,crop=${preset.width}:${preset.height},ass=${escapedAss}`,
    }
  }

  return {
    useComplex: true,
    value: `[0:v]scale=${preset.width}:${preset.height}:force_original_aspect_ratio=increase,crop=${preset.width}:${preset.height},boxblur=18[bg];` +
      `[0:v]scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,ass=${escapedAss}[v]`,
  }
}

async function createConcatFile(runDir, manifest) {
  const lines = manifest.clips.map((clip) => `file '${clip.file.replaceAll("'", "'\\''")}'`)
  const concatPath = path.join(runDir, 'concat.txt')
  await writeFile(concatPath, lines.join('\n'))
  return concatPath
}

async function normalizeClips(runDir, manifest) {
  const normalizedDir = path.join(runDir, 'normalized')
  await mkdir(normalizedDir, { recursive: true })

  const normalizedClips = []
  for (const clip of manifest.clips) {
    const sourcePath = path.join(runDir, clip.file)
    const outputName = path.basename(clip.file, path.extname(clip.file)) + '.mp4'
    const outputPath = path.join(normalizedDir, outputName)
    const durationSeconds = Math.max(0.5, Number(clip.durationMs ?? 0) / 1000)

    await runFfmpeg(
      [
        '-y',
        '-i', sourcePath,
        '-t', durationSeconds.toFixed(3),
        '-vf', 'fps=30,setpts=PTS-STARTPTS',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        outputPath,
      ],
      runDir,
    )

    normalizedClips.push({
      ...clip,
      file: path.relative(runDir, outputPath).replaceAll('\\', '/'),
    })
  }

  return {
    ...manifest,
    clips: normalizedClips,
  }
}

async function writeMetadataFiles(template, runDir, audioMode, musicTrackPath) {
  const titlePath = path.join(runDir, 'youtube-title.txt')
  const descriptionPath = path.join(runDir, 'youtube-description.txt')
  const socialPath = path.join(runDir, 'social-posts.md')
  const thumbnailPath = path.join(runDir, 'thumbnail-ideas.txt')
  const manifestPath = path.join(runDir, 'video-metadata.json')

  await writeFile(titlePath, template.youtubeTitleOptions.join('\n'))
  await writeFile(descriptionPath, template.youtubeDescription)
  await writeFile(
    socialPath,
    Object.entries(template.socialPostText)
      .map(([channel, text]) => `## ${channel}\n${text}\n`)
      .join('\n'),
  )
  await writeFile(thumbnailPath, template.thumbnailTextIdeas.join('\n'))
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        type: template.type,
        audioMode,
        musicTrack: musicTrackPath ? path.relative(runDir, musicTrackPath).replaceAll('\\', '/') : null,
        youtubeTitleOptions: template.youtubeTitleOptions,
        youtubeDescription: template.youtubeDescription,
        socialPostText: template.socialPostText,
        thumbnailTextIdeas: template.thumbnailTextIdeas,
      },
      null,
      2,
    ),
  )
}

async function renderFormats(runDir, formats, totalDurationMs) {
  const durationSeconds = Math.max(0.5, totalDurationMs / 1000)
  const musicTrackPath = await findMusicTrack()
  const audioMode = musicTrackPath ? 'music-file' : 'generated-retro-track'
  const outputs = []
  for (const presetName of formats) {
    const filter = getFilterForPreset(presetName, 'overlays.ass')
    const outputName = `${presetName}.mp4`
    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
    ]

    if (musicTrackPath) {
      args.push('-stream_loop', '-1', '-i', musicTrackPath)
    } else {
      args.push('-f', 'lavfi', '-i', getFallbackMusicFilter(durationSeconds))
    }

    if (filter.useComplex) {
      args.push(
        '-filter_complex', filter.value,
        '-map', '[v]',
      )
    } else {
      args.push(
        '-vf', filter.value,
        '-map', '0:v:0',
      )
    }

    args.push(
      '-map', '1:a:0',
      '-af', `volume=0.85,highpass=f=40,lowpass=f=9000,acompressor=threshold=-18dB:ratio=2.5:attack=20:release=180,afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0, durationSeconds - 1.5).toFixed(3)}:d=1.5`,
      '-r', '30',
      '-shortest',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-preset', 'medium',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      outputName,
    )

    await runFfmpeg(args, runDir)
    outputs.push(path.join(runDir, outputName))
  }
  return { outputs, audioMode, musicTrackPath }
}

async function generateVideo(options = {}) {
  const template = options.templateData ?? await loadTemplate(options.template ?? options.type ?? 'youtube-demo')
  const requestedFormats = options.formats?.length ? options.formats : template.defaultFormats
  const captureResult = options.skipCapture
    ? {
        runDir: options.runDir,
        manifest: JSON.parse(await readFile(path.join(options.runDir, 'capture-manifest.json'), 'utf8')),
      }
    : await captureTemplate(template, options)

  const runDir = captureResult.runDir
  await mkdir(runDir, { recursive: true })
  const normalizedManifest = await normalizeClips(runDir, captureResult.manifest)
  await writeFile(path.join(runDir, 'normalized-manifest.json'), JSON.stringify(normalizedManifest, null, 2))
  await createConcatFile(runDir, normalizedManifest)
  await generateCaptions(template, runDir)
  const totalDurationMs = buildTimeline(template).reduce((total, scene) => total + scene.durationMs, 0)
  const renderResult = await renderFormats(runDir, requestedFormats, totalDurationMs)
  await writeMetadataFiles(template, runDir, renderResult.audioMode, renderResult.musicTrackPath)

  return {
    runDir,
    outputFiles: renderResult.outputs,
    totalDurationMs,
    formats: requestedFormats,
    audioMode: renderResult.audioMode,
  }
}

async function main() {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static is not installed.')
  }

  const args = parseArgs(process.argv.slice(2))
  const formats = args.formats ? String(args.formats).split(',').map((value) => value.trim()).filter(Boolean) : undefined
  const runDir = args.runDir ? path.resolve(args.runDir) : undefined
  if (args.skipCapture && runDir) {
    await access(path.join(runDir, 'capture-manifest.json'))
  }

  const result = await generateVideo({
    type: args.type,
    template: args.template,
    formats,
    runDir,
    runId: args.runId,
    baseUrl: args.baseUrl,
    browserChannel: args.browserChannel,
    skipCapture: Boolean(args.skipCapture),
  })
  console.log(JSON.stringify(result, null, 2))
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMainModule) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

export { generateVideo, formatPresets }
