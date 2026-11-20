// Builds the starter demo and fails when the JavaScript loaded before the
// first slide (entry scripts + modulepreloads) grows past the budget.
// Build time is reported but not enforced, since CI runners vary too much.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = Number(process.env.SLIDEV_INITIAL_JS_BUDGET || 1_500_000)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demo = path.join(root, 'demo/starter')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'slidev-budget-'))

const start = performance.now()
execFileSync(process.execPath, [
  path.join(root, 'packages/slidev/bin/slidev.mjs'),
  'build',
  '--out',
  out,
], {
  cwd: demo,
  stdio: ['ignore', 'ignore', 'inherit'],
})
const buildSeconds = (performance.now() - start) / 1000

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf-8')
const files = [
  ...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="\/([^"]+\.js)"/g),
].map(m => m[1])
const sizes = files
  .map(file => ({ file, bytes: fs.statSync(path.join(out, file)).size }))
  .sort((a, b) => b.bytes - a.bytes)
const raw = sizes.reduce((sum, f) => sum + f.bytes, 0)
const gzip = files.reduce((sum, file) => sum + gzipSync(fs.readFileSync(path.join(out, file))).length, 0)
fs.rmSync(out, { recursive: true, force: true })

const kb = bytes => `${(bytes / 1000).toFixed(1)} kB`
const lines = [
  `Initial JS: ${kb(raw)} (${kb(gzip)} gzip) across ${files.length} files, budget ${kb(BUDGET_BYTES)}`,
  `Build time: ${buildSeconds.toFixed(1)} s`,
  'Largest initial files:',
  ...sizes.slice(0, 5).map(f => `  ${kb(f.bytes).padStart(10)}  ${f.file}`),
]
console.log(lines.join('\n'))

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Bundle budget\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`)
}

if (raw > BUDGET_BYTES) {
  console.error(`\nInitial JS is ${kb(raw - BUDGET_BYTES)} over budget. Check which chunks index.html preloads.`)
  process.exit(1)
}
