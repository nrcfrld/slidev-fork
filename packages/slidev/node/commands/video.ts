import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { promisify } from 'node:util'
import { slash } from '@antfu/utils'
import { dirname, join, relative, resolve } from 'pathe'
import { createSlidevProgress, importPlaywright } from './export'
import { installVirtualClock } from './videoClock'

export interface VideoExportOptions {
  port: number
  base?: string
  output: string
  format: 'mp4' | 'webm'
  /**
   * Time each click step is shown, in ms
   */
  stepDuration: number
  fps: number
  width: number
  height: number
  scale: number
  dark: boolean
  timeout: number
  routerMode?: 'hash' | 'history'
  executablePath?: string
  /**
   * First and last slide to record
   */
  range?: [number, number]
}

const execFileAsync = promisify(execFile)

export async function findFfmpeg(): Promise<string> {
  const candidate = process.env.SLIDEV_FFMPEG || 'ffmpeg'
  try {
    await execFileAsync(candidate, ['-version'])
    return candidate
  }
  catch {
    throw new Error(`[slidev] Exporting video needs ffmpeg. Install it (for example \`brew install ffmpeg\` or \`apt install ffmpeg\`), or point SLIDEV_FFMPEG to it.`)
  }
}

/**
 * Plays the deck in a browser, click step by click step, and renders it frame
 * by frame on a virtual clock, transitions and animations included.
 */
export async function exportVideo(options: VideoExportOptions) {
  const ffmpeg = await findFfmpeg()
  const output = resolve(options.output.endsWith(`.${options.format}`)
    ? options.output
    : `${options.output}.${options.format}`)
  const framesDir = await fs.mkdtemp(join(os.tmpdir(), 'slidev-video-'))

  const { chromium } = await importPlaywright()
  const browser = await chromium.launch({ executablePath: options.executablePath })
  const progress = createSlidevProgress()
  let frameCount = 0

  try {
    // Size the viewport to the video and let Slidev scale the slide up to it
    const width = Math.round(options.width * options.scale)
    const height = Math.round(options.height * options.scale)
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    })
    await context.addInitScript(installVirtualClock)
    const page = await context.newPage()
    await page.emulateMedia({
      colorScheme: options.dark ? 'dark' : 'light',
      reducedMotion: 'no-preference',
    })

    const start = options.range?.[0] ?? 1
    const base = options.base ?? '/'
    const url = options.routerMode === 'hash'
      ? `http://localhost:${options.port}${base}#/${start}`
      : `http://localhost:${options.port}${base}${start}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: options.timeout })
    const frameMs = 1000 / options.fps
    const advance = (ms: number) => page.evaluate(ms => (window as any).__slidevVideoClock.advance(ms), ms)

    // Startup waits on timers and animation frames, which only run as the virtual clock advances
    const deadline = Date.now() + options.timeout
    while (!await page.evaluate(() => !!(window as any).__slidev__?.nav)) {
      if (Date.now() > deadline)
        throw new Error('[slidev] Timed out waiting for the slides to load')
      await advance(50)
      await new Promise(r => setTimeout(r, 20))
    }
    await page.evaluate(() => document.fonts.ready)
    // Let the slides near the start load and their timers run, so the video doesn't open on loading states
    for (let t = 0; t < 1000; t += 100)
      await advance(100)
    await page.waitForLoadState('networkidle')

    const total = await page.evaluate((range) => {
      const nav = (window as any).__slidev__.nav
      const last = range?.[1] ?? nav.total
      return nav.slides.filter((s: any) => s.no >= nav.currentSlideNo && s.no <= last).length
    }, options.range)
    progress.start(total)

    const cdp = await context.newCDPSession(page)
    const framesPerStep = Math.max(1, Math.round(options.stepDuration / frameMs))
    async function renderStep() {
      for (let i = 0; i < framesPerStep; i++) {
        await advance(frameMs)
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true })
        await fs.writeFile(join(framesDir, `${String(frameCount++).padStart(6, '0')}.jpg`), data, 'base64')
      }
    }

    await renderStep()
    while (true) {
      const state = await page.evaluate((range) => {
        const nav = (window as any).__slidev__.nav
        const last = range?.[1] ?? nav.total
        const done = !nav.hasNext || (nav.currentSlideNo >= last && nav.clicks >= nav.clicksTotal)
        return { done, no: nav.currentSlideNo }
      }, options.range)
      progress.update(state.no - start + 1)
      if (state.done)
        break
      // Not awaited: navigation waits on timers, which only run as the clock advances
      await page.evaluate(() => {
        (window as any).__slidev__.nav.next()
      })
      await renderStep()
    }
  }
  finally {
    progress.stop()
    await browser.close()
  }

  try {
    if (!frameCount)
      throw new Error('[slidev] No frames were rendered')
    await encode(ffmpeg, framesDir, output, options)
  }
  finally {
    await fs.rm(framesDir, { recursive: true, force: true })
  }

  const relativeOutput = slash(relative('.', output))
  return relativeOutput.startsWith('.')
    ? relativeOutput
    : `./${relativeOutput}`
}

async function encode(ffmpeg: string, dir: string, output: string, options: VideoExportOptions) {
  await fs.mkdir(dirname(output), { recursive: true })

  const codec = options.format === 'mp4'
    ? [
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '16',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      ]
    : [
        '-c:v',
        'libvpx-vp9',
        '-crf',
        '24',
        '-b:v',
        '0',
        '-row-mt',
        '1',
        '-pix_fmt',
        'yuv420p',
      ]
  const args = [
    '-y',
    '-framerate',
    String(options.fps),
    '-i',
    join(dir, '%06d.jpg'),
    // Even dimensions for the encoders
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    ...codec,
    output,
  ]

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(ffmpeg, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', d => stderr = (stderr + d).slice(-4000))
    child.on('error', reject)
    child.on('close', code => code === 0
      ? resolvePromise()
      : reject(new Error(`[slidev] ffmpeg failed with exit code ${code}:\n${stderr}`)))
  })
}
