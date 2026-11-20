---
outline: deep
---

# Workspace

A workspace keeps many decks in one project and shows them as a grid. Open a deck from the grid to edit or present it, and build every deck into one site you can host.

## Folder layout {#layout}

Each deck has its own folder in `decks/`, with a `slides.md` inside. A deck folder works like a normal Slidev project, so it can have its own `public/`, `components/`, `layouts/` and `setup/` folders. Themes and addons are installed once in the workspace `package.json`.

```
my-talks/
├─ package.json
├─ slidev.workspace.ts   (optional)
└─ decks/
   ├─ q3-review/
   │  ├─ slides.md
   │  └─ public/
   ├─ product-launch/
   │  ├─ slides.md
   │  └─ components/
   └─ onboarding/
      └─ slides.md
```

The folder name is the deck's URL, so use letters, digits, `-`, `_` and `.` only. Folders with other characters are skipped with a warning.

Each card in the grid shows the deck's `title`, `info`, `author` and `theme` from its headmatter, the number of visible slides and when the file was last edited.

## Open the grid {#dev}

```bash
$ slidev workspace
```

The grid opens on port `3030`. When you open a deck, Slidev starts a dev server for that deck on the next free port, with hot reload as usual. Decks you have opened show **Running** in the grid, and **Stop server** stops them. All deck servers stop when you stop the workspace.

Press <kbd>/</kbd> to search. The sort order you choose is remembered in your browser.

## Build the site {#build}

```bash
$ slidev workspace build
```

This builds each deck into `dist/<deck>/` and writes the grid to `dist/index.html`. It also captures the first slide of every deck as its cover in `dist/covers/`. Covers need [`playwright-chromium`](./exporting). Without it, or with `--covers=false`, cards show a title card in the deck's own color.

Covers are also saved in `.slidev/covers/`, so the dev grid shows them too. You can add this folder to `.gitignore`.

To host the site under a sub-path, pass `--base`. Each deck is then served at `<base><deck>/`:

```bash
$ slidev workspace build --base /talks/
```

The build writes a `_redirects` file for Netlify. On hosts without single-page app rewrites, such as GitHub Pages, use `--router-mode hash` so links to a slide keep working after a reload.

## Configuration {#config}

Add `slidev.workspace.ts` (or `.js`, `.mjs`, `.json`) to the workspace root:

```ts
import { defineWorkspaceConfig } from '@slidev/cli'

export default defineWorkspaceConfig({
  title: 'Acme talks',
  description: 'Every deck the team presents, in one place.',
  // Folder with the decks. Default: 'decks'
  dir: 'decks',
  // Decks shown first, in this order. The rest follow by name
  order: ['product-launch'],
  // Decks to leave out
  exclude: ['draft'],
})
```

Without a `title`, the grid uses the `name` in `package.json`, then the folder name.
