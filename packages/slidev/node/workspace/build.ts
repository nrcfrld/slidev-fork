/* eslint-disable no-console -- terminal output of a CLI command */
import type { BuildArgs, ResolvedSlidevOptions } from '@slidev/types'
import type { ResolvedWorkspace, WorkspaceDeck } from '.'
import fs from 'node:fs/promises'
import http from 'node:http'
import process from 'node:process'
import { bold, cyan, dim, green, red, yellow } from 'ansis'
import connect from 'connect'
import { getPort } from 'get-port-please'
import { join, relative, resolve } from 'pathe'
import sirv from 'sirv'
import { build } from '../commands/build'
import { resolveOptions } from '../options'
import { renderWorkspacePage } from './page'
import { COVERS_CACHE_DIR } from './serve'

export interface WorkspaceBuildArgs extends Omit<BuildArgs, 'entry'> {
  'covers': boolean
  'theme'?: string
  'router-mode'?: 'hash' | 'history' | 'memory'
}

export async function buildWorkspace(workspace: ResolvedWorkspace, args: WorkspaceBuildArgs) {
  const base = args.base || '/'
  if (!base.startsWith('/') || !base.endsWith('/'))
    throw new Error('Base URL must start and end with a slash "/"')

  const out = resolve(workspace.root, args.out || 'dist')
  const coversOut = join(out, 'covers')
  const coversCache = join(workspace.root, COVERS_CACHE_DIR)
  await fs.mkdir(coversOut, { recursive: true })
  await fs.mkdir(coversCache, { recursive: true })

  const built: WorkspaceDeck[] = []
  const covers = new Set<string>()
  let captureCovers = args.covers

  for (const [index, deck] of workspace.decks.entries()) {
    const deckBase = `${base}${deck.name}/`
    const outDir = join(out, deck.name)
    console.log(`\n${dim(`  [${index + 1}/${workspace.decks.length}]`)} ${bold(deck.name)} ${dim('→')} ${cyan(relative(workspace.root, outDir) || '.')}`)

    let options: ResolvedSlidevOptions
    try {
      await fs.rm(outDir, { recursive: true, force: true })
      options = await resolveOptions({
        entry: deck.entry,
        theme: args.theme,
        base: deckBase,
        download: args.download,
        inspect: args.inspect,
        withoutNotes: args['without-notes'],
        routerMode: args['router-mode'],
      }, 'build')
      await build(
        options,
        // outDir is outside the deck folder, so it is removed above instead of by Vite
        {
          base: deckBase,
          logLevel: 'warn',
          build: { outDir, emptyOutDir: false },
        },
        {
          ...args,
          entry: deck.entry,
          base: deckBase,
          out: outDir,
        } as BuildArgs,
      )
      built.push(deck)
    }
    catch (error) {
      console.error(red(`  Could not build "${deck.name}": ${(error as Error)?.message || error}`))
      process.exitCode = 1
      continue
    }

    if (!captureCovers)
      continue
    try {
      const cover = join(coversOut, `${deck.name}.png`)
      if (await captureCover(options, outDir, deckBase, args, cover)) {
        // Cached so the dev grid can show it too
        await fs.copyFile(cover, join(coversCache, `${deck.name}.png`))
        covers.add(deck.name)
      }
    }
    catch (error) {
      const message = (error as Error)?.message || String(error)
      console.warn(yellow(`  Could not capture a cover for "${deck.name}", using a title card instead. ${message.split('\n')[0]}`))
      // Without a browser every later capture fails the same way
      if (message.includes('playwright-chromium')) {
        console.warn(yellow('  Install playwright-chromium to get cover screenshots, or pass --covers=false.'))
        captureCovers = false
      }
    }
  }

  await fs.writeFile(join(out, 'index.html'), renderWorkspacePage({
    workspace: { ...workspace, decks: built },
    mode: 'build',
    coverUrl: deck => covers.has(deck.name)
      ? `covers/${deck.name}.png`
      : undefined,
    deckUrl: deck => `${deck.name}/`,
  }), 'utf-8')
  // Single page app fallback for each deck on Netlify
  await fs.writeFile(
    join(out, '_redirects'),
    `${built.map(deck => `${base}${deck.name}/*    ${base}${deck.name}/index.html   200`).join('\n')}\n`,
    'utf-8',
  )

  console.log(`\n${green('  ✓')} Built ${built.length} of ${workspace.decks.length} decks into ${cyan(relative(process.cwd(), out) || '.')}\n`)
  return { out, built }
}

async function captureCover(options: ResolvedSlidevOptions, outDir: string, deckBase: string, args: WorkspaceBuildArgs, dest: string) {
  const port = await getPort({
    port: 12446,
    random: false,
    portRange: [12446, 12600],
  })
  const app = connect()
  app.use(deckBase, sirv(outDir, { etag: true, single: true, dev: true }))
  const server = http.createServer(app)
  await new Promise<void>(r => server.listen(port, 'localhost', r))

  const tempDir = join(outDir, '.cover')
  try {
    const { exportSlides } = await import('../commands/export')
    const { config } = options.data
    await exportSlides({
      port,
      base: deckBase,
      slides: options.data.slides,
      total: options.data.slides.length,
      format: 'png',
      output: tempDir,
      range: '1',
      width: config.canvasWidth,
      height: Math.round(config.canvasWidth / config.aspectRatio),
      // Covers are rendered by URL, so memory routing falls back to history
      routerMode: config.routerMode === 'memory'
        ? 'history'
        : config.routerMode,
      waitUntil: 'networkidle',
      timeout: args.timeout || 30000,
      perSlide: true,
      omitBackground: false,
      dark: args.dark,
    })
    const png = (await fs.readdir(tempDir)).find(f => f.endsWith('.png'))
    if (!png)
      return false
    await fs.copyFile(join(tempDir, png), dest)
    return true
  }
  finally {
    await fs.rm(tempDir, { recursive: true, force: true })
    server.close()
  }
}
