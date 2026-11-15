// AC-003 (FR-009) — per-stage acceptance checklist on the real <Dashboard>.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  getAllAcceptanceItems,
  getAllStages,
  putAcceptanceItem,
  putProject,
  putStage,
} from '../db'
import { demoProject, demoStages, renderDashboard, resetIndexedDb } from './m1TestUtils'
import type { AcceptanceItem } from '../types'

// The check date must come from an injected clock, never the machine clock.
const FIXED_NOW = new Date(2026, 0, 20, 10, 0, 0)
const clock = () => FIXED_NOW

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
  await Promise.all(demoStages.map((s) => putStage(s)))
})

afterEach(() => {
  cleanup()
})

function item(overrides: Partial<AcceptanceItem>): AcceptanceItem {
  return {
    id: 'acc-1',
    projectId: demoProject.id,
    stageId: 'stage-demo',
    name: '示範驗收項目',
    passed: false,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

async function addItem(stageId: string, name: string, note?: string) {
  const before = (await getAllAcceptanceItems()).length
  fireEvent.click(screen.getByTestId(`add-acceptance-${stageId}`))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByTestId('acceptance-name-input'), {
    target: { value: name },
  })
  if (note !== undefined) {
    fireEvent.change(within(dialog).getByTestId('acceptance-note-input'), {
      target: { value: note },
    })
  }
  fireEvent.click(within(dialog).getByTestId('acceptance-submit'))
  await waitFor(async () => {
    expect(await getAllAcceptanceItems()).toHaveLength(before + 1)
  })
  const id = (await getAllAcceptanceItems()).find((i) => i.name === name)!.id
  await waitFor(() => expect(screen.getByTestId(`acceptance-item-${id}`)).toBeInTheDocument())
  return id
}

describe('AC-003 acceptance checklist on the dashboard', () => {
  it('AC-003: every stage gets its own checklist block, starting at 驗收 0/0', async () => {
    await renderDashboard()
    expect(screen.getByRole('heading', { name: '階段驗收' })).toBeInTheDocument()
    for (const stage of demoStages) {
      const block = screen.getByTestId(`acceptance-stage-${stage.id}`)
      expect(within(block).getByRole('heading', { name: stage.name })).toBeInTheDocument()
      expect(screen.getByTestId(`acceptance-progress-${stage.id}`)).toHaveTextContent('驗收 0/0')
      expect(screen.getByTestId(`acceptance-empty-${stage.id}`)).toBeInTheDocument()
      // The stage row in 「階段與工期」 shows the same progress.
      expect(screen.getByTestId(`stage-acceptance-${stage.id}`)).toHaveTextContent('驗收 0/0')
    }
  })

  it('AC-003: adds a custom item to one stage and persists it', async () => {
    await renderDashboard({ clock })
    const id = await addItem('stage-water', '示範驗收：插座通電', '示範備註：全室')

    const row = screen.getByTestId(`acceptance-item-${id}`)
    expect(within(row).getByText('示範驗收：插座通電')).toBeInTheDocument()
    expect(within(row).getByText('未通過')).toBeInTheDocument()
    expect(within(row).getByText('備註：示範備註：全室')).toBeInTheDocument()
    expect(screen.getByTestId('acceptance-progress-stage-water')).toHaveTextContent('驗收 0/1')
    expect(screen.getByTestId('stage-acceptance-stage-water')).toHaveTextContent('驗收 0/1')
    // Other stages are unaffected.
    expect(screen.getByTestId('acceptance-progress-stage-demo')).toHaveTextContent('驗收 0/0')

    const stored = await getAllAcceptanceItems()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      projectId: demoProject.id,
      stageId: 'stage-water',
      name: '示範驗收：插座通電',
      note: '示範備註：全室',
      passed: false,
    })
    expect(stored[0]!.checkedOn).toBeUndefined()
  })

  it('AC-003: a blank name shows an error and writes nothing', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByTestId('add-acceptance-stage-water'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByTestId('acceptance-name-input'), {
      target: { value: '   ' },
    })
    fireEvent.click(within(dialog).getByTestId('acceptance-submit'))
    await waitFor(() =>
      expect(within(dialog).getByTestId('acceptance-name-error')).toHaveTextContent(
        '驗收項目名稱不可為空',
      ),
    )
    expect(await getAllAcceptanceItems()).toHaveLength(0)
  })

  it('AC-003: passing an item records the check date automatically and updates 驗收 x/y', async () => {
    await renderDashboard({ clock })
    const first = await addItem('stage-water', '示範驗收：插座通電')
    const second = await addItem('stage-water', '示範驗收：給水試壓')

    fireEvent.click(screen.getByTestId(`acceptance-toggle-${first}`))
    await waitFor(() =>
      expect(screen.getByTestId(`acceptance-checked-on-${first}`)).toHaveTextContent(
        '檢查日：2026-01-20',
      ),
    )
    expect(screen.getByTestId(`acceptance-toggle-${first}`)).toBeChecked()
    expect(screen.getByTestId(`acceptance-toggle-${second}`)).not.toBeChecked()
    expect(screen.getByTestId('acceptance-progress-stage-water')).toHaveTextContent('驗收 1/2')
    expect(screen.getByTestId('stage-acceptance-stage-water')).toHaveTextContent('驗收 1/2')
    expect(screen.getByTestId('acceptance-overall')).toHaveTextContent('全部階段 驗收 1/2')

    const stored = await getAllAcceptanceItems()
    const storedFirst = stored.find((i) => i.id === first)!
    expect(storedFirst.passed).toBe(true)
    expect(storedFirst.checkedOn).toBe('2026-01-20')
    expect(stored.find((i) => i.id === second)!.passed).toBe(false)
  })

  it('AC-003: un-passing an item clears the check date', async () => {
    await putAcceptanceItem(item({ id: 'acc-on', passed: true, checkedOn: '2026-01-15' }))
    await renderDashboard({ clock })
    await waitFor(() => expect(screen.getByTestId('acceptance-toggle-acc-on')).toBeChecked())
    fireEvent.click(screen.getByTestId('acceptance-toggle-acc-on'))
    await waitFor(() => expect(screen.getByTestId('acceptance-toggle-acc-on')).not.toBeChecked())
    expect(screen.queryByTestId('acceptance-checked-on-acc-on')).not.toBeInTheDocument()
    const stored = await getAllAcceptanceItems()
    expect(stored[0]!.passed).toBe(false)
    expect(stored[0]!.checkedOn).toBeUndefined()
  })

  it('AC-003: a completed stage with un-passed items shows a text warning', async () => {
    // stage-demo is `completed` in the fixture.
    await putAcceptanceItem(item({ id: 'acc-a', name: '示範驗收：垃圾清運', passed: true, checkedOn: '2026-01-09' }))
    await putAcceptanceItem(item({ id: 'acc-b', name: '示範驗收：管線保護', passed: false }))
    await renderDashboard({ clock })

    const warning = await screen.findByTestId('acceptance-warning-stage-demo')
    expect(warning).toHaveTextContent('階段已標記完成，但仍有 1 項驗收未通過')
    expect(warning).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('stage-acceptance-warning-stage-demo')).toHaveTextContent(
      '階段已標記完成，但仍有 1 項驗收未通過',
    )
    expect(screen.getByTestId('stage-acceptance-stage-demo')).toHaveTextContent('驗收 1/2')

    // Passing the last item clears the warning.
    fireEvent.click(screen.getByTestId('acceptance-toggle-acc-b'))
    await waitFor(() =>
      expect(screen.queryByTestId('acceptance-warning-stage-demo')).not.toBeInTheDocument(),
    )
    expect(screen.queryByTestId('stage-acceptance-warning-stage-demo')).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-acceptance-stage-demo')).toHaveTextContent('驗收 2/2')
  })

  it('AC-003: an unfinished stage with un-passed items shows no warning', async () => {
    // stage-water is `in_progress` in the fixture.
    await putAcceptanceItem(item({ id: 'acc-w', stageId: 'stage-water', passed: false }))
    await renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('acceptance-progress-stage-water')).toHaveTextContent('驗收 0/1'),
    )
    expect(screen.queryByTestId('acceptance-warning-stage-water')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-acceptance-warning-stage-water')).not.toBeInTheDocument()
  })

  it('AC-003: edits an existing item', async () => {
    await renderDashboard()
    const id = await addItem('stage-wood', '示範驗收：原名稱')
    fireEvent.click(screen.getByTestId(`acceptance-edit-${id}`))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('acceptance-name-input')).toHaveValue('示範驗收：原名稱')
    fireEvent.change(within(dialog).getByTestId('acceptance-name-input'), {
      target: { value: '示範驗收：新名稱' },
    })
    fireEvent.change(within(dialog).getByTestId('acceptance-note-input'), {
      target: { value: '示範備註' },
    })
    fireEvent.click(within(dialog).getByTestId('acceptance-submit'))
    await waitFor(() =>
      expect(screen.getByTestId(`acceptance-item-${id}`)).toHaveTextContent('示範驗收：新名稱'),
    )
    const stored = await getAllAcceptanceItems()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id, name: '示範驗收：新名稱', note: '示範備註', stageId: 'stage-wood' })
  })

  it('AC-003: delete asks for confirmation; cancel keeps the item, confirm removes it', async () => {
    await renderDashboard()
    const id = await addItem('stage-wood', '示範驗收：要刪除')

    fireEvent.click(screen.getByTestId(`acceptance-delete-${id}`))
    const confirm = await screen.findByRole('dialog')
    expect(confirm).toHaveTextContent('確定要刪除驗收項目「示範驗收：要刪除」嗎？')
    fireEvent.click(within(confirm).getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument())
    expect(screen.getByTestId(`acceptance-item-${id}`)).toBeInTheDocument()
    expect(await getAllAcceptanceItems()).toHaveLength(1)

    fireEvent.click(screen.getByTestId(`acceptance-delete-${id}`))
    const confirm2 = await screen.findByRole('dialog')
    fireEvent.click(within(confirm2).getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(screen.queryByTestId(`acceptance-item-${id}`)).not.toBeInTheDocument(),
    )
    expect(await getAllAcceptanceItems()).toHaveLength(0)
    expect(screen.getByTestId('acceptance-progress-stage-wood')).toHaveTextContent('驗收 0/0')
  })

  it('AC-003: items, pass state and check date persist across a remount', async () => {
    await renderDashboard({ clock })
    const id = await addItem('stage-water', '示範驗收：插座通電')
    fireEvent.click(screen.getByTestId(`acceptance-toggle-${id}`))
    await waitFor(async () => {
      expect((await getAllAcceptanceItems())[0]!.passed).toBe(true)
    })

    cleanup()
    await renderDashboard({ clock })
    await waitFor(() => expect(screen.getByTestId(`acceptance-item-${id}`)).toBeInTheDocument())
    expect(screen.getByTestId(`acceptance-toggle-${id}`)).toBeChecked()
    expect(screen.getByTestId(`acceptance-checked-on-${id}`)).toHaveTextContent('檢查日：2026-01-20')
    expect(screen.getByTestId('stage-acceptance-stage-water')).toHaveTextContent('驗收 1/1')
  })

  it('AC-003: deleting a stage also removes its acceptance items', async () => {
    await putAcceptanceItem(item({ id: 'acc-wood', stageId: 'stage-wood' }))
    await putAcceptanceItem(item({ id: 'acc-water', stageId: 'stage-water' }))
    await renderDashboard()
    await waitFor(() => expect(screen.getByTestId('acceptance-item-acc-wood')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '刪除階段 木作' }))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(screen.queryByTestId('acceptance-stage-stage-wood')).not.toBeInTheDocument(),
    )
    expect((await getAllStages()).map((s) => s.id).sort()).toEqual(['stage-demo', 'stage-water'])
    expect((await getAllAcceptanceItems()).map((i) => i.id)).toEqual(['acc-water'])
    expect(screen.getByTestId('acceptance-item-acc-water')).toBeInTheDocument()
  })
})
