// AC-008 — fake data & credential hygiene. Walks the repository's own text
// files (no git needed) and fails if anything that looks like the
// decoration-tracker demo persona, a real-looking mobile number, or a
// credential has been committed.
//
// The forbidden strings are assembled at runtime so this file never contains
// them literally (the GOAL AC-008 `git grep` must stay empty for this file
// as well).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSeed } from '../seed'

const repoRoot = resolve(process.cwd(), '..')

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.vercel'])
const TEXT_EXT = /\.(ts|tsx|js|json|md|html|css|yml|yaml)$/
// The spec documents quote the forbidden words while explaining the rule,
// exactly as the GOAL AC-008 command excludes them.
const EXCLUDED_FILES = new Set(['PRD/SPEC.md', 'GOAL.md', 'SOP.md', 'web/package-lock.json'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const allFiles = walk(repoRoot)
const textFiles = allFiles
  .map((full) => ({ full, rel: relative(repoRoot, full).split(sep).join('/') }))
  .filter(({ rel }) => TEXT_EXT.test(rel) && !EXCLUDED_FILES.has(rel))

function findMatches(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const { full, rel } of textFiles) {
    const lines = readFileSync(full, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      if (pattern.test(line)) hits.push(`${rel}:${idx + 1}`)
    })
  }
  return hits
}

describe('AC-008 fake data and credential safety', () => {
  it('AC-008: the scan actually covers source, tests and docs', () => {
    const rels = textFiles.map((f) => f.rel)
    expect(rels).toContain('web/src/seed.ts')
    expect(rels).toContain('web/src/__tests__/Dashboard.schedule.test.tsx')
    expect(rels).toContain('README.md')
    expect(rels).toContain('docs/USER-GUIDE.md')
    expect(rels.length).toBeGreaterThan(60)
  })

  it('AC-008: the decoration-tracker demo persona was not carried over', () => {
    const surname = '林'
    const persona = new RegExp(`${surname}先生|${surname}太太|${surname}宅`)
    expect(findMatches(persona)).toEqual([])
  })

  it('AC-008: no credential-shaped string is present', () => {
    const patterns = [
      new RegExp('gh' + 'p_[A-Za-z0-9]{10,}'),
      new RegExp('AK' + 'IA[A-Z0-9]{12,}'),
      new RegExp('sk' + '-[A-Za-z0-9]{16}'),
      new RegExp('BEGIN (RSA|EC|OPENSSH) ' + 'PRIVATE KEY'),
    ]
    for (const pattern of patterns) {
      expect(findMatches(pattern)).toEqual([])
    }
  })

  it('AC-008: no .env file exists in the repository tree', () => {
    const envFiles = allFiles
      .map((full) => relative(repoRoot, full).split(sep).join('/'))
      .filter((rel) => /(^|\/)\.env/.test(rel))
    expect(envFiles).toEqual([])
  })

  it('AC-008: source and tests contain no real-looking Taiwanese mobile number', () => {
    // Ten digits starting with 09 and written without separators looks like a
    // real number. Fixtures must use the obviously fake 0900-000-000 instead.
    const mobile = /(^|[^0-9])09[0-9]{8}([^0-9]|$)/
    const hits = findMatches(mobile).filter((hit) => hit.startsWith('web/src/'))
    expect(hits).toEqual([])
  })

  it('AC-008: test fixtures use the obvious fake phone number', () => {
    const fixture = readFileSync(
      resolve(repoRoot, 'web/src/__tests__/Dashboard.schedule.test.tsx'),
      'utf8',
    )
    expect(fixture).toContain("phone: '0900-000-000'")
  })

  it('AC-008: the first-run seed holds no personal data', () => {
    const seed = buildSeed()
    expect(seed.project.name).toBe('我的裝修工程')
    expect(seed.project.address).toBeUndefined()
    expect(seed.stages.map((s) => s.name)).toEqual([
      '拆除',
      '水電',
      '泥作',
      '木作',
      '油漆',
      '安裝',
      '驗收',
    ])
    const json = JSON.stringify(seed)
    expect(json).not.toMatch(/先生|太太|小姐/)
    expect(json).not.toMatch(/09[0-9]{2}/)
    expect(json).not.toMatch(/@/)
  })
})
