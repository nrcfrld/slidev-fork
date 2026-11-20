import fs from 'node:fs/promises'
import os from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveWorkspace, sortDecks } from '.'
import { escapeHtml, renderWorkspacePage } from './page'

let root: string

async function write(path: string, content: string) {
  await fs.mkdir(join(root, path, '..'), { recursive: true })
  await fs.writeFile(join(root, path), content)
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(os.tmpdir(), 'slidev-workspace-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('resolveWorkspace', () => {
  it('finds one deck per folder with a slides.md', async () => {
    await write('package.json', JSON.stringify({ name: 'my-talks' }))
    await write('decks/intro/slides.md', [
      '---',
      'title: Intro talk',
      'theme: seriph',
      'author: Ada',
      'info: |',
      '  ## The **first** talk',
      '  More text',
      'background: https://example.com/bg.jpg',
      '---',
      '',
      '# Hello',
      '',
      '---',
      'hide: true',
      '---',
      '',
      '# Hidden',
      '',
      '---',
      '',
      '# Last',
    ].join('\n'))
    await write('decks/plain/slides.md', '# Plain deck\n')
    await write('decks/no-entry/README.md', '# not a deck\n')

    const workspace = await resolveWorkspace(root)

    expect(workspace.title).toBe('my-talks')
    expect(workspace.decks.map(d => d.name)).toEqual(['intro', 'plain'])
    expect(workspace.decks[0]).toMatchObject({
      title: 'Intro talk',
      theme: 'seriph',
      author: 'Ada',
      info: 'The first talk',
      slides: 2,
      background: 'https://example.com/bg.jpg',
    })
    expect(workspace.decks[1]).toMatchObject({ title: 'Plain deck', slides: 1 })
  })

  it('applies the workspace config', async () => {
    await write('slidev.workspace.json', JSON.stringify({
      title: 'Talks',
      dir: 'talks',
      order: ['zeta'],
      exclude: ['draft'],
    }))
    for (const name of ['alpha', 'zeta', 'draft'])
      await write(`talks/${name}/slides.md`, `# ${name}\n`)

    const workspace = await resolveWorkspace(root)

    expect(workspace.title).toBe('Talks')
    expect(workspace.decks.map(d => d.name)).toEqual(['zeta', 'alpha'])
  })

  it('skips folders whose names cannot be URL segments', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await write('decks/has space/slides.md', '# A\n')
    await write('decks/ok/slides.md', '# B\n')

    const workspace = await resolveWorkspace(root)

    expect(workspace.decks.map(d => d.name)).toEqual(['ok'])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('returns no decks when the folder is missing', async () => {
    const workspace = await resolveWorkspace(root)
    expect(workspace.decks).toEqual([])
  })
})

describe('sortDecks', () => {
  it('puts ordered decks first, then the rest by name', () => {
    const deck = (name: string) => ({
      name,
      entry: '',
      title: name,
      slides: 1,
      updatedAt: 0,
    })
    expect(sortDecks([
      deck('c'),
      deck('a'),
      deck('b'),
    ], ['b']).map(d => d.name)).toEqual(['b', 'a', 'c'])
  })
})

describe('renderWorkspacePage', () => {
  it('escapes deck content and links each deck', async () => {
    await write('decks/xss/slides.md', '---\ntitle: <script>alert(1)</script>\n---\n\n# x\n')
    const workspace = await resolveWorkspace(root)

    const html = renderWorkspacePage({
      workspace,
      mode: 'build',
      coverUrl: () => 'covers/xss.png',
      deckUrl: deck => `${deck.name}/`,
    })

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain(escapeHtml('<script>alert(1)</script>'))
    expect(html).toContain('href="xss/"')
    expect(html).toContain('src="covers/xss.png"')
    expect(html).not.toContain('Stop server')
  })

  it('explains how to add a deck when there are none', async () => {
    const workspace = await resolveWorkspace(root)
    const html = renderWorkspacePage({
      workspace,
      mode: 'dev',
      coverUrl: () => undefined,
      deckUrl: () => '',
    })
    expect(html).toContain('No decks yet')
    expect(html).toContain('decks/my-talk/slides.md')
  })
})
