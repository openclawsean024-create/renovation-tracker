// AC-007 — quality gate & CI wiring. These checks keep the gate from silently
// regressing: the lint script must exist, and the workflow must run inside
// `web/` against `web/package-lock.json` with lint / typecheck / test / build
// as separate failing steps.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest runs with cwd = web/ (see vite.config.ts / SOP.md).
const webRoot = process.cwd()
const repoRoot = resolve(webRoot, '..')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('AC-007 quality gate', () => {
  it('AC-007: package.json exposes lint, typecheck, test and build scripts', () => {
    const pkg = JSON.parse(read(resolve(webRoot, 'package.json'))) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.lint).toBe('eslint .')
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit')
    expect(pkg.scripts.test).toBe('vitest run')
    expect(pkg.scripts.build).toContain('vite build')
  })

  it('AC-007: an ESLint flat config exists for the web project', () => {
    const config = read(resolve(webRoot, 'eslint.config.js'))
    expect(config).toContain('typescript-eslint')
    expect(config).toContain('eslint-plugin-react-hooks')
  })

  it('AC-007: CI runs in web/ against web/package-lock.json', () => {
    const ci = read(resolve(repoRoot, '.github/workflows/ci.yml'))
    expect(ci).toMatch(/working-directory:\s*web\b/)
    const lockPaths = ci.match(/cache-dependency-path:\s*web\/package-lock\.json/g) ?? []
    // One per job that installs dependencies (lint, test, build, deploy).
    expect(lockPaths.length).toBeGreaterThanOrEqual(3)
    expect(ci).toMatch(/pull_request/)
  })

  it('AC-007: CI fails when lint, typecheck, test or build fails', () => {
    const ci = read(resolve(repoRoot, '.github/workflows/ci.yml'))
    for (const cmd of ['npm run lint', 'npm run typecheck', 'npm test', 'npm run build']) {
      expect(ci).toMatch(new RegExp(`^\\s+- run: ${cmd}\\s*$`, 'm'))
    }
    // No step may swallow a failure.
    expect(ci).not.toMatch(/continue-on-error/)
    expect(ci).not.toMatch(/\|\|\s*true/)
    // The previous file was unparseable because `${{ }}` sat inside a YAML
    // flow mapping (`with: { ... }`); keep every `with:` in block style.
    expect(ci).not.toMatch(/with:\s*\{/)
  })
})
