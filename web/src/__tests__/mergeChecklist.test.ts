// AC-009 — merge checklist (decoration-tracker → this repo). Verifies that the
// four M1 items are recorded as merged in STATUS.md with their test files,
// that the merged modules exist here, and that the items PRD/SPEC.md §13.2
// lists as "不搬" really were not brought over.
//
// Whether decoration-tracker itself is still un-archived is checked with
// `gh repo view … --json isArchived` (GOAL AC-009); it needs the network, so
// it is recorded in STATUS.md rather than asserted here.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = process.cwd()
const repoRoot = resolve(webRoot, '..')
const srcRoot = resolve(webRoot, 'src')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'test') continue
      sourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('AC-009 merge checklist', () => {
  const status = read(resolve(repoRoot, 'STATUS.md'))

  it('AC-009: STATUS.md marks the four M1 merge items as 已搬入', () => {
    const count = (status.match(/已搬入/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(4)
    const rows = status.split('\n').filter((line) => line.startsWith('|') && line.includes('已搬入'))
    const text = rows.join('\n')
    for (const item of ['預算變更單', '合約金額', '驗收清單', 'ESLint']) {
      expect(text).toContain(item)
    }
  })

  it('AC-009: each merged item names test files that really exist', () => {
    const rows = status.split('\n').filter((line) => line.startsWith('|') && line.includes('已搬入'))
    const named = new Set<string>()
    for (const row of rows) {
      for (const match of row.matchAll(/`([A-Za-z.]+\.test\.tsx?)`/g)) named.add(match[1]!)
    }
    for (const file of [
      'changeOrders.test.ts',
      'changeOrders.db.test.ts',
      'Dashboard.changeOrders.test.tsx',
      'contract.test.ts',
      'Dashboard.contract.test.tsx',
      'acceptance.test.ts',
      'acceptance.db.test.ts',
      'Dashboard.acceptance.test.tsx',
      'qualityGate.test.ts',
    ]) {
      expect(named).toContain(file)
    }
    for (const file of named) {
      expect(existsSync(resolve(srcRoot, '__tests__', file))).toBe(true)
    }
  })

  it('AC-009: the merged modules exist in this repo', () => {
    for (const file of [
      'src/changeOrders.ts',
      'src/contract.ts',
      'src/acceptance.ts',
      'src/components/ChangeOrderSection.tsx',
      'src/components/ContractSection.tsx',
      'src/components/AcceptanceSection.tsx',
      'eslint.config.js',
    ]) {
      expect(existsSync(resolve(webRoot, file))).toBe(true)
    }
  })

  it('AC-009: persistence stays on IndexedDB — no localStorage implementation was copied', () => {
    const offenders = sourceFiles(srcRoot).filter((file) => /localStorage/.test(read(file)))
    expect(offenders).toEqual([])
  })

  it('AC-009: the decoration-tracker timeline helpers and mock photo store were not copied', () => {
    const sources = sourceFiles(srcRoot)
    // `decoration-photos` is the mock photo store's IndexedDB name and
    // `decoration-tracker:db` its localStorage key.
    for (const banned of [
      'advanceStage',
      'progressOf',
      'seedDemoData',
      'decoration-photos',
      'decoration-tracker:db',
    ]) {
      const offenders = sources.filter((file) => read(file).includes(banned))
      expect(offenders).toEqual([])
    }
    expect(sources.filter((file) => /photoStore\.tsx?$/.test(file))).toEqual([])
    expect(existsSync(resolve(webRoot, 'public/dashboard.html'))).toBe(false)
  })

  it('AC-009: the tech stack was not switched to React 19 / Router 7 / Tailwind', () => {
    const pkg = JSON.parse(read(resolve(webRoot, 'package.json'))) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(pkg.dependencies.react).toMatch(/^\^18\./)
    expect(pkg.dependencies['react-dom']).toMatch(/^\^18\./)
    expect(pkg.dependencies['react-router-dom']).toMatch(/^\^6\./)
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(all).filter((name) => /tailwind/.test(name))).toEqual([])
    expect(Object.keys(all)).not.toContain('gh-pages')
    expect(pkg.scripts.deploy).toBeUndefined()
  })

  it('AC-009: the FR table in STATUS.md reflects the implemented state', () => {
    for (const fr of ['FR-007', 'FR-008', 'FR-009', 'FR-010', 'FR-011']) {
      const row = status.split('\n').find((line) => line.startsWith(`| ${fr} `))
      expect(row).toBeDefined()
      expect(row).toContain('已實作')
      expect(row).toContain('renovation-tracker')
    }
  })
})
