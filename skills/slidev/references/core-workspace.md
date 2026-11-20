---
name: workspace
description: Keep many decks in one project and show them as a grid
---

# Workspace

Many decks in one project, shown as a grid with a cover per deck.

## Layout

```
my-talks/
├─ package.json            # themes and addons, installed once
├─ slidev.workspace.ts     # optional
└─ decks/
   ├─ q3-review/slides.md  # each folder is a normal Slidev project
   └─ onboarding/slides.md
```

Folder names become URLs: letters, digits, `-`, `_`, `.` only.

## Commands

```bash
slidev workspace                    # grid on :3030, decks start on demand
slidev workspace build              # dist/index.html + dist/<deck>/ + dist/covers/
slidev workspace build --base /talks/
slidev workspace build --covers=false   # title cards instead of screenshots
```

Covers need `playwright-chromium` and are cached in `.slidev/covers/` for the dev grid.
Use `--router-mode hash` for hosts without SPA rewrites (GitHub Pages).

## Config

```ts
// slidev.workspace.ts
import { defineWorkspaceConfig } from '@slidev/cli'

export default defineWorkspaceConfig({
  title: 'Acme talks',
  description: 'Every deck the team presents.',
  dir: 'decks',               // default
  order: ['product-launch'],  // shown first
  exclude: ['draft'],
})
```

Cards show headmatter `title`, `info`, `author`, `theme`, visible slide count and last edit time.
