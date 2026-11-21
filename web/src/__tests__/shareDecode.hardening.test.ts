// Codex review (2026-11-22) — AC-005 share decoder hardening. Crafted or
// tampered links must be rejected with a readable error instead of showing
// contradictory privacy notices, impossible figures, or freezing the page.

import { describe, expect, it } from 'vitest'
import {
  SHARE_HASH_KEY,
  buildShareSnapshot,
  decodeShareHash,
  encodeShareSnapshot,
  type ShareSnapshot,
} from '../share'

/**
 * A genuine version 1 link, encoded once from a fixed JSON document in the
 * shape the pre-M1 encoder (commit 344da4d) produced. It is a literal so the
 * current encoder and decoder cannot drift together unnoticed.
 */
const FIXED_V1_HASH =
  'eyJ2ZXJzaW9uIjoxLCJnZW5lcmF0ZWRBdCI6IjIwMjYtMDktMjBUMTA6MDA6MDAuMDAwWiIsInByb2plY3QiOnsibmFtZSI6IuekuuevhOW3peeoiyIsImFkZHJlc3MiOiLmuKzoqabluILnpLrnr4Tot68gMSDomZ8iLCJzdGF0dXMiOiJpbl9wcm9ncmVzcyIsInBsYW5uZWRTdGFydCI6IjIwMjYtMDEtMDUiLCJwbGFubmVkRW5kIjoiMjAyNi0wMi0wNiIsImNyZWF0ZWRBdCI6IjIwMjYtMDEtMDFUMDA6MDA6MDAuMDAwWiIsInVwZGF0ZWRBdCI6IjIwMjYtMDEtMTVUMDA6MDA6MDAuMDAwWiJ9LCJzdGFnZXMiOlt7ImlkIjoic3RhZ2UtMSIsIm5hbWUiOiLmi4bpmaQiLCJvcmRlciI6MSwic3RhdHVzIjoiY29tcGxldGVkIiwicGxhbm5lZFN0YXJ0IjoiMjAyNi0wMS0wNSIsInBsYW5uZWRFbmQiOiIyMDI2LTAxLTA5IiwiYWN0dWFsU3RhcnQiOiIyMDI2LTAxLTA1IiwiYWN0dWFsRW5kIjoiMjAyNi0wMS0wOSJ9XSwic3RhZ2VTdW1tYXJ5Ijp7InRvdGFsIjoxLCJjb21wbGV0ZWQiOjEsImluUHJvZ3Jlc3MiOjAsImJsb2NrZWQiOjAsIm5vdFN0YXJ0ZWQiOjAsInBlcmNlbnRDb21wbGV0ZSI6MTAwfSwiZ2FudHQiOnsidG90YWxEYXlzIjozMywiZGF5cyI6WyIyMDI2LTAxLTA1Il0sInJvd3MiOlt7InN0YWdlSWQiOiJzdGFnZS0xIiwibmFtZSI6IuaLhumZpCIsInN0YXJ0SW5kZXgiOjAsImVuZEluZGV4Ijo0LCJzcGFuIjo1LCJ3aXRoaW5XaW5kb3ciOnRydWV9XX0sInBob3RvcyI6W3siaWQiOiJwaG90by0xIiwia2luZCI6ImJlZm9yZSIsInRha2VuT24iOiIyMDI2LTAxLTA1IiwiZmlsZU5hbWUiOiJkZW1vLnBuZyIsIm1pbWVUeXBlIjoiaW1hZ2UvcG5nIn1dLCJidWRnZXRTdW1tYXJ5Ijp7InRvdGFsIjowLCJ0b3RhbFBsYW5uZWQiOjAsInRvdGFsQWN0dWFsIjowLCJyZW1haW5pbmciOjAsImlzT3ZlcnJ1biI6ZmFsc2UsInRvdGFsT3ZlcnJ1biI6MCwib3ZlcnJ1bkl0ZW1Db3VudCI6MCwicGF5bWVudENvdW50cyI6eyJ1bnBhaWQiOjAsInBhcnRpYWwiOjAsInBhaWQiOjB9fSwic2NoZWR1bGVTdW1tYXJ5Ijp7InRvdGFsIjowLCJ1cGNvbWluZyI6MCwib3ZlcmR1ZSI6MCwiY29tcGxldGVkIjowfSwid2FycmFudHlTdW1tYXJ5Ijp7InRvdGFsIjoxLCJleHBpcmluZ1Nvb24iOjAsImV4cGlyZWQiOjAsImFjdGl2ZSI6MX0sIndhcnJhbnRpZXMiOlt7ImlkIjoid2FycmFudHktMSIsIml0ZW1OYW1lIjoi56S656-E5L-d5Zu66aCF55uuIiwicHJvdmlkZXIiOiLnpLrnr4Tlu6DllYYiLCJjb250YWN0IjoiZGVtb0BleGFtcGxlLmNvbSIsInN0YXJ0c09uIjoiMjAyNi0wMS0wMSIsImVuZHNPbiI6IjIwMjctMDEtMDEiLCJzdGF0dXMiOiJhY3RpdmUiLCJkYXlzUmVtYWluaW5nIjozMDB9XX0'

function decode(snapshot: unknown) {
  return decodeShareHash(`#${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot as ShareSnapshot)}`)
}

function expectShapeError(snapshot: unknown, message?: string) {
  const result = decode(snapshot)
  if (result.ok) throw new Error('expected the link to be rejected')
  expect(result.error.code).toBe('shape')
  if (message) expect(result.error.message).toBe(message)
}

function base(privacy?: { includeAddress?: boolean; includeContacts?: boolean }) {
  return buildShareSnapshot({
    project: {
      name: '示範工程',
      address: '測試市示範路 1 號',
      status: 'in_progress',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-02-06',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    },
    stages: [
      {
        id: 'idb-stage-1',
        name: '拆除',
        order: 1,
        status: 'completed',
        plannedStart: '2026-01-05',
        plannedEnd: '2026-01-09',
      },
    ],
    stageSummary: { total: 1, completed: 1, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 100 },
    gantt: { totalDays: 33, days: [], rows: [] },
    photos: [],
    budgetSummary: {
      total: 0,
      totalPlanned: 0,
      totalActual: 0,
      remaining: 0,
      isOverrun: false,
      totalOverrun: 0,
      overrunItemCount: 0,
      paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
    },
    warranties: [
      {
        id: 'idb-w-1',
        itemName: '示範保固項目',
        provider: '示範廠商',
        contact: 'demo@example.com',
        startsOn: '2026-01-01',
        endsOn: '2027-01-01',
      },
    ],
    generatedAt: '2026-01-20T02:00:00.000Z',
    changeOrders: [
      { id: 'idb-co-1', title: '示範追加', amount: 12000, status: 'approved', decidedOn: '2026-01-18' },
      { id: 'idb-co-2', title: '示範追減', amount: -3000, status: 'pending' },
    ],
    contractSummary: {
      contractAmount: 1000000,
      approvedChangeTotal: 12000,
      adjustedTotal: 1012000,
      receivedAmount: 400000,
      outstanding: 612000,
      isOverpaid: false,
    },
    acceptanceItems: [
      { stageId: 'idb-stage-1', passed: true },
      { stageId: 'idb-stage-1', passed: false },
    ],
    scheduleContacts: [{ workerName: '示範水電師傅', phone: '0900-000-000' }],
    ...(privacy ? { privacy } : {}),
  })
}

describe('AC-005 fixed version 1 link', () => {
  it('AC-005: a genuine v1 link (fixed fixture) still opens, address and contact included', () => {
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${FIXED_V1_HASH}`)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.snapshot.version).toBe(1)
    expect(result.snapshot.project.name).toBe('示範工程')
    expect(result.snapshot.project.address).toBe('測試市示範路 1 號')
    expect(result.snapshot.warranties![0]!.contact).toBe('demo@example.com')
    expect(result.snapshot.changeOrders).toBeUndefined()
  })
})

describe('AC-005 privacy marker must match the contents', () => {
  it('AC-005: genuine links in every privacy combination still decode', () => {
    for (const privacy of [
      undefined,
      { includeAddress: true },
      { includeContacts: true },
      { includeAddress: true, includeContacts: true },
    ]) {
      expect(decode(base(privacy)).ok).toBe(true)
    }
  })

  it('AC-005: rejects an address under a marker that says no address', () => {
    const snap = base()
    expectShapeError(
      { ...snap, project: { ...snap.project, address: '測試市示範路 1 號' } },
      '分享連結的個資設定與內容不一致',
    )
  })

  it('AC-005: rejects a warranty contact under a marker that says no contacts', () => {
    const snap = base()
    expectShapeError(
      { ...snap, warranties: snap.warranties!.map((w) => ({ ...w, contact: 'demo@example.com' })) },
      '分享連結的個資設定與內容不一致',
    )
  })

  it('AC-005: rejects worker phones under a marker that says no contacts', () => {
    const snap = base()
    expectShapeError(
      { ...snap, scheduleContacts: [{ id: 'schedule-1', workerName: '示範', phone: '0900-000-000' }] },
      '分享連結的個資設定與內容不一致',
    )
  })

  it('AC-005: a v2 link without a marker may not carry personal data either', () => {
    const { privacy, ...rest } = base({ includeAddress: true })
    void privacy
    expectShapeError(rest, '分享連結的個資設定與內容不一致')
  })
})

describe('AC-005 impossible figures are rejected', () => {
  it.each([
    ['a zero change-order amount', (s: ShareSnapshot) => ({ ...s, changeOrders: [{ ...s.changeOrders![0]!, amount: 0 }] })],
    ['a change-order amount with 3 decimals', (s: ShareSnapshot) => ({ ...s, changeOrders: [{ ...s.changeOrders![0]!, amount: 1.234 }] })],
    ['a negative contract amount', (s: ShareSnapshot) => ({ ...s, contractSummary: { ...s.contractSummary!, contractAmount: -1, adjustedTotal: 11999, outstanding: -388001, isOverpaid: true } })],
    ['a negative received amount', (s: ShareSnapshot) => ({ ...s, contractSummary: { ...s.contractSummary!, receivedAmount: -5, outstanding: 1012005 } })],
    ['an adjusted total that does not add up', (s: ShareSnapshot) => ({ ...s, contractSummary: { ...s.contractSummary!, adjustedTotal: 2000000 } })],
    ['an outstanding amount that does not add up', (s: ShareSnapshot) => ({ ...s, contractSummary: { ...s.contractSummary!, outstanding: 1 } })],
    ['an approved total that ignores the listed orders', (s: ShareSnapshot) => ({ ...s, contractSummary: { ...s.contractSummary!, approvedChangeTotal: 50000, adjustedTotal: 1050000, outstanding: 650000 } })],
    ['a fractional photo count', (s: ShareSnapshot) => ({ ...s, photoReport: { stages: [{ stageId: 'stage-1', count: 1.5 }], unassigned: { count: 0 } } })],
    ['more passed than total inspections overall', (s: ShareSnapshot) => ({ ...s, acceptanceSummary: { ...s.acceptanceSummary!, passed: 5 } })],
    ['more passed than total inspections in a stage', (s: ShareSnapshot) => ({ ...s, acceptanceSummary: { ...s.acceptanceSummary!, stages: [{ stageId: 'stage-1', total: 1, passed: 2, hasWarning: false }] } })],
  ])('AC-005: rejects %s', (_label, tamper) => {
    expectShapeError(tamper(base()))
  })
})

describe('AC-005 project date range', () => {
  it('AC-005: rejects a project window long enough to freeze the page', () => {
    const snap = base()
    expectShapeError(
      { ...snap, project: { ...snap.project, plannedStart: '1000-01-01', plannedEnd: '9999-12-31' } },
      '工程日期範圍不正確或過長',
    )
  })

  it('AC-005: rejects an end date before the start date and an impossible calendar date', () => {
    const snap = base()
    expectShapeError({ ...snap, project: { ...snap.project, plannedEnd: '2026-01-01' } })
    expectShapeError({ ...snap, project: { ...snap.project, plannedStart: '2026-02-30' } })
  })
})
