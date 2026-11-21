# Slidev CLI

`@slidev/cli` exposes a binary called `slidev` that you can use to develop, build, and export your slides.

## Prerequisites

To use the CLI, you can either install `@slidev/cli` globally or install it locally in your Node.js project. If you created your project with `npm init slidev`, the CLI is already installed locally.

::: warning
Usually `npx slidev` is not supported because the package name is actually `@slidev/cli`.
:::

The CLI options of the commands obey the following conventions:

- the value of the option can be passed after a space or a `=` character:

  Example: `slidev --port 8080` is equivalent to `slidev --port=8080`

- `true` can be omitted for boolean options:

  Example: `slidev --open` is equivalent to `slidev --open true`

::: info

If you use npm, please don't forget to add `--` before the options to pass them to Slidev:

```bash
npm run slidev -- --remote --port 8080 --open
```

:::

## `slidev [entry]` {#dev}

Start a local server for Slidev.

- `[entry]` (`string`, default: `slides.md`): path to the markdown file containing your slides.

Options:

- `--port`, `-p` (`number`, default: `3030`): port number.
- `--base` (`string`, default: `/`): base URL (see https://vitejs.dev/config/shared-options.html#base).
- `--open`, `-o` (`boolean`, default: `false`): open in the browser.
- `--remote [password]` (`string`): listen to the public host and enable remote control, if a value is passed then the presenter mode is private and only accessible by passing the given password in the URL query `password` parameter.
- `--bind` (`string`, default: `0.0.0.0`): specify which IP addresses the server should listen on in the remote mode.
- `--log` (`'error', 'warn', 'info', 'silent'`, default: `'warn'`): Log level.
- `--force`, `-f` (`boolean`, default: `false`): force the optimizer to ignore the cache and re-bundle.
- `--theme`, `-t` (`string`): override theme.

## `slidev build [entry]` {#build}

Build a hostable SPA. See <LinkInline link="guide/hosting" /> for more details.

- `[entry]` (`string`, default: `slides.md`): path to the slides markdown file.

Options:

- `--out`, `-o` (`string`, default: `dist`): output directory
- `--base` (`string`, default: `/`): base URL (see https://vitejs.dev/config/shared-options.html#base)
- `--download` (`boolean`, default: `false`): allow the download of the slides as a PDF inside the SPA
- `--theme`, `-t` (`string`): override theme
- `--without-notes` (`boolean`, default: `false`): exclude speaker notes from the SPA

## `slidev workspace [root]` {#workspace}

Open a grid of every deck in a workspace. Each deck starts its own dev server when you open it. See <LinkInline link="guide/workspace" /> for more details.

- `[root]` (`string`, default: `.`): path to the workspace folder.

Options:

- `--port`, `-p` (`number`, default: `3030`): port of the grid. Decks use the following ports
- `--open`, `-o` (`boolean`, default: `false`): open in the browser
- `--dir` (`string`, default: `decks`): folder with one sub-folder per deck
- `--theme`, `-t` (`string`): override the theme of every deck
- `--log` (`'error', 'warn', 'info', 'silent'`, default: `'warn'`): log level of the deck servers

## `slidev workspace build [root]` {#workspace-build}

Build every deck and the grid into one hostable site.

- `[root]` (`string`, default: `.`): path to the workspace folder.

Options:

- `--out`, `-o` (`string`, default: `dist`): output directory
- `--base` (`string`, default: `/`): base of the site. Each deck is served at `<base><deck>/`
- `--covers` (`boolean`, default: `true`): capture each deck's first slide as its cover (needs `playwright-chromium`)
- `--dir`, `--theme`, `--download`, `--without-notes`, `--router-mode`: same as for [`slidev build`](#build), applied to every deck

## `slidev export [...entry]` {#export}

Export slides to PDF (or other format). See <LinkInline link="guide/exporting" /> for more details.

- `[entry]` (`string`, default: `slides.md`): path to the slides markdown entry.

Options:

- `--output` (`string`, default: use `exportFilename` (see https://sli.dev/custom/#headmatter) or use `[entry]-export`): path to the output.
- `--format` (`'pdf', 'png', 'pptx', 'pptx-editable', 'md', 'mp4', 'webm'`, default: `'pdf'`): output format. `pptx` exports each slide as an image; `pptx-editable` rebuilds them as native PowerPoint shapes with selectable text. `mp4` and `webm` export a video and need ffmpeg (see <LinkInline link="guide/exporting#video" />).
- `--step-duration` (`number`, default: `3000`): video only, time each click step is shown, in milliseconds
- `--fps` (`number`, default: `60`): video only, frames per second
- `--timeout` (`number`, default: `30000`): timeout for rendering the print page (see https://playwright.dev/docs/api/class-page#page-goto).
- `--range` (`string`): page ranges to export (example: `'1,4-5,6'`).
- `--dark` (`boolean`, default: `false`): export as dark theme.
- `--with-clicks`, `-c` (`boolean`, default: `true` for PPTX formats, `false` otherwise): export pages for every click animation (see https://sli.dev/guide/animations.html#click-animation).
- `--theme`, `-t` (`string`): override theme.
- `--omit-background` (`boolean`, default: `false`): remove the default browser background

## `slidev export-notes [...entry]` {#export-notes}

Export presenter notes to PDF. Only slides with notes are included, with their titles and slide numbers, but without slide previews. See [Exporting Presenter Notes](../guide/exporting#presenter-notes) for examples and prerequisites.

- `[entry]` (`string`, default: `slides.md`): path to the slides markdown entry.

Options:

- `--output` (`string`, default: `[exportFilename]-notes.pdf` if `exportFilename` is configured, otherwise `[entry]-export-notes.pdf`): path to the output. The `.pdf` extension is added if omitted.
- `--timeout` (`number`, default: `30000`): timeout in milliseconds for rendering the print page.
- `--wait` (`number`, default: `0`): extra delay in milliseconds before exporting.

## `slidev format [entry]` {#format}

Format the markdown file. Note that this won't format the content of the slides, only the organization of the markdown file.

- `[entry]` (`string`, default: `slides.md`): path to the slides markdown entry.

## `slidev mcp [entry]` {#mcp}

Start an MCP (Model Context Protocol) server over stdio for AI agents to inspect and edit the slides. See <LinkInline link="features/mcp" />.

- `[entry]` (`string`, default: `slides.md`): path to the slides markdown entry.

## `slidev theme [subcommand]` {#theme}

Theme-related operations.

Subcommands:

- `eject [entry]`: Eject the current theme into the local file system. See <LinkInline link="features/eject-theme" />.
  - `[entry]` (`string`, default: `slides.md`): path to the slides markdown entry.
  - Options:
    - `--dir` (`string`, default: `theme`): the output dir.
    - `--theme`, `-t` (`string`): override theme.
