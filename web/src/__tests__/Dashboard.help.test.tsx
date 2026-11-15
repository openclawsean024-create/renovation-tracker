// AC-006 (FR-011) — README, user guide and the in-app 「使用說明」 entry.
// File name contains "help" so `npm test -- help` runs it (GOAL AC-006).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { putProject } from '../db'
import { demoProject, renderDashboard, resetIndexedDb } from './m1TestUtils'

// Vitest runs with cwd = web/.
const repoRoot = resolve(process.cwd(), '..')

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
})

afterEach(() => {
  cleanup()
})

describe('AC-006 in-app help entry', () => {
  it('AC-006: the dashboard has a control with the accessible name 「使用說明」', async () => {
    await renderDashboard()
    const entry = screen.getByRole('button', { name: '使用說明' })
    expect(entry).toBeInTheDocument()
    expect(entry).toBeEnabled()
    expect(entry).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('AC-006: opening it shows the guide for both 業者端 and 屋主端 and the key limitations', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: '使用說明' }))
    const dialog = await screen.findByRole('dialog', { name: '使用說明' })
    expect(within(dialog).getByRole('heading', { name: /業者端/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: /屋主端/ })).toBeInTheDocument()
    const content = within(dialog).getByTestId('help-dialog')
    expect(content).toHaveTextContent('清除瀏覽器資料')
    expect(content).toHaveTextContent('本機紀錄，非屋主線上簽核')
    expect(content).toHaveTextContent('分享連結未加密、無法撤銷')
    expect(content).toHaveTextContent('docs/USER-GUIDE.md')
  })

  it('AC-006: the help dialog can be closed again', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: '使用說明' }))
    const dialog = await screen.findByRole('dialog', { name: '使用說明' })
    fireEvent.click(within(dialog).getByTestId('help-close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('AC-006 README and user guide', () => {
  it('AC-006: README.md has every required section', () => {
    const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8')
    for (const heading of [
      '## 功能',
      '## 本機啟動',
      '## 驗證',
      '## 資料存放',
      '## 分享限制',
      '## 假資料',
      '## 文件索引',
    ]) {
      expect(readme).toContain(heading)
    }
    expect(readme).toContain('清除瀏覽器資料')
    expect(readme).toContain('docs/USER-GUIDE.md')
    for (const cmd of ['npm run lint', 'npm run typecheck', 'npm test', 'npm run build']) {
      expect(readme).toContain(cmd)
    }
  })

  it('AC-006: docs/USER-GUIDE.md covers 業者端 and 屋主端', () => {
    const guide = readFileSync(resolve(repoRoot, 'docs/USER-GUIDE.md'), 'utf8')
    expect(guide).toContain('## 業者端')
    expect(guide).toContain('## 屋主端')
    for (const topic of ['階段', '照片', '預算', '變更單', '驗收', '排程', '保固', '分享連結']) {
      expect(guide).toContain(topic)
    }
    expect(guide.indexOf('## 業者端')).toBeLessThan(guide.indexOf('## 屋主端'))
  })

  it('AC-006: neither document claims the change-order decision is a signature', () => {
    for (const file of ['README.md', 'docs/USER-GUIDE.md']) {
      const text = readFileSync(resolve(repoRoot, file), 'utf8')
      expect(text).toMatch(/不是電子簽章/)
    }
  })
})
