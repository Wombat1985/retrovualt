# Retro Vault Elite Video Generator

This folder creates repeatable promo videos, feature demos, and social video exports for [Retro Vault Elite](https://www.retrovaultelite.com/).

It is built to:

- capture real website footage with Playwright
- assemble clips with FFmpeg
- burn in large readable overlays
- burn in on-screen captions and export caption files
- output reusable voiceover text and post copy
- add background music automatically

## Folder layout

```text
video-generator/
  assets/
    logo.png
    brand-colors.json
    music/
    screenshots/
  scripts/
    capture-site.js
    generate-video.js
    generate-captions.js
  templates/
    youtube-demo.json
    short-ad.json
    trade-feature.json
    collection-tracker.json
    beta-announcement.json
    reel.json
    reddit-demo.json
  exports/
```

## What it generates

For each run, the system writes to a timestamped folder inside `video-generator/exports/`:

- recorded clip files
- `captions.srt`
- `overlays.ass`
- `voiceover-script.txt`
- `youtube-title.txt`
- `youtube-description.txt`
- `social-posts.md`
- `thumbnail-ideas.txt`
- one or more final `.mp4` exports

## Captions and music

Rendered videos now include:

- big burned-in overlay text
- burned-in subtitle captions near the bottom of the frame
- background audio

Music behavior:

- if you drop a real music file into `video-generator/assets/music/`, the renderer will use that first
- supported formats: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`
- if there is no music file yet, the renderer falls back to a simple generated retro synth bed so exports are not silent

## Supported video types

- `full_youtube_demo`
- `short_ad`
- `trade_feature`
- `collection_tracker`
- `beta_announcement`

## Supported export formats

- `landscape_1080p` -> `1920x1080`
- `vertical_1080x1920` -> Shorts / Reels
- `square_1080x1080` -> feed ads
- `feed_1080x1350` -> portrait feed posts

## Setup

From the repo root:

```powershell
npm install
npx playwright install chromium
```

The project already includes:

- `playwright`
- `ffmpeg-static`

If you want to use a system browser instead of Playwright's Chromium, you can pass:

```powershell
--browserChannel msedge
```

on Windows, or:

```powershell
--browserChannel chrome
```

if Chrome is available.

## Quick start

### 1. Capture only

```powershell
npm run video:capture -- --type full_youtube_demo
```

### 2. Generate a full YouTube demo

```powershell
npm run video:demo
```

### 3. Generate a short social ad

```powershell
npm run video:short
```

### 4. Generate a custom video type

```powershell
npm run video:generate -- --type trade_feature --formats vertical_1080x1920,landscape_1080p
```

### 5. Re-render an existing capture without capturing again

```powershell
npm run video:generate -- --skipCapture --runDir video-generator/exports/full_youtube_demo-2026-05-01_14-30-00
```

## Template editing

Templates live in `video-generator/templates/`.

Each template can define:

- `voiceoverScript`
- `youtubeTitleOptions`
- `youtubeDescription`
- `socialPostText`
- `thumbnailTextIdeas`
- `defaultFormats`
- `scenes`

Each scene supports:

- `durationMs`
- `overlay.headline`
- `overlay.subheadline`
- `caption`
- `actions`

Supported action types:

- `goto`
- `wait`
- `click`
- `type`
- `press`
- `hover`
- `smoothScroll`
- `moveMouse`

## Tips for good footage

- keep the site loaded before capture
- use stable selectors in templates
- prefer shorter, clearer scenes over one giant take
- for Shorts/Reels, let the overlays do more of the storytelling
- use the long-form demo template for slower, more legible walkthroughs

## Music

Drop optional background music into:

```text
video-generator/assets/music/
```

Music is auto-mixed now. For best results, replace the generated fallback bed with your own licensed track in `video-generator/assets/music/`.

## First deliverables included

- working capture script
- one 60-90 second YouTube demo template
- one 15-30 second ad template
- one 9:16 export path for Shorts / Reels
- one README with exact setup and run steps
