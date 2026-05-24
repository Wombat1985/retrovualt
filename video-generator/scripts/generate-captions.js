import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTemplate, parseArgs, exportsDir } from './capture-site.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function toSrtTime(ms) {
  const hours = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const minutes = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const millis = String(ms % 1000).padStart(3, '0')
  return `${hours}:${minutes}:${seconds},${millis}`
}

function toAssTime(ms) {
  const hours = Math.floor(ms / 3600000)
  const minutes = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const centiseconds = String(Math.floor((ms % 1000) / 10)).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}.${centiseconds}`
}

function escapeAssText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replaceAll('\n', '\\N')
}

function wrapCaptionText(value, targetLineLength = 30, maxLines = 3) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''

  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= targetLineLength || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)

  if (lines.length <= maxLines) {
    return lines.join('\n')
  }

  const trimmed = []
  for (let index = 0; index < maxLines; index += 1) {
    if (index < maxLines - 1) {
      trimmed.push(lines[index])
      continue
    }
    trimmed.push(`${lines.slice(index).join(' ').replace(/\s+/g, ' ').trim()}`)
  }

  return trimmed.join('\n')
}

function splitCaptionIntoPhrases(value) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const phrases = []
  let current = []
  for (const word of words) {
    current.push(word)
    const joined = current.join(' ')
    const shouldBreak =
      /[.!?,:]$/.test(word) ||
      current.length >= 4 ||
      joined.length >= 18
    if (shouldBreak) {
      phrases.push(joined)
      current = []
    }
  }

  if (current.length) {
    phrases.push(current.join(' '))
  }

  if (phrases.length <= 1) {
    return phrases
  }

  const merged = []
  for (const phrase of phrases) {
    if (!merged.length) {
      merged.push(phrase)
      continue
    }
    if (phrase.length < 8) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${phrase}`.trim()
      continue
    }
    merged.push(phrase)
  }

  return merged
}

function buildCaptionChunks(scene) {
  const phrases = splitCaptionIntoPhrases(scene.caption)
  if (!phrases.length) return []

  const leadInMs = 120
  const leadOutMs = 120
  const startMs = scene.startMs + Math.min(leadInMs, Math.floor(scene.durationMs * 0.08))
  const endMs = scene.endMs - Math.min(leadOutMs, Math.floor(scene.durationMs * 0.08))
  const usableDurationMs = Math.max(phrases.length * 320, endMs - startMs)
  const chunkDurationMs = Math.max(320, Math.floor(usableDurationMs / phrases.length))

  return phrases.map((phrase, index) => {
    const chunkStartMs = Math.min(
      scene.endMs - 220,
      startMs + (chunkDurationMs * index),
    )
    const chunkEndMs = index === phrases.length - 1
      ? endMs
      : Math.min(endMs, chunkStartMs + chunkDurationMs)
    return {
      startMs: chunkStartMs,
      endMs: Math.max(chunkStartMs + 240, chunkEndMs),
      text: phrase,
    }
  })
}

function buildTimeline(template) {
  let cursorMs = 0
  return template.scenes.map((scene) => {
    const startMs = cursorMs
    const durationMs = Number(scene.durationMs ?? 0)
    const endMs = startMs + durationMs
    cursorMs = endMs
    return { ...scene, startMs, endMs, durationMs }
  })
}

async function generateCaptions(template, runDir) {
  const timeline = buildTimeline(template)
  await mkdir(runDir, { recursive: true })

  const srtLines = []
  const assEvents = []

  for (let index = 0; index < timeline.length; index += 1) {
    const scene = timeline[index]
    const captionChunks = buildCaptionChunks(scene)

    if (captionChunks.length) {
      for (const chunk of captionChunks) {
        srtLines.push(
          String(srtLines.filter((line) => /^\d+$/.test(line)).length + 1),
          `${toSrtTime(chunk.startMs)} --> ${toSrtTime(chunk.endMs)}`,
          chunk.text,
          '',
        )
      }
    } else {
      srtLines.push(
        String(srtLines.filter((line) => /^\d+$/.test(line)).length + 1),
        `${toSrtTime(scene.startMs)} --> ${toSrtTime(scene.endMs)}`,
        scene.caption ?? '',
        '',
      )
    }

    if (scene.overlay?.headline) {
      const headline = escapeAssText(wrapCaptionText(scene.overlay.headline, 18, 2))
      const subheadline = scene.overlay.subheadline ? `\\N${escapeAssText(wrapCaptionText(scene.overlay.subheadline, 24, 2))}` : ''
      assEvents.push(
        `Dialogue: 0,${toAssTime(scene.startMs)},${toAssTime(scene.endMs)},Overlay,,0,0,0,,{\\an8\\pos(960,244)\\fad(180,220)}${headline}${subheadline}`,
      )
    }

    if (captionChunks.length) {
      for (const chunk of captionChunks) {
        assEvents.push(
          `Dialogue: 0,${toAssTime(chunk.startMs)},${toAssTime(chunk.endMs)},Caption,,0,0,0,,{\\an2\\pos(960,928)\\fad(70,100)}${escapeAssText(wrapCaptionText(chunk.text, 24, 2))}`,
        )
      }
    } else if (scene.caption) {
      assEvents.push(
        `Dialogue: 0,${toAssTime(scene.startMs)},${toAssTime(scene.endMs)},Caption,,0,0,0,,{\\an2\\pos(960,928)\\fad(90,120)}${escapeAssText(wrapCaptionText(scene.caption, 24, 2))}`,
      )
    }
  }

  const assBody = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'WrapStyle: 2',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Overlay,Arial,50,&H00FFFFFF,&H000000FF,&H00101827,&HA8000000,1,0,0,0,100,100,0,0,3,0,0,8,180,180,110,1',
    'Style: Caption,Arial,40,&H00FFFFFF,&H000000FF,&H00101827,&HB8000000,1,0,0,0,100,100,0,0,3,0,0,2,220,220,86,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...assEvents,
    '',
  ].join('\n')

  const srtPath = path.join(runDir, 'captions.srt')
  const assPath = path.join(runDir, 'overlays.ass')
  const voiceoverPath = path.join(runDir, 'voiceover-script.txt')

  await writeFile(srtPath, srtLines.join('\n'))
  await writeFile(assPath, assBody)
  await writeFile(voiceoverPath, template.voiceoverScript.join('\n\n'))

  return { srtPath, assPath, timeline, voiceoverPath }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const template = await loadTemplate(args.template ?? args.type ?? 'youtube-demo')
  const runDir = args.runDir ? path.resolve(args.runDir) : path.join(exportsDir, args.runId ?? `${template.type}-preview`)
  const result = await generateCaptions(template, runDir)
  console.log(JSON.stringify(result, null, 2))
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMainModule) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

export { buildTimeline, generateCaptions }
