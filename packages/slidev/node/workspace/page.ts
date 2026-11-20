import type { ResolvedWorkspace, WorkspaceDeck } from '.'

export interface WorkspacePageOptions {
  workspace: ResolvedWorkspace
  mode: 'dev' | 'build'
  /**
   * URL of a deck's cover screenshot, or undefined to draw a title card
   */
  coverUrl: (deck: WorkspaceDeck) => string | undefined
  /**
   * URL that opens a deck
   */
  deckUrl: (deck: WorkspaceDeck) => string
}

const RE_HTML_CHARS = /[&<>"']/g
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}

export function escapeHtml(value: string) {
  return value.replace(RE_HTML_CHARS, c => HTML_ESCAPES[c])
}

// Stable hue per deck so title cards keep their colors between runs
export function deckHue(name: string) {
  let hash = 0
  for (const char of name)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 360
}

const STYLE = /* css */`
:root {
  color-scheme: dark;
  --bg: #1d1521;
  --raised: #281e2d;
  --text: #f3ebe1;
  --muted: #ad9fad;
  --line: rgb(243 235 225 / 0.14);
  --tungsten: #f2b356;
  --font: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
}
@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --bg: #efe8f0;
    --raised: #e3d9e5;
    --text: #231a27;
    --muted: #675b6b;
    --line: rgb(35 26 39 / 0.16);
    --tungsten: #9a5c0c;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 400 16px/1.5 var(--font);
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 1440px; margin: 0 auto; padding: clamp(32px, 6vw, 88px) clamp(16px, 4vw, 56px) 96px; }
.masthead { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 24px 48px; }
h1 {
  margin: 0;
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  font-weight: 800;
  font-stretch: 85%;
  line-height: 0.95;
  letter-spacing: -0.035em;
}
.description { margin: 16px 0 0; max-width: 60ch; color: var(--muted); font-size: 1.125rem; }
.tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
@media (min-width: 900px) { .tools { flex-wrap: nowrap; } }
input, select, button { font: inherit; color: inherit; }
input[type=search], select {
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--raised);
}
input[type=search] { width: min(260px, 100%); }
.sort { display: flex; gap: 8px; align-items: center; color: var(--muted); font-size: 0.9375rem; white-space: nowrap; }
:focus-visible { outline: 2px solid var(--tungsten); outline-offset: 3px; }
.count { margin: 48px 0 20px; color: var(--muted); font-size: 0.9375rem; }
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 56px 32px;
}
.deck { position: relative; min-width: 0; }
.screen-link { display: block; color: inherit; text-decoration: none; border-radius: 6px; }
.screen-link:focus-visible { outline: none; }
.screen {
  position: relative;
  margin: 0;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background: var(--raised);
  box-shadow: 0 0 0 1px var(--line);
  transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.35s;
}
/* Lifted screen casts light in its own hue, plus a warm tungsten haze */
.screen-link:hover .screen,
.screen-link:focus-visible .screen {
  transform: translateY(-6px);
  box-shadow:
    0 0 0 1px var(--line),
    0 28px 48px -18px hsl(var(--hue) 70% 55% / 0.55),
    0 10px 80px -10px rgb(242 179 86 / 0.25);
}
.screen-link:focus-visible .screen { box-shadow: 0 0 0 2px var(--tungsten), 0 28px 48px -18px hsl(var(--hue) 70% 55% / 0.55); }
.screen > img { display: block; width: 100%; height: 100%; object-fit: cover; }
.title-card {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: end;
  padding: 7% 8%;
  background:
    radial-gradient(120% 90% at 20% 0%, hsl(var(--hue) 55% 34%), transparent 60%),
    linear-gradient(160deg, hsl(var(--hue) 45% 20%), hsl(calc(var(--hue) + 50) 50% 9%));
  color: #f6eee4;
}
.title-card > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.45; }
.title-card > span {
  position: relative;
  font-size: clamp(1.375rem, 2.4vw, 2rem);
  font-weight: 700;
  font-stretch: 85%;
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.deck h2 {
  margin: 18px 0 0;
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.meta, .info, .byline { margin: 4px 0 0; color: var(--muted); font-size: 0.9375rem; }
.info { color: var(--text); opacity: 0.85; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.status, .starting {
  position: absolute;
  top: 12px;
  left: 12px;
  display: none;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  background: rgb(20 14 22 / 0.72);
  backdrop-filter: blur(6px);
  color: #f6eee4;
  font-size: 0.8125rem;
  font-weight: 500;
}
.status::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #f2b356; box-shadow: 0 0 10px #f2b356; }
.deck.running .status { display: inline-flex; }
.deck.is-starting .status { display: none; }
.deck.is-starting .starting { display: inline-flex; }
.deck.is-starting .screen { animation: warm 1.4s ease-in-out infinite alternate; }
@keyframes warm { to { box-shadow: 0 0 0 1px var(--line), 0 0 60px -6px rgb(242 179 86 / 0.45); } }
.stop {
  display: none;
  margin-top: 10px;
  padding: 4px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.875rem;
  cursor: pointer;
}
.stop:hover { color: var(--text); border-color: var(--muted); }
.deck.running .stop { display: inline-block; }
.error { margin: 8px 0 0; color: #ff9a8a; font-size: 0.9375rem; }
.empty { color: var(--muted); }
.empty-state { margin-top: 64px; max-width: 60ch; }
.empty-state h2 { margin: 0 0 8px; font-size: 1.5rem; }
.empty-state p { margin: 0; color: var(--muted); }
code { font-size: 0.9em; padding: 1px 6px; border-radius: 4px; background: var(--raised); color: var(--text); }
@media (prefers-reduced-motion: reduce) {
  .screen { transition: none; }
  .screen-link:hover .screen, .screen-link:focus-visible .screen { transform: none; }
  .deck.is-starting .screen { animation: none; }
}
`

const SCRIPT = /* js */`
(() => {
  const grid = document.getElementById('grid')
  if (!grid) return
  const decks = [...grid.children]
  const search = document.getElementById('search')
  const sort = document.getElementById('sort')
  const count = document.getElementById('count')
  const noMatch = document.getElementById('no-match')

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units = [['year', 31536e6], ['month', 2592e6], ['week', 6048e5], ['day', 864e5], ['hour', 36e5], ['minute', 6e4]]
  for (const time of grid.querySelectorAll('time')) {
    const diff = new Date(time.dateTime).getTime() - Date.now()
    const [unit, ms] = units.find(([, ms]) => Math.abs(diff) >= ms) || ['minute', 6e4]
    time.textContent = 'edited ' + rtf.format(Math.round(diff / ms), unit)
  }

  const comparators = {
    order: (a, b) => a.dataset.order - b.dataset.order,
    updated: (a, b) => b.dataset.updated - a.dataset.updated,
    title: (a, b) => a.dataset.title.localeCompare(b.dataset.title),
    slides: (a, b) => b.dataset.slides - a.dataset.slides,
  }
  function update() {
    const q = search.value.trim().toLowerCase()
    let shown = 0
    for (const deck of decks) {
      const match = !q || deck.textContent.toLowerCase().includes(q) || deck.dataset.name.includes(q)
      deck.hidden = !match
      if (match) shown++
    }
    grid.append(...[...decks].sort(comparators[sort.value]))
    count.textContent = shown === decks.length
      ? decks.length + (decks.length === 1 ? ' deck' : ' decks')
      : shown + ' of ' + decks.length + ' decks'
    noMatch.hidden = shown > 0
  }
  try { sort.value = localStorage.getItem('slidev-workspace-sort') || 'order' } catch {}
  search.addEventListener('input', update)
  sort.addEventListener('change', () => {
    try { localStorage.setItem('slidev-workspace-sort', sort.value) } catch {}
    update()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) {
      e.preventDefault()
      search.focus()
    }
  })
  update()

  if (document.body.dataset.mode !== 'dev') return

  async function api(path, method = 'GET') {
    const res = await fetch('/__workspace/api/' + path, { method })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || res.statusText)
    return body
  }
  async function refresh() {
    try {
      const { running } = await api('status')
      for (const deck of decks) deck.classList.toggle('running', running.includes(deck.dataset.name))
    } catch {}
  }
  function showError(deck, message) {
    deck.querySelector('.error')?.remove()
    const p = document.createElement('p')
    p.className = 'error'
    p.textContent = message
    deck.append(p)
  }

  grid.addEventListener('click', async (e) => {
    const stop = e.target.closest('[data-stop]')
    if (stop) {
      stop.disabled = true
      await api('stop/' + encodeURIComponent(stop.dataset.stop), 'POST').catch(() => {})
      stop.disabled = false
      return refresh()
    }
    const link = e.target.closest('.screen-link')
    if (!link || e.button !== 0) return
    e.preventDefault()
    const deck = link.closest('.deck')
    const newTab = e.metaKey || e.ctrlKey || e.shiftKey
    deck.querySelector('.error')?.remove()
    deck.classList.add('is-starting')
    try {
      const { url } = await api('start/' + encodeURIComponent(deck.dataset.name), 'POST')
      deck.classList.add('running')
      if (newTab) window.open(url, '_blank')
      else location.href = url
    } catch (err) {
      showError(deck, 'Could not start this deck: ' + err.message + '. Check the terminal for details.')
    } finally {
      deck.classList.remove('is-starting')
    }
  })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh())
  window.addEventListener('pageshow', refresh)
  refresh()
})()
`

export function renderWorkspacePage({ workspace, mode, coverUrl, deckUrl }: WorkspacePageOptions) {
  const { title, description, decks } = workspace
  const count = `${decks.length} ${decks.length === 1
    ? 'deck'
    : 'decks'}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap">
<style>${STYLE}</style>
</head>
<body data-mode="${mode}">
<main>
  <header class="masthead">
    <div class="heading">
      <h1>${escapeHtml(title)}</h1>
      ${description
        ? `<p class="description">${escapeHtml(description)}</p>`
        : ''}
    </div>
    ${decks.length
      ? `<div class="tools">
      <input type="search" id="search" placeholder="Find a deck" aria-label="Find a deck" autocomplete="off">
      <label class="sort">Sort by
        <select id="sort">
          <option value="order">Workspace order</option>
          <option value="updated">Recently edited</option>
          <option value="title">Title</option>
          <option value="slides">Most slides</option>
        </select>
      </label>
    </div>`
      : ''}
  </header>
  ${decks.length
    ? `<p class="count" id="count" aria-live="polite">${count}</p>
  <ol class="grid" id="grid">
${decks.map((deck, index) => renderDeck(deck, index, mode, coverUrl(deck), deckUrl(deck))).join('\n')}
  </ol>
  <p class="empty" id="no-match" hidden>No deck matches your search.</p>`
    : `<section class="empty-state">
    <h2>No decks yet</h2>
    <p>Create a folder in <code>${escapeHtml(relativeDir(workspace))}</code> with a <code>slides.md</code> file inside, for example <code>${escapeHtml(relativeDir(workspace))}/my-talk/slides.md</code>.${mode === 'dev'
      ? ' Then reload this page.'
      : ''}</p>
  </section>`}
</main>
<script>${SCRIPT}</script>
</body>
</html>
`
}

function renderDeck(deck: WorkspaceDeck, index: number, mode: 'dev' | 'build', cover: string | undefined, href: string) {
  const title = escapeHtml(deck.title)
  const visual = cover
    ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async">`
    : `<div class="title-card">${deck.background
      ? `<img src="${escapeHtml(deck.background)}" alt="" loading="lazy" decoding="async">`
      : ''}<span>${title}</span></div>`
  const byline = [deck.author, deck.theme && `${deck.theme} theme`].filter(Boolean).join(', ')

  return `    <li class="deck" data-name="${escapeHtml(deck.name)}" data-title="${title}" data-order="${index}" data-updated="${Math.round(deck.updatedAt)}" data-slides="${deck.slides}" style="--hue:${deckHue(deck.name)}">
      <a class="screen-link" href="${escapeHtml(href)}">
        <figure class="screen">${visual}${mode === 'dev'
          ? '<span class="status">Running</span><span class="starting">Starting…</span>'
          : ''}</figure>
        <h2>${title}</h2>
      </a>
      <p class="meta"><span>${deck.slides} ${deck.slides === 1
        ? 'slide'
        : 'slides'}</span>, <time datetime="${new Date(deck.updatedAt).toISOString()}">edited ${new Date(deck.updatedAt).toISOString().slice(0, 10)}</time></p>
      ${deck.info
        ? `<p class="info">${escapeHtml(deck.info)}</p>`
        : ''}
      ${byline
        ? `<p class="byline">${escapeHtml(byline)}</p>`
        : ''}
      ${mode === 'dev'
        ? `<button class="stop" type="button" data-stop="${escapeHtml(deck.name)}">Stop server</button>`
        : ''}
    </li>`
}

function relativeDir(workspace: ResolvedWorkspace) {
  return workspace.dir.startsWith(`${workspace.root}/`)
    ? workspace.dir.slice(workspace.root.length + 1)
    : workspace.dir
}
