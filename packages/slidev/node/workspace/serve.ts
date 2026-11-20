/* eslint-disable no-console -- terminal output of a CLI command */
import type { ChildProcess } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceDeck } from '.'
import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { blue, bold, cyan, dim, green, red, yellow } from 'ansis'
import { checkPort } from 'get-port-please'
import openBrowser from 'open'
import { dirname, join } from 'pathe'
import sirv from 'sirv'
import { resolveWorkspace } from '.'
import { renderWorkspacePage } from './page'

export const COVERS_CACHE_DIR = '.slidev/covers'

export interface WorkspaceServerOptions {
  root: string
  port: number
  dir?: string
  theme?: string
  log: string
  open?: boolean
}

interface RunningDeck {
  process: ChildProcess
  url: string
  ready: Promise<string>
  stopping?: boolean
}

const READY_TIMEOUT = 90_000
const RE_API = /^\/__workspace\/api\/(status|start|stop)(?:\/([^/?]+))?/
const RE_OPEN = /^\/__workspace\/open\/([^/?]+)/

export async function startWorkspaceServer(options: WorkspaceServerOptions) {
  const { root, port } = options
  const cliBin = fileURLToPath(new URL('../bin/slidev.mjs', import.meta.url))
  const coversDir = join(root, COVERS_CACHE_DIR)
  const serveCovers = sirv(coversDir, { dev: true })
  const running = new Map<string, RunningDeck>()
  const reservedPorts = new Set<number>([port])

  async function findDeck(name: string) {
    const workspace = await resolveWorkspace(root, { dir: options.dir })
    return workspace.decks.find(d => d.name === name)
  }

  async function nextPort() {
    for (let candidate = port + 1; candidate < port + 500; candidate++) {
      if (reservedPorts.has(candidate))
        continue
      if (await checkPort(candidate, 'localhost')) {
        reservedPorts.add(candidate)
        return candidate
      }
    }
    throw new Error(`No free port between ${port + 1} and ${port + 500}`)
  }

  async function startDeck(deck: WorkspaceDeck): Promise<string> {
    const existing = running.get(deck.name)
    if (existing)
      return existing.ready

    const deckPort = await nextPort()
    const url = `http://localhost:${deckPort}/`
    const child = spawn(
      process.execPath,
      [
        cliBin,
        deck.entry,
        '--port',
        String(deckPort),
        '--log',
        options.log,
        ...(options.theme
          ? ['--theme', options.theme]
          : []),
      ],
      {
        cwd: dirname(deck.entry),
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    const prefix = dim(`  [${deck.name}] `)
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n').filter(Boolean))
        console.error(prefix + line)
    })

    const ready = waitForServer(url, child).then(
      () => {
        console.log(`${green('  ●')} ${bold(deck.name)} ${dim('running at')} ${cyan(url)}`)
        return url
      },
      (error) => {
        child.kill()
        throw error
      },
    )
    const entry: RunningDeck = { process: child, url, ready }
    child.on('exit', (code) => {
      if (running.get(deck.name) === entry)
        running.delete(deck.name)
      reservedPorts.delete(deckPort)
      if (code && !entry.stopping)
        console.log(`${red('  ●')} ${bold(deck.name)} ${dim(`stopped with exit code ${code}`)}`)
    })
    running.set(deck.name, entry)
    return ready
  }

  function stopDeck(name: string) {
    const deck = running.get(name)
    if (!deck)
      return false
    deck.stopping = true
    deck.process.kill()
    running.delete(name)
    console.log(`${yellow('  ●')} ${bold(name)} ${dim('stopped')}`)
    return true
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = req.url || '/'

    if (url === '/' || url.startsWith('/?') || url === '/index.html') {
      const workspace = await resolveWorkspace(root, { dir: options.dir })
      return send(res, 200, 'text/html; charset=utf-8', renderWorkspacePage({
        workspace,
        mode: 'dev',
        coverUrl(deck) {
          const file = join(coversDir, `${deck.name}.png`)
          return existsSync(file)
            ? `/__workspace/covers/${deck.name}.png?v=${Math.round(statSync(file).mtimeMs)}`
            : undefined
        },
        deckUrl: deck => `/__workspace/open/${encodeURIComponent(deck.name)}`,
      }))
    }

    if (url.startsWith('/__workspace/covers/')) {
      req.url = url.slice('/__workspace/covers'.length)
      return serveCovers(req, res, () => send(res, 404, 'text/plain', 'Not found'))
    }

    const open = url.match(RE_OPEN)
    if (open && req.method === 'GET') {
      const deck = await findDeck(decodeURIComponent(open[1]))
      if (!deck)
        return send(res, 404, 'text/plain', 'Deck not found')
      res.writeHead(302, { location: await startDeck(deck) }).end()
      return
    }

    const api = url.match(RE_API)
    if (api) {
      const [, action, rawName] = api
      if (action === 'status') {
        return json(res, 200, {
          running: [
            ...running.keys(),
          ],
        })
      }
      // Starting processes is privileged: only accept it from this page
      if (req.method !== 'POST' || !isSameOrigin(req))
        return json(res, 403, { error: 'Forbidden' })
      const name = decodeURIComponent(rawName || '')
      if (action === 'stop') {
        return json(res, 200, {
          stopped: stopDeck(name),
        })
      }
      const deck = await findDeck(name)
      if (!deck)
        return json(res, 404, { error: `Deck "${name}" not found` })
      return json(res, 200, { url: await startDeck(deck) })
    }

    send(res, 404, 'text/plain', 'Not found')
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(red(`  ${error?.message || error}`))
      if (!res.headersSent) {
        if (req.url?.startsWith('/__workspace/api/')) {
          json(res, 500, {
            error: String(error?.message || error),
          })
        }
        else {
          send(res, 500, 'text/plain', String(error?.message || error))
        }
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, 'localhost', resolve)
  })

  function shutdown() {
    for (const name of [
      ...running.keys(),
    ])
      running.get(name)?.process.kill()
    server.close()
  }
  process.on('exit', shutdown)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      shutdown()
      process.exit()
    })
  }

  const workspace = await resolveWorkspace(root, { dir: options.dir })
  const gridUrl = `http://localhost:${port}/`
  console.log()
  console.log(`  ${cyan('●') + blue('■') + yellow('▲')}`)
  console.log(`${bold('  Slidev workspace')}  ${dim(workspace.title)}`)
  console.log()
  console.log(`${dim('  decks       ')}${workspace.decks.length} ${dim(`in ${workspace.dir}`)}`)
  console.log(`${dim('  deck grid   ')}> ${cyan(gridUrl)}`)
  console.log()
  console.log(dim('  Decks start on their own port when you open them.'))
  console.log()

  if (options.open)
    await openBrowser(gridUrl).catch(() => {})

  return {
    server,
    running,
    startDeck,
    stopDeck,
    close: shutdown,
  }
}

async function waitForServer(url: string, child: ChildProcess) {
  const start = Date.now()
  let exited = false
  child.once('exit', () => exited = true)
  while (Date.now() - start < READY_TIMEOUT) {
    if (exited)
      throw new Error('the deck server exited while starting')
    try {
      const res = await fetch(url)
      if (res.status < 500)
        return
    }
    catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`the deck server did not respond within ${READY_TIMEOUT / 1000}s`)
}

function isSameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin
  return !origin || origin === `http://${req.headers.host}`
}

function send(res: ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }).end(body)
}

function json(res: ServerResponse, status: number, body: unknown) {
  send(res, status, 'application/json', JSON.stringify(body))
}
