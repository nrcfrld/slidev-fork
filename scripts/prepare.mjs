// Agent skills are only for local development. They come from unpinned GitHub
// sources, so a frozen-lockfile install in CI fails whenever one of them
// changes upstream. Skip the sync there.
import { execSync } from 'node:child_process'
import process from 'node:process'

execSync('simple-git-hooks', { stdio: 'inherit' })
if (!process.env.CI)
  execSync('skills experimental_sync -y -r', { stdio: 'inherit' })
