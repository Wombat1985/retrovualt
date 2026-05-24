import { chromium } from 'playwright'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const templatesDir = path.join(rootDir, 'templates')
const exportsDir = path.join(rootDir, 'exports')
const AUTH_TOKEN_STORAGE_KEY = 'retro-game-collector-auth-token'
const AUTH_PROFILE_STORAGE_KEY = 'retro-game-collector-auth-profile'

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

async function loadTemplate(templateInput) {
  const normalizedInput = String(templateInput)
  const candidateNames = normalizedInput.endsWith('.json')
    ? [normalizedInput]
    : [
        `${normalizedInput}.json`,
        `${normalizedInput.replaceAll('_', '-')}.json`,
      ]

  let templatePath = null
  let templateSource = null

  for (const candidateName of candidateNames) {
    const candidatePath = path.isAbsolute(candidateName) ? candidateName : path.join(templatesDir, candidateName)
    try {
      templateSource = await readFile(candidatePath, 'utf8')
      templatePath = candidatePath
      break
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  if (!templatePath || templateSource === null) {
    const templateFiles = (await readdir(templatesDir)).filter((file) => file.endsWith('.json'))
    for (const templateFile of templateFiles) {
      const candidatePath = path.join(templatesDir, templateFile)
      const candidateSource = await readFile(candidatePath, 'utf8')
      const candidateTemplate = JSON.parse(candidateSource)
      if (candidateTemplate.type === normalizedInput) {
        templatePath = candidatePath
        templateSource = candidateSource
        break
      }
    }
  }

  if (!templatePath || templateSource === null) {
    throw new Error(`Template "${templateInput}" was not found in ${templatesDir}.`)
  }

  const template = JSON.parse(templateSource)
  if (template.extends) {
    const parent = await loadTemplate(template.extends)
    return {
      ...parent,
      ...template,
      capture: { ...(parent.capture ?? {}), ...(template.capture ?? {}) },
      socialPostText: { ...(parent.socialPostText ?? {}), ...(template.socialPostText ?? {}) },
      scenes: template.scenes ?? parent.scenes,
      voiceoverScript: template.voiceoverScript ?? parent.voiceoverScript,
      youtubeTitleOptions: template.youtubeTitleOptions ?? parent.youtubeTitleOptions,
      thumbnailTextIdeas: template.thumbnailTextIdeas ?? parent.thumbnailTextIdeas,
      defaultFormats: template.defaultFormats ?? parent.defaultFormats,
    }
  }
  return template
}

function createRunSlug(templateType) {
  return `${templateType}-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}`
}

async function launchBrowser(preferredChannel) {
  const candidates = [preferredChannel, process.platform === 'win32' ? 'msedge' : 'chrome', undefined]
  let lastError = null
  for (const channel of candidates) {
    try {
      return await chromium.launch({
        channel,
        headless: true,
      })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Could not launch a browser for capture.')
}

async function smoothScroll(page, options = {}) {
  const by = Number(options.by ?? 0)
  const x = options.x !== undefined ? Number(options.x) : null
  const y = options.y !== undefined ? Number(options.y) : null
  const durationMs = Number(options.durationMs ?? 1600)
  await page.evaluate(
    async ({ by: deltaY, x: targetX, y: targetY, durationMs: duration }) => {
      const startX = window.scrollX
      const startY = window.scrollY
      const finalX = targetX ?? startX
      const finalY = targetY ?? (startY + deltaY)
      const start = performance.now()
      const ease = (t) => 1 - Math.pow(1 - t, 3)
      await new Promise((resolve) => {
        function step(now) {
          const progress = Math.min(1, (now - start) / duration)
          const eased = ease(progress)
          window.scrollTo(
            startX + (finalX - startX) * eased,
            startY + (finalY - startY) * eased,
          )
          if (progress < 1) {
            requestAnimationFrame(step)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(step)
      })
    },
    { by, x, y, durationMs },
  )
}

async function dismissBlockingOverlays(page) {
  const closeSelectors = [
    '.modal-close',
    '[data-action="close-details"]',
    '[data-action="close-custom-entry"]',
    '.game-modal-backdrop',
    '.modal-backdrop',
    '.scanner-modal [data-action="close-details"]',
  ]

  for (const selector of closeSelectors) {
    const locator = page.locator(selector).first()
    if (await locator.count() === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    await locator.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(120)
  }

  await page.keyboard.press('Escape').catch(() => {})
}

async function isSignedIn(page) {
  const signedInSelectors = [
    "[data-action='open-account-settings']",
    "[data-action='trade-open-inbox']",
  ]

  for (const selector of signedInSelectors) {
    const locator = page.locator(selector).first()
    if (await locator.isVisible().catch(() => false)) {
      return true
    }
  }

  return false
}

async function authLogin(page, action) {
  const email = String(action.email ?? '').trim()
  const password = String(action.password ?? '')

  if (!email || !password) {
    throw new Error('authLogin requires email and password.')
  }

  if (await isSignedIn(page)) {
    await page.waitForTimeout(Number(action.afterMs ?? 300))
    return
  }

  const authForm = page.locator("form[data-auth-form='login']").first()
  if (!(await authForm.isVisible().catch(() => false))) {
    const openLogin = page.locator("[data-action='open-login']").first()
    if (await openLogin.isVisible().catch(() => false)) {
      await openLogin.click({ timeout: Number(action.timeoutMs ?? 30000) })
    }
  }

  await page.waitForFunction(() => {
    return Boolean(
      document.querySelector("form[data-auth-form='login'] input[name='email']") &&
      document.querySelector("form[data-auth-form='login'] input[name='password']"),
    )
  }, undefined, { timeout: Number(action.timeoutMs ?? 30000) })

  await page.locator("form[data-auth-form='login'] input[name='email']").first().fill(email)
  await page.locator("form[data-auth-form='login'] input[name='password']").first().fill(password)
  await page.locator("form[data-auth-form='login'] button[type='submit']").first().click({
    timeout: Number(action.timeoutMs ?? 30000),
  })

  await page.waitForFunction(() => {
    const isVisible = (element) => {
      if (!element) return false
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    const accountButton = document.querySelector("[data-action='open-account-settings']")
    const tradeButton = document.querySelector("[data-action='trade-open-inbox']")
    const loginForm = document.querySelector("form[data-auth-form='login']")
    return (isVisible(accountButton) || isVisible(tradeButton)) && !isVisible(loginForm)
  }, undefined, { timeout: Number(action.waitForMs ?? 30000) })

  await page.waitForTimeout(Number(action.afterMs ?? 800))
}

async function seedAuthSession(page, action) {
  const apiBaseUrl = String(action.apiBaseUrl ?? '').trim().replace(/\/$/, '')
  const email = String(action.email ?? '').trim().toLowerCase()
  const password = String(action.password ?? '')

  if (!apiBaseUrl || !email || !password) {
    throw new Error('seedAuthSession requires apiBaseUrl, email, and password.')
  }

  await page.evaluate(
    async ({ apiBaseUrl: targetApiBaseUrl, email: targetEmail, password: targetPassword, authTokenStorageKey, authProfileStorageKey }) => {
      const response = await fetch(`${targetApiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: targetEmail,
          password: targetPassword,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || typeof payload?.token !== 'string' || !payload?.user) {
        throw new Error(payload?.error || `Could not sign in demo account (${response.status}).`)
      }

      localStorage.setItem(authTokenStorageKey, payload.token)
      localStorage.setItem(
        authProfileStorageKey,
        JSON.stringify({
          email: payload.user.email ?? targetEmail,
          displayName: payload.user.displayName ?? '',
        }),
      )
    },
    {
      apiBaseUrl,
      email,
      password,
      authTokenStorageKey: AUTH_TOKEN_STORAGE_KEY,
      authProfileStorageKey: AUTH_PROFILE_STORAGE_KEY,
    },
  )

  await page.reload({ waitUntil: 'domcontentloaded', timeout: Number(action.timeoutMs ?? 60000) })
  await page.waitForFunction(() => {
    const isVisible = (element) => {
      if (!element) return false
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    return isVisible(document.querySelector("[data-action='open-account-settings']")) ||
      isVisible(document.querySelector("[data-action='trade-open-inbox']"))
  }, undefined, { timeout: Number(action.waitForMs ?? 30000) })

  await page.waitForTimeout(Number(action.afterMs ?? 600))
}

async function runAction(page, action, baseUrl) {
  const getLocator = () => page.locator(action.selector).first()

  switch (action.type) {
    case 'goto':
      await page.goto(new URL(action.path ?? '/', action.url ?? baseUrl).toString(), {
        waitUntil: action.waitUntil ?? 'domcontentloaded',
        timeout: Number(action.timeoutMs ?? 60000),
      })
      break
    case 'wait':
      await page.waitForTimeout(Number(action.ms ?? 1000))
      break
    case 'click':
      await retryLocatorAction(page, async () => {
        await getLocator().click({
          delay: Number(action.delay ?? 50),
          force: Boolean(action.force),
          timeout: Number(action.timeoutMs ?? 30000),
        })
      })
      break
    case 'type': {
      const locator = getLocator()
      if (action.clear !== false) {
        await locator.fill('')
      }
      await locator.type(String(action.text ?? ''), { delay: Number(action.delay ?? 45) })
      break
    }
    case 'press':
      await retryLocatorAction(page, async () => {
        await getLocator().press(String(action.key ?? 'Enter'), {
          timeout: Number(action.timeoutMs ?? 30000),
        })
      })
      break
    case 'hover':
      await retryLocatorAction(page, async () => {
        await getLocator().hover({ timeout: Number(action.timeoutMs ?? 30000) })
      })
      break
    case 'smoothScroll':
      await smoothScroll(page, action)
      break
    case 'moveMouse':
      await page.mouse.move(Number(action.x ?? 0), Number(action.y ?? 0), { steps: Number(action.steps ?? 24) })
      break
    case 'clickIfVisible': {
      const locator = getLocator()
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({
          delay: Number(action.delay ?? 30),
          force: Boolean(action.force),
          timeout: Number(action.timeoutMs ?? 30000),
        })
      }
      break
    }
    case 'domClick':
      await page.waitForSelector(action.selector, {
        state: action.waitForState ?? 'attached',
        timeout: Number(action.timeoutMs ?? 30000),
      })
      await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        if (!(element instanceof HTMLElement)) {
          throw new Error(`Could not find clickable element for selector: ${selector}`)
        }
        element.click()
      }, action.selector)
      break
    case 'authLogin':
      await authLogin(page, action)
      break
    case 'seedAuthSession':
      await seedAuthSession(page, action)
      break
    default:
      throw new Error(`Unsupported action type: ${action.type}`)
  }
}

async function retryLocatorAction(page, actionRunner, retries = 4) {
  let lastError = null
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await actionRunner()
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const isRetryable =
        message.includes('detached from the DOM') ||
        message.includes('element was detached') ||
        message.includes('Element is not attached') ||
        message.includes('intercepts pointer events')

      if (message.includes('intercepts pointer events')) {
        await dismissBlockingOverlays(page)
      }

      if (!isRetryable || attempt === retries - 1) {
        throw error
      }
    }
  }
  throw lastError ?? new Error('Locator action failed.')
}

async function captureTemplate(template, options = {}) {
  const runId = options.runId ?? createRunSlug(template.type)
  const runDir = path.join(exportsDir, runId)
  const rawDir = path.join(runDir, 'raw')
  await mkdir(rawDir, { recursive: true })

  const browser = await launchBrowser(options.browserChannel ?? template.capture?.browserChannel)
  const manifest = {
    templateType: template.type,
    runId,
    baseUrl: options.baseUrl ?? template.baseUrl,
    clips: [],
  }

  try {
    for (let index = 0; index < template.scenes.length; index += 1) {
      const scene = template.scenes[index]
      const sceneVideoDir = path.join(rawDir, `scene-${String(index + 1).padStart(2, '0')}`)
      await rm(sceneVideoDir, { recursive: true, force: true })
      await mkdir(sceneVideoDir, { recursive: true })

      const context = await browser.newContext({
        viewport: template.capture?.viewport ?? { width: 1600, height: 900 },
        recordVideo: {
          dir: sceneVideoDir,
          size: template.capture?.viewport ?? { width: 1600, height: 900 },
        },
        colorScheme: 'dark',
      })

      const page = await context.newPage()
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      for (const action of scene.actions) {
        await runAction(page, action, options.baseUrl ?? template.baseUrl)
      }
      await page.waitForTimeout(Number(scene.tailMs ?? 500))
      await context.close()

      const recordedFiles = await readdir(sceneVideoDir)
      const sourceVideo = recordedFiles.find((file) => file.endsWith('.webm'))
      if (!sourceVideo) {
        throw new Error(`No recorded clip was produced for scene ${scene.id}.`)
      }

      const finalName = `clip-${String(index + 1).padStart(2, '0')}-${scene.id}.webm`
      const finalPath = path.join(rawDir, finalName)
      await rename(path.join(sceneVideoDir, sourceVideo), finalPath)
      await rm(sceneVideoDir, { recursive: true, force: true })

      manifest.clips.push({
        sceneId: scene.id,
        file: path.relative(runDir, finalPath).replaceAll('\\', '/'),
        durationMs: Number(scene.durationMs ?? 0),
        caption: scene.caption ?? '',
        overlay: scene.overlay ?? null,
      })
    }
  } finally {
    await browser.close()
  }

  await writeFile(path.join(runDir, 'capture-manifest.json'), JSON.stringify(manifest, null, 2))
  return { runDir, manifest }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const template = await loadTemplate(args.template ?? args.type ?? 'youtube-demo')
  const result = await captureTemplate(template, {
    runId: args.runId,
    baseUrl: args.baseUrl,
    browserChannel: args.browserChannel,
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

export { captureTemplate, loadTemplate, parseArgs, exportsDir, templatesDir }
