import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { parseSync } from '@slidev/parser'
import { basename, join, resolve } from 'pathe'
import { loadModule } from '../utils'

export interface SlidevWorkspaceConfig {
  /**
   * Heading of the deck grid. Defaults to the `name` in package.json, then the folder name.
   */
  title?: string
  /**
   * Short line shown under the title.
   */
  description?: string
  /**
   * Folder that holds one sub-folder per deck, relative to the workspace root.
   *
   * @default 'decks'
   */
  dir?: string
  /**
   * Deck folder names to show first, in this order. Other decks follow by name.
   */
  order?: string[]
  /**
   * Deck folder names to leave out.
   */
  exclude?: string[]
}

export interface WorkspaceDeck {
  /**
   * Folder name, also used as the deck's URL segment
   */
  name: string
  /**
   * Absolute path to the deck's `slides.md`
   */
  entry: string
  title: string
  info?: string
  author?: string
  theme?: string
  /**
   * Number of visible slides in the entry file. Slides imported with `src:` count as one.
   */
  slides: number
  /**
   * Last modification time of the entry file, in ms
   */
  updatedAt: number
  /**
   * Remote image from the headmatter `background`, used when there is no cover screenshot
   */
  background?: string
}

export interface ResolvedWorkspace {
  root: string
  dir: string
  title: string
  description?: string
  decks: WorkspaceDeck[]
}

export const WORKSPACE_CONFIG_FILES = [
  'slidev.workspace.ts',
  'slidev.workspace.mts',
  'slidev.workspace.js',
  'slidev.workspace.mjs',
  'slidev.workspace.json',
]

export const DECK_ENTRY = 'slides.md'

// Deck names become URL segments and Vite `base` paths
const RE_DECK_NAME = /^[\w-][\w.-]*$/
const RE_MARKDOWN_DECORATION = /[*_`#>]|\[([^\]]*)\]\([^)]*\)/g
const RE_REMOTE_URL = /^https?:\/\//

// The dev grid re-resolves the workspace on every request, so warn only once per folder
const warnedNames = new Set<string>()

export function defineWorkspaceConfig(config: SlidevWorkspaceConfig) {
  return config
}

export function isValidDeckName(name: string) {
  return RE_DECK_NAME.test(name)
}

export async function loadWorkspaceConfig(root: string): Promise<SlidevWorkspaceConfig> {
  for (const file of WORKSPACE_CONFIG_FILES) {
    const path = join(root, file)
    if (!existsSync(path))
      continue
    if (file.endsWith('.json'))
      return JSON.parse(await fs.readFile(path, 'utf-8'))
    const mod = await loadModule<{ default?: SlidevWorkspaceConfig } & SlidevWorkspaceConfig>(path)
    return mod.default ?? mod
  }
  return {}
}

export async function resolveWorkspace(rootInput = '.', overrides: SlidevWorkspaceConfig = {}): Promise<ResolvedWorkspace> {
  const root = resolve(rootInput)
  const config = {
    ...await loadWorkspaceConfig(root),
    ...overrides,
  }
  const dir = resolve(root, config.dir || 'decks')

  const names = existsSync(dir)
    ? (await fs.readdir(dir, { withFileTypes: true }))
        .filter(d => d.isDirectory() && existsSync(join(dir, d.name, DECK_ENTRY)))
        .map(d => d.name)
    : []

  const exclude = new Set(config.exclude)
  const decks: WorkspaceDeck[] = []
  for (const name of names) {
    if (exclude.has(name))
      continue
    if (!isValidDeckName(name)) {
      if (warnedNames.has(name))
        continue
      warnedNames.add(name)
      console.warn(`[slidev] Skipping deck "${name}": folder names may only contain letters, digits, "-", "_" and "."`)
      continue
    }
    decks.push(await readDeck(name, join(dir, name, DECK_ENTRY)))
  }

  return {
    root,
    dir,
    title: config.title || await readPackageName(root) || basename(root),
    description: config.description,
    decks: sortDecks(decks, config.order),
  }
}

export async function readDeck(name: string, entry: string): Promise<WorkspaceDeck> {
  const [raw, stat] = await Promise.all([
    fs.readFile(entry, 'utf-8'),
    fs.stat(entry),
  ])
  const { slides } = parseSync(raw, entry)
  const headmatter = slides[0]?.frontmatter ?? {}
  const background = typeof headmatter.background === 'string' && RE_REMOTE_URL.test(headmatter.background)
    ? headmatter.background
    : undefined

  return {
    name,
    entry,
    title: stringOrUndefined(headmatter.title) || slides[0]?.title || name,
    info: firstLine(headmatter.info),
    author: stringOrUndefined(headmatter.author),
    theme: stringOrUndefined(headmatter.theme),
    slides: slides.filter(s => !s.frontmatter.disabled && !s.frontmatter.hide).length,
    updatedAt: stat.mtimeMs,
    background,
  }
}

export function sortDecks(decks: WorkspaceDeck[], order: string[] = []) {
  const rank = (d: WorkspaceDeck) => {
    const i = order.indexOf(d.name)
    return i === -1
      ? order.length
      : i
  }
  return [...decks].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

async function readPackageName(root: string): Promise<string | undefined> {
  try {
    const pkg = JSON.parse(await fs.readFile(join(root, 'package.json'), 'utf-8'))
    return stringOrUndefined(pkg.name)
  }
  catch {}
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined
}

function firstLine(value: unknown) {
  const text = stringOrUndefined(value)
  return text
    ?.split('\n')
    .map(line => line.replace(RE_MARKDOWN_DECORATION, '$1').trim())
    .find(Boolean)
}
