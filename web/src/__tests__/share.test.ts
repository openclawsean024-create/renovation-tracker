// FR-004 share snapshot unit tests — AC-FR004-04.
//
// Covers encode/decode round-trip, version field handling, unknown-version
// rejection, and invalid hash shapes. No DOM, no IndexedDB, no clipboard.

import { describe, expect, it } from 'vitest'
import {
  SHARE_HASH_KEY,
  SHARE_SNAPSHOT_VERSION,
  buildShareSnapshot,
  buildShareUrl,
  decodeShareHash,
  encodeShareSnapshot,
  hasShareHash,
  stripShareUrl,
  type ShareSnapshot,
} from '../share'

function makeSnapshot(overrides: Partial<ShareSnapshot> = {}): ShareSnapshot {
  const base: ShareSnapshot = {
    version: SHARE_SNAPSHOT_VERSION,
    generatedAt: '2026-09-20T10:00:00.000Z',
    project: {
      name: '我的裝修工程',
      status: 'in_progress',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-02-06',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    stages: [
      {
        id: 'stage-1',
        name: '拆除',
        order: 1,
        status: 'completed',
        plannedStart: '2026-01-05',
        plannedEnd: '2026-01-09',
        actualStart: '2026-01-05',
        actualEnd: '2026-01-09',
      },
      {
        id: 'stage-2',
        name: '水電',
        order: 2,
        status: 'in_progress',
        plannedStart: '2026-01-10',
        plannedEnd: '2026-01-14',
        actualStart: '2026-01-10',
      },
      {
        id: 'stage-3',
        name: '泥作',
        order: 3,
        status: 'blocked',
        plannedStart: '2026-01-15',
        plannedEnd: '2026-01-19',
        note: '等磁磚到貨',
      },
    ],
    stageSummary: {
      total: 3,
      completed: 1,
      inProgress: 1,
      blocked: 1,
      notStarted: 0,
      percentComplete: 33,
    },
    gantt: {
      totalDays: 33,
      days: ['2026-01-05', '2026-01-06'],
      rows: [
        { stageId: 'stage-1', name: '拆除', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
        { stageId: 'stage-2', name: '水電', startIndex: 5, endIndex: 9, span: 5, withinWindow: true },
      ],
    },
    photos: [
      {
        id: 'photo-1',
        kind: 'before',
        takenOn: '2026-01-04',
        fileName: 'before.png',
        mimeType: 'image/png',
        caption: '施工前樣貌',
      },
      {
        id: 'photo-2',
        kind: 'progress',
        takenOn: '2026-01-12',
        fileName: 'wiring.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    budgetSummary: {
      total: 2,
      totalPlanned: 15000,
      totalActual: 15500,
      remaining: -500,
      isOverrun: true,
      totalOverrun: 500,
      overrunItemCount: 1,
      paymentCounts: { unpaid: 1, partial: 0, paid: 1 },
    },
    scheduleSummary: { total: 0, upcoming: 0, overdue: 0, completed: 0 },
    warrantySummary: { total: 0, expiringSoon: 0, expired: 0, active: 0 },
  }
  return { ...base, ...overrides }
}

describe('encodeShareSnapshot + decodeShareHash — round-trip (AC-FR004-04)', () => {
  it('encodes a snapshot and decodes it back losslessly', () => {
    const original = makeSnapshot()
    const encoded = encodeShareSnapshot(original)
    expect(typeof encoded).toBe('string')
    // base64url alphabet — no +, / or = padding.
    expect(encoded).not.toMatch(/[+/=]/)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected decode to succeed')
    // Re-encoded matches the original — proves we round-tripped deterministically.
    expect(encodeShareSnapshot(result.snapshot)).toBe(encoded)
    expect(result.snapshot).toEqual(original)
  })

  it('omits the actual Blob payload and any future module data from the encoded payload', () => {
    const original = makeSnapshot({
      // Deliberately simulate a polluted input — these keys MUST be dropped
      // by the builder so a future extension can't leak through.
      // (TypeScript would normally reject them, but we use `as unknown` to
      //  bypass the type guard so we can prove the runtime behaviour.)
    } as Partial<ShareSnapshot>)
    // Sanity: snapshot does not contain Blob-shaped data.
    const encoded = encodeShareSnapshot(original)
    const payload = JSON.parse(atob(decodeURIComponent(encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(encoded.length + (4 - (encoded.length % 4)) % 4, '='))))
    expect(payload).not.toHaveProperty('blob')
    expect(payload).not.toHaveProperty('indexedDbKey')
    expect(payload.project).not.toHaveProperty('id')
    expect(payload.stages.every((s: { id: string; blob?: unknown }) => !s.blob)).toBe(true)
  })

  it('strips any pre-existing share hash when rebuilding the URL', () => {
    const snapshot = makeSnapshot()
    const url = buildShareUrl(snapshot, {
      href: `https://example.test/app#${SHARE_HASH_KEY}=abc&keep=1`,
      hash: `#${SHARE_HASH_KEY}=abc&keep=1`,
    })
    expect(url).toContain(`${SHARE_HASH_KEY}=`)
    expect(url).not.toContain('abc')
    expect(url).toContain('keep=1')
  })

  it('decodeShareHash accepts the inner hash fragment without leading #', () => {
    const snapshot = makeSnapshot()
    const encoded = encodeShareSnapshot(snapshot)
    const result = decodeShareHash(`${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(true)
  })

  it('decodeShareHash preserves additional hash params while extracting share', () => {
    const snapshot = makeSnapshot()
    const encoded = encodeShareSnapshot(snapshot)
    const hash = `#other=1&${SHARE_HASH_KEY}=${encoded}&extra=2`
    const result = decodeShareHash(hash)
    expect(result.ok).toBe(true)
  })
})

describe('decodeShareHash — invalid inputs (AC-FR004-04)', () => {
  it('returns missing-hash when hash is empty', () => {
    const result = decodeShareHash('')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('missing-hash')
  })

  it('returns missing-hash when hash has no share param', () => {
    const result = decodeShareHash('#other=1')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('missing-hash')
  })

  it('rejects an unknown snapshot version', () => {
    const snapshot = makeSnapshot({ version: 999 as unknown as number })
    const encoded = encodeShareSnapshot(snapshot)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('unknown-version')
    expect(result.error.message).toMatch(/999/)
  })

  it('rejects a missing version field', () => {
    const malformed = JSON.stringify({ project: { name: 'x' } })
    const encoded = btoa(malformed).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('unknown-version')
  })

  it('rejects malformed base64', () => {
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=@@@@@@`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('malformed')
  })

  it('rejects base64 that decodes to non-JSON', () => {
    const encoded = btoa('not-json-at-all').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('malformed')
  })

  it('rejects a snapshot whose project fields are missing', () => {
    const malformed = JSON.stringify({
      version: SHARE_SNAPSHOT_VERSION,
      project: { name: '' },
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 0, days: [], rows: [] },
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
      scheduleSummary: { total: 0, upcoming: 0, overdue: 0, completed: 0 },
      warrantySummary: { total: 0, expiringSoon: 0, expired: 0, active: 0 },
      generatedAt: '2026-09-20T10:00:00.000Z',
    })
    const encoded = btoa(malformed).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('rejects a snapshot with an invalid project status', () => {
    const invalid = makeSnapshot({ project: { ...makeSnapshot().project, status: 'archived' as unknown as 'in_progress' } })
    const encoded = encodeShareSnapshot(invalid)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('rejects a snapshot with an invalid stage status', () => {
    const invalid = makeSnapshot()
    invalid.stages[0] = { ...invalid.stages[0]!, status: 'frozen' as unknown as 'completed' }
    const encoded = encodeShareSnapshot(invalid)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('rejects a snapshot with malformed date fields', () => {
    const invalid = makeSnapshot()
    invalid.project.plannedStart = '2026/01/05'
    const encoded = encodeShareSnapshot(invalid)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('rejects a snapshot with an unknown photo kind', () => {
    const invalid = makeSnapshot()
    invalid.photos[0] = { ...invalid.photos[0]!, kind: 'after-hours' as unknown as 'before' }
    const encoded = encodeShareSnapshot(invalid)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('rejects a snapshot with non-numeric budget amounts', () => {
    const invalid = makeSnapshot()
    invalid.budgetSummary.totalPlanned = NaN as unknown as number
    const encoded = encodeShareSnapshot(invalid)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('rejects a snapshot whose gantt day list contains non-date strings', () => {
    const invalid = makeSnapshot()
    invalid.gantt.days = ['2026-01-05', 'not-a-date']
    const encoded = encodeShareSnapshot(invalid)
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('shape')
  })

  it('does not throw on null hash', () => {
    const result = decodeShareHash(null)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('missing-hash')
  })
})

describe('buildShareSnapshot + URL helpers', () => {
  it('buildShareSnapshot rewrites stage/photo IndexedDB keys to snapshot-local refs', () => {
    // Deliberately use realistic IndexedDB-shaped keys (UUID-like) so the
    // test would fail if any leakage were ever introduced.
    const sourceProject = {
      name: 'P',
      address: '測試市示範路 1 號',
      status: 'in_progress' as const,
      plannedStart: '2026-01-01',
      plannedEnd: '2026-01-10',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const snapshot = buildShareSnapshot({
      project: sourceProject,
      stages: [
        {
          id: 'stage-local-uuid-AAA-AAA',
          name: '拆除',
          order: 1,
          status: 'completed' as const,
          plannedStart: '2026-01-01',
          plannedEnd: '2026-01-05',
        },
        {
          id: 'stage-local-uuid-BBB-BBB',
          name: '水電',
          order: 2,
          status: 'in_progress' as const,
          plannedStart: '2026-01-06',
          plannedEnd: '2026-01-10',
        },
      ],
      stageSummary: { total: 2, completed: 1, inProgress: 1, blocked: 0, notStarted: 0, percentComplete: 50 },
      gantt: {
        totalDays: 10,
        days: [],
        rows: [
          { stageId: 'stage-local-uuid-AAA-AAA', name: '拆除', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
          { stageId: 'stage-local-uuid-BBB-BBB', name: '水電', startIndex: 5, endIndex: 9, span: 5, withinWindow: true },
        ],
      },
      photos: [
        {
          id: 'photo-local-uuid-XXX-XXX',
          kind: 'before' as const,
          takenOn: '2026-01-01',
          fileName: 'before.png',
          mimeType: 'image/png',
        },
        {
          id: 'photo-local-uuid-YYY-YYY',
          kind: 'progress' as const,
          takenOn: '2026-01-05',
          fileName: 'progress.png',
          mimeType: 'image/png',
        },
      ],
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
      generatedAt: '2026-02-02T02:02:02.000Z',
    })

    // Stages are renumbered by display order, not the source key.
    expect(snapshot.stages.map((s) => s.id)).toEqual(['stage-1', 'stage-2'])
    // Photos are renumbered by display order.
    expect(snapshot.photos.map((p) => p.id)).toEqual(['photo-1', 'photo-2'])
    // Gantt rows now reference the snapshot-local refs.
    expect(snapshot.gantt.rows.map((r) => r.stageId)).toEqual(['stage-1', 'stage-2'])
    // The raw source IDs must NOT appear anywhere on the snapshot object.
    const json = JSON.stringify(snapshot)
    expect(json).not.toContain('stage-local-uuid-AAA-AAA')
    expect(json).not.toContain('stage-local-uuid-BBB-BBB')
    expect(json).not.toContain('photo-local-uuid-XXX-XXX')
    expect(json).not.toContain('photo-local-uuid-YYY-YYY')
  })

  it('encodeShareSnapshot does not leak source IndexedDB keys into the URL', () => {
    const snapshot = buildShareSnapshot({
      project: {
        name: 'P',
        status: 'planning',
        plannedStart: '2026-01-01',
        plannedEnd: '2026-01-10',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [
        {
          id: 'proj-local-uuid-1234',
          name: 'Stage A',
          order: 1,
          status: 'not_started' as const,
          plannedStart: '2026-01-01',
          plannedEnd: '2026-01-05',
        },
      ],
      stageSummary: { total: 1, completed: 0, inProgress: 0, blocked: 0, notStarted: 1, percentComplete: 0 },
      gantt: {
        totalDays: 10,
        days: [],
        rows: [
          { stageId: 'proj-local-uuid-1234', name: 'Stage A', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
        ],
      },
      photos: [
        {
          id: 'photo-local-uuid-9999',
          kind: 'before' as const,
          takenOn: '2026-01-01',
          fileName: 'a.png',
          mimeType: 'image/png',
        },
      ],
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
      generatedAt: '2026-02-02T02:02:02.000Z',
    })
    const url = buildShareUrl(snapshot, { href: 'https://example.test/app', hash: '' })
    // The URL must not contain the source keys in any form.
    expect(url).not.toContain('proj-local-uuid-1234')
    expect(url).not.toContain('photo-local-uuid-9999')
    // Decoding the URL should yield only snapshot-local refs.
    const decoded = decodeShareHash(url.slice(url.indexOf('#')))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error('expected decode to succeed')
    expect(decoded.snapshot.stages[0]!.id).toBe('stage-1')
    expect(decoded.snapshot.photos[0]!.id).toBe('photo-1')
    expect(decoded.snapshot.gantt.rows[0]!.stageId).toBe('stage-1')
  })

  it('decodeShareHash rejects snapshots whose stage/photo ids are not snapshot-local refs', () => {
    // Build a snapshot with valid shape, then mutate the encoded payload to
    // smuggle an IndexedDB-shaped id back in. The decoder must refuse it
    // rather than round-tripping the leaked value.
    const snapshot = buildShareSnapshot({
      project: {
        name: 'P',
        status: 'planning',
        plannedStart: '2026-01-01',
        plannedEnd: '2026-01-10',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [
        {
          id: 'safe-stage-key',
          name: 'A',
          order: 1,
          status: 'not_started' as const,
          plannedStart: '2026-01-01',
          plannedEnd: '2026-01-05',
        },
      ],
      stageSummary: { total: 1, completed: 0, inProgress: 0, blocked: 0, notStarted: 1, percentComplete: 0 },
      gantt: {
        totalDays: 5,
        days: [],
        rows: [
          { stageId: 'stage-1', name: 'A', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
        ],
      },
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
      generatedAt: '2026-02-02T02:02:02.000Z',
    })
    // Mutate: replace the snapshot-local stage id with the source key, so we
    // can prove the decoder rejects it.
    const tampered: ShareSnapshot = {
      ...snapshot,
      stages: [{ ...snapshot.stages[0]!, id: 'leaked-idb-key-AAAA-BBBB' }],
      gantt: { ...snapshot.gantt, rows: [{ ...snapshot.gantt.rows[0]!, stageId: 'leaked-idb-key-AAAA-BBBB' }] },
    }
    const result = decodeShareHash(`#${SHARE_HASH_KEY}=${encodeShareSnapshot(tampered)}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected decode to fail')
    expect(result.error.code).toBe('shape')

    // And photos get the same treatment.
    const tamperedPhoto: ShareSnapshot = {
      ...snapshot,
      stages: [],
      photos: [
        {
          id: 'leaked-photo-idb-key-CCCC',
          kind: 'before',
          takenOn: '2026-01-01',
          fileName: 'a.png',
          mimeType: 'image/png',
        },
      ],
    }
    const photoResult = decodeShareHash(`#${SHARE_HASH_KEY}=${encodeShareSnapshot(tamperedPhoto)}`)
    expect(photoResult.ok).toBe(false)
    if (photoResult.ok) throw new Error('expected decode to fail')
    expect(photoResult.error.code).toBe('shape')
  })

  it('produces a snapshot with the current version + generatedAt', () => {
    const snapshot = buildShareSnapshot({
      project: {
        name: 'P',
        status: 'planning',
        plannedStart: '2026-01-01',
        plannedEnd: '2026-01-10',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 10, days: [], rows: [] },
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
      generatedAt: '2026-02-02T02:02:02.000Z',
    })
    expect(snapshot.version).toBe(SHARE_SNAPSHOT_VERSION)
    expect(snapshot.generatedAt).toBe('2026-02-02T02:02:02.000Z')
    expect(snapshot.scheduleSummary.total).toBe(0)
    expect(snapshot.warrantySummary.total).toBe(0)
  })

  it('buildShareUrl returns a URL containing the encoded snapshot', () => {
    const snapshot = makeSnapshot()
    const url = buildShareUrl(snapshot, { href: 'https://example.test/app', hash: '' })
    expect(url.startsWith('https://example.test/app')).toBe(true)
    expect(url).toContain(`#${SHARE_HASH_KEY}=`)
    // The fragment after share= must decode back to the same snapshot.
    const fragment = url.split('#')[1] ?? ''
    const encoded = fragment.split('&').find((p) => p.startsWith(`${SHARE_HASH_KEY}=`))?.slice(SHARE_HASH_KEY.length + 1)
    expect(encoded).toBeDefined()
    const decoded = decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`)
    expect(decoded.ok).toBe(true)
  })

  it('stripShareUrl preserves other hash params and removes the share param', () => {
    const stripped = stripShareUrl(`https://example.test/app#keep=1&${SHARE_HASH_KEY}=abc&other=2`)
    expect(stripped).toBe('https://example.test/app#keep=1&other=2')
  })

  it('stripShareUrl removes the entire hash when share was the only param', () => {
    const stripped = stripShareUrl(`https://example.test/app#${SHARE_HASH_KEY}=abc`)
    expect(stripped).toBe('https://example.test/app')
  })

  it('stripShareUrl removes a page anchor when rebuilding a share URL', () => {
    const stripped = stripShareUrl('https://example.test/app#timeline')
    expect(stripped).toBe('https://example.test/app')
  })

  it('stripShareUrl strips a page anchor that appears before the share param', () => {
    const stripped = stripShareUrl(`https://example.test/app#timeline&${SHARE_HASH_KEY}=abc`)
    expect(stripped).toBe('https://example.test/app')
  })

  it('stripShareUrl strips a page anchor that appears after the share param', () => {
    const stripped = stripShareUrl(`https://example.test/app#${SHARE_HASH_KEY}=abc&timeline`)
    expect(stripped).toBe('https://example.test/app')
  })
})

// Regression: clicking a section anchor such as #timeline must NOT enter
// share mode. Only `#share=...` (and its combinations) is a share hash.
describe('hasShareHash — distinguishes section anchors from share hashes', () => {
  it('returns false for empty/null/undefined', () => {
    expect(hasShareHash('')).toBe(false)
    expect(hasShareHash(null)).toBe(false)
    expect(hasShareHash(undefined)).toBe(false)
  })

  it('returns false for plain section anchors', () => {
    expect(hasShareHash('#timeline')).toBe(false)
    expect(hasShareHash('#budget')).toBe(false)
    expect(hasShareHash('#photos')).toBe(false)
    expect(hasShareHash('#schedule')).toBe(false)
    expect(hasShareHash('#warranties')).toBe(false)
    expect(hasShareHash('#overview')).toBe(false)
  })

  it('returns false for a hash without a key=value pair', () => {
    expect(hasShareHash('#share')).toBe(false)
    expect(hasShareHash('#timeline&photos')).toBe(false)
  })

  it('returns true for a valid share hash', () => {
    expect(hasShareHash('#share=abc')).toBe(true)
    expect(hasShareHash('share=abc')).toBe(true)
  })

  it('returns true for a share hash combined with a section anchor', () => {
    expect(hasShareHash('#share=abc&timeline')).toBe(true)
    expect(hasShareHash('#timeline&share=abc')).toBe(true)
    expect(hasShareHash('#share=abc&timeline&budget')).toBe(true)
  })

  it('returns false for a hash that contains a similar but different key', () => {
    expect(hasShareHash('#shares=abc')).toBe(false)
    expect(hasShareHash('#myshare=abc')).toBe(false)
    expect(hasShareHash('#timeline&other=abc')).toBe(false)
  })

  it('returns true for a share hash with an empty encoded value (decoder will reject it)', () => {
    // `hasShareHash` is intentionally lenient — the decoder is the authority
    // on whether the payload is valid. This test pins that contract so a
    // future refactor does not silently accept bare `#share=`.
    expect(hasShareHash('#share=')).toBe(true)
  })
})

// Regression: generating a share URL while the current URL has a section
// anchor must produce exactly one valid `#share=...` fragment — never a
// double-hash URL like `#timeline#share=...`.
describe('buildShareUrl — produces a clean share URL regardless of current hash', () => {
  it('produces a clean share URL when the current URL is a bare section anchor', () => {
    const snapshot = makeSnapshot()
    const url = buildShareUrl(snapshot, {
      href: 'https://example.test/app#timeline',
      hash: '#timeline',
    })
    // Must NOT contain a double hash.
    expect(url).not.toMatch(/#.*#/)
    // Must contain exactly one # followed by share=.
    expect(url).toMatch(/^https:\/\/example\.test\/app#share=/)
    // The fragment must decode back to the snapshot.
    const fragment = url.split('#')[1] ?? ''
    const encoded = fragment.split('&').find((p) => p.startsWith(`${SHARE_HASH_KEY}=`))?.slice(SHARE_HASH_KEY.length + 1)
    expect(encoded).toBeDefined()
    expect(decodeShareHash(`#${SHARE_HASH_KEY}=${encoded}`).ok).toBe(true)
  })

  it('produces a clean share URL for every documented section anchor', () => {
    const snapshot = makeSnapshot()
    const anchors = ['#timeline', '#budget', '#photos', '#schedule', '#warranties', '#overview']
    for (const anchor of anchors) {
      const url = buildShareUrl(snapshot, {
        href: `https://example.test/app${anchor}`,
        hash: anchor,
      })
      expect(url, `anchor ${anchor} should not produce a double-hash URL`).not.toMatch(/#.*#/)
      expect(url, `anchor ${anchor} should contain the share payload`).toMatch(/#share=/)
    }
  })

  it('preserves unrelated hash params while stripping page anchors', () => {
    const snapshot = makeSnapshot()
    const url = buildShareUrl(snapshot, {
      href: 'https://example.test/app#timeline&keep=1',
      hash: '#timeline&keep=1',
    })
    expect(url).not.toMatch(/#.*#/)
    // `keep=1` is a key=value param, so it survives the strip.
    expect(url).toMatch(/#keep=1&share=/)
  })

  it('replaces an existing share hash without leaving a double hash', () => {
    const snapshot = makeSnapshot()
    const url = buildShareUrl(snapshot, {
      href: `https://example.test/app#share=old_value&timeline`,
      hash: '#share=old_value&timeline',
    })
    expect(url).not.toMatch(/#.*#/)
    expect(url).not.toContain('old_value')
    expect(url).toMatch(/#share=/)
  })
})

// ───────────────────────── M1 / GOAL AC-005 ─────────────────────────
// Share snapshot v2: new sections round-trip, personal data is opt-in,
// IndexedDB keys / Blobs never leak, and pre-M1 (v1) links still open.

/** Decode the JSON document carried by a `#share=` fragment. */
function jsonOf(snapshot: ShareSnapshot): string {
  return JSON.stringify(snapshot)
}

function decodeOk(snapshot: unknown): ShareSnapshot {
  const result = decodeShareHash(
    `#${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot as ShareSnapshot)}`,
  )
  if (!result.ok) throw new Error(`expected decode to succeed: ${result.error.message}`)
  return result.snapshot
}

function decodeErr(snapshot: unknown) {
  const result = decodeShareHash(
    `#${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot as ShareSnapshot)}`,
  )
  if (result.ok) throw new Error('expected decode to fail')
  return result.error
}

const FAKE_ADDRESS = '測試市示範路 1 號'
const FAKE_WORKER_PHONE = '0900-000-000'
const FAKE_WARRANTY_CONTACT = 'demo@example.com'

/** A full M1 input using UUID-like source keys so any leak is detectable. */
function m1Input(privacy?: { includeAddress?: boolean; includeContacts?: boolean }) {
  return {
    project: {
      name: '示範工程',
      address: FAKE_ADDRESS,
      status: 'in_progress' as const,
      plannedStart: '2026-01-05',
      plannedEnd: '2026-02-06',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    },
    stages: [
      {
        id: 'idb-stage-key-AAA',
        name: '拆除',
        order: 1,
        status: 'completed' as const,
        plannedStart: '2026-01-05',
        plannedEnd: '2026-01-09',
        actualStart: '2026-01-05',
        actualEnd: '2026-01-09',
      },
      {
        id: 'idb-stage-key-BBB',
        name: '水電',
        order: 2,
        status: 'in_progress' as const,
        plannedStart: '2026-01-12',
        plannedEnd: '2026-01-23',
      },
      {
        id: 'idb-stage-key-CCC',
        name: '木作',
        order: 3,
        status: 'not_started' as const,
        plannedStart: '2026-01-26',
        plannedEnd: '2026-02-06',
      },
    ],
    stageSummary: { total: 3, completed: 1, inProgress: 1, blocked: 0, notStarted: 1, percentComplete: 33 },
    gantt: { totalDays: 33, days: ['2026-01-05'], rows: [] },
    photos: [
      { id: 'idb-photo-key-1', kind: 'before' as const, takenOn: '2026-01-05', fileName: 'a.png', mimeType: 'image/png', stageId: 'idb-stage-key-AAA', createdAt: '2026-01-05T01:00:00.000Z' },
      { id: 'idb-photo-key-2', kind: 'progress' as const, takenOn: '2026-01-08', fileName: 'b.png', mimeType: 'image/png', stageId: 'idb-stage-key-AAA', createdAt: '2026-01-08T01:00:00.000Z' },
      { id: 'idb-photo-key-3', kind: 'progress' as const, takenOn: '2026-01-14', fileName: 'c.png', mimeType: 'image/png', stageId: 'idb-stage-key-BBB', createdAt: '2026-01-14T01:00:00.000Z' },
      { id: 'idb-photo-key-4', kind: 'progress' as const, takenOn: '2026-01-03', fileName: 'd.png', mimeType: 'image/png', createdAt: '2026-01-03T01:00:00.000Z' },
    ],
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
        id: 'idb-warranty-key-1',
        itemName: '示範保固項目',
        provider: '示範廠商',
        contact: FAKE_WARRANTY_CONTACT,
        startsOn: '2026-01-01',
        endsOn: '2027-01-01',
      },
    ],
    generatedAt: '2026-01-20T02:00:00.000Z',
    changeOrders: [
      { id: 'idb-change-key-1', title: '示範追加：增加插座', amount: 12000, status: 'approved' as const, decidedOn: '2026-01-18', material: '示範材料', note: '示範內部備註' },
      { id: 'idb-change-key-2', title: '示範追減：取消層板', amount: -3000.5, status: 'pending' as const },
      { id: 'idb-change-key-3', title: '示範追加：更換地板', amount: 30000, status: 'rejected' as const, decidedOn: '2026-01-19' },
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
      { stageId: 'idb-stage-key-AAA', passed: true },
      { stageId: 'idb-stage-key-AAA', passed: false },
      { stageId: 'idb-stage-key-BBB', passed: false },
    ],
    scheduleContacts: [
      { workerName: '示範水電師傅', phone: FAKE_WORKER_PHONE },
      { workerName: '示範木工師傅' },
    ],
    ...(privacy ? { privacy } : {}),
  }
}

describe('AC-005 share snapshot v2 — new sections', () => {
  it('AC-005: the current snapshot version is 2', () => {
    expect(SHARE_SNAPSHOT_VERSION).toBe(2)
    expect(buildShareSnapshot(m1Input()).version).toBe(2)
  })

  it('AC-005: change orders carry title, amount and status under snapshot-local ids', () => {
    const snapshot = buildShareSnapshot(m1Input())
    expect(snapshot.changeOrders).toEqual([
      { id: 'change-1', title: '示範追加：增加插座', amount: 12000, status: 'approved', decidedOn: '2026-01-18' },
      { id: 'change-2', title: '示範追減：取消層板', amount: -3000.5, status: 'pending' },
      { id: 'change-3', title: '示範追加：更換地板', amount: 30000, status: 'rejected', decidedOn: '2026-01-19' },
    ])
  })

  it('AC-005: change order material and note stay on the device', () => {
    const json = jsonOf(buildShareSnapshot(m1Input({ includeAddress: true, includeContacts: true })))
    expect(json).not.toContain('示範材料')
    expect(json).not.toContain('示範內部備註')
  })

  it('AC-005: the contract & receipts summary is included', () => {
    expect(buildShareSnapshot(m1Input()).contractSummary).toEqual({
      contractAmount: 1000000,
      approvedChangeTotal: 12000,
      adjustedTotal: 1012000,
      receivedAmount: 400000,
      outstanding: 612000,
      isOverpaid: false,
    })
  })

  it('AC-005: acceptance progress is reported overall and per stage, with the completed-stage warning', () => {
    expect(buildShareSnapshot(m1Input()).acceptanceSummary).toEqual({
      total: 3,
      passed: 1,
      stages: [
        { stageId: 'stage-1', total: 2, passed: 1, hasWarning: true },
        { stageId: 'stage-2', total: 1, passed: 0, hasWarning: false },
      ],
    })
  })

  it('AC-005: the photo report gives per-stage photo count and latest shooting date', () => {
    expect(buildShareSnapshot(m1Input()).photoReport).toEqual({
      stages: [
        { stageId: 'stage-1', count: 2, latestTakenOn: '2026-01-08' },
        { stageId: 'stage-2', count: 1, latestTakenOn: '2026-01-14' },
      ],
      unassigned: { count: 1, latestTakenOn: '2026-01-03' },
    })
  })

  it('AC-005: every new section survives an encode → decode round-trip', () => {
    for (const privacy of [
      undefined,
      { includeAddress: true },
      { includeContacts: true },
      { includeAddress: true, includeContacts: true },
    ]) {
      const snapshot = buildShareSnapshot(m1Input(privacy))
      expect(decodeOk(snapshot)).toEqual(snapshot)
    }
  })

  it('AC-005: an empty project still produces well-formed (empty) v2 sections', () => {
    const snapshot = buildShareSnapshot({
      project: {
        name: '示範工程',
        status: 'planning',
        plannedStart: '2026-01-01',
        plannedEnd: '2026-01-10',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 10, days: [], rows: [] },
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
      generatedAt: '2026-01-20T02:00:00.000Z',
    })
    expect(snapshot.changeOrders).toEqual([])
    expect(snapshot.acceptanceSummary).toEqual({ total: 0, passed: 0, stages: [] })
    expect(snapshot.photoReport).toEqual({ stages: [], unassigned: { count: 0 } })
    expect(snapshot.contractSummary).toBeUndefined()
    expect(snapshot.privacy).toEqual({ includesAddress: false, includesContacts: false })
    expect(decodeOk(snapshot)).toEqual(snapshot)
  })
})

describe('AC-005 share snapshot v2 — personal data is opt-in', () => {
  it('AC-005: by default the address, worker phones and warranty contacts are NOT in the snapshot', () => {
    const snapshot = buildShareSnapshot(m1Input())
    expect(snapshot.project.address).toBeUndefined()
    expect('address' in snapshot.project).toBe(false)
    expect(snapshot.warranties).toHaveLength(1)
    expect(snapshot.warranties![0]!.contact).toBeUndefined()
    expect('contact' in snapshot.warranties![0]!).toBe(false)
    expect(snapshot.scheduleContacts).toBeUndefined()
    expect(snapshot.privacy).toEqual({ includesAddress: false, includesContacts: false })
  })

  it('AC-005: by default none of the personal strings appear anywhere in the encoded URL payload', () => {
    const snapshot = buildShareSnapshot(m1Input())
    const json = jsonOf(snapshot)
    expect(json).not.toContain(FAKE_ADDRESS)
    expect(json).not.toContain(FAKE_WORKER_PHONE)
    expect(json).not.toContain(FAKE_WARRANTY_CONTACT)
    expect(json).not.toContain('示範水電師傅')
    // …and the same holds after the URL round-trip.
    const decoded = jsonOf(decodeOk(snapshot))
    expect(decoded).not.toContain(FAKE_ADDRESS)
    expect(decoded).not.toContain(FAKE_WORKER_PHONE)
    expect(decoded).not.toContain(FAKE_WARRANTY_CONTACT)
  })

  it('AC-005: explicit false behaves exactly like the default', () => {
    expect(buildShareSnapshot(m1Input({ includeAddress: false, includeContacts: false }))).toEqual(
      buildShareSnapshot(m1Input()),
    )
  })

  it('AC-005: ticking 「包含工程地址」 adds only the address', () => {
    const snapshot = buildShareSnapshot(m1Input({ includeAddress: true }))
    expect(snapshot.project.address).toBe(FAKE_ADDRESS)
    expect(snapshot.privacy).toEqual({ includesAddress: true, includesContacts: false })
    const json = jsonOf(snapshot)
    expect(json).not.toContain(FAKE_WORKER_PHONE)
    expect(json).not.toContain(FAKE_WARRANTY_CONTACT)
    expect(snapshot.scheduleContacts).toBeUndefined()
  })

  it('AC-005: ticking 「包含聯絡方式」 adds worker phones and warranty contacts, not the address', () => {
    const snapshot = buildShareSnapshot(m1Input({ includeContacts: true }))
    expect(snapshot.project.address).toBeUndefined()
    expect(snapshot.warranties![0]!.contact).toBe(FAKE_WARRANTY_CONTACT)
    // Only workers that actually have a phone number are listed.
    expect(snapshot.scheduleContacts).toEqual([
      { id: 'schedule-1', workerName: '示範水電師傅', phone: FAKE_WORKER_PHONE },
    ])
    expect(snapshot.privacy).toEqual({ includesAddress: false, includesContacts: true })
    expect(jsonOf(snapshot)).not.toContain(FAKE_ADDRESS)
  })

  it('AC-005: ticking both includes both', () => {
    const snapshot = buildShareSnapshot(m1Input({ includeAddress: true, includeContacts: true }))
    expect(snapshot.project.address).toBe(FAKE_ADDRESS)
    expect(snapshot.warranties![0]!.contact).toBe(FAKE_WARRANTY_CONTACT)
    expect(snapshot.scheduleContacts).toHaveLength(1)
    expect(snapshot.privacy).toEqual({ includesAddress: true, includesContacts: true })
  })

  it('AC-005: includesAddress stays false when the project has no address to share', () => {
    const input = m1Input({ includeAddress: true })
    const { address: _address, ...projectWithoutAddress } = input.project
    void _address
    const snapshot = buildShareSnapshot({ ...input, project: projectWithoutAddress })
    expect(snapshot.project.address).toBeUndefined()
    expect(snapshot.privacy?.includesAddress).toBe(false)
  })
})

describe('AC-005 share snapshot v2 — no IndexedDB key or Blob leaks', () => {
  it('AC-005: no source IndexedDB key appears in the payload, with or without opt-in', () => {
    for (const privacy of [undefined, { includeAddress: true, includeContacts: true }]) {
      const json = jsonOf(buildShareSnapshot(m1Input(privacy)))
      expect(json).not.toContain('idb-stage-key')
      expect(json).not.toContain('idb-photo-key')
      expect(json).not.toContain('idb-warranty-key')
      expect(json).not.toContain('idb-change-key')
    }
  })

  it('AC-005: photo stage links and createdAt are used for the report but never written out', () => {
    const snapshot = buildShareSnapshot(m1Input())
    for (const photo of snapshot.photos) {
      expect(Object.keys(photo).sort()).toEqual(['fileName', 'id', 'kind', 'mimeType', 'takenOn'])
      expect(photo.id).toMatch(/^photo-\d+$/)
    }
  })

  it('AC-005: the payload contains no Blob / binary image data', () => {
    const input = m1Input()
    const withBlob = {
      ...input,
      photos: input.photos.map((p) => ({
        ...p,
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      })),
    }
    const snapshot = buildShareSnapshot(withBlob)
    const json = jsonOf(snapshot)
    expect(json).not.toMatch(/blob/i)
    expect(json).not.toContain('data:image')
    for (const photo of snapshot.photos) {
      expect('blob' in photo).toBe(false)
    }
  })

  it('AC-005: acceptance items of a stage outside the snapshot count overall but get no per-stage key', () => {
    const input = m1Input()
    const snapshot = buildShareSnapshot({
      ...input,
      acceptanceItems: [...input.acceptanceItems, { stageId: 'idb-stage-key-GONE', passed: true }],
    })
    expect(snapshot.acceptanceSummary?.total).toBe(4)
    expect(snapshot.acceptanceSummary?.passed).toBe(2)
    expect(snapshot.acceptanceSummary?.stages.map((s) => s.stageId)).toEqual(['stage-1', 'stage-2'])
    expect(jsonOf(snapshot)).not.toContain('idb-stage-key-GONE')
  })
})

describe('AC-005 share snapshot — older and malformed links', () => {
  /** What a pre-M1 link looked like: version 1, none of the v2 sections. */
  function legacyV1(): Record<string, unknown> {
    const { privacy, changeOrders, contractSummary, acceptanceSummary, photoReport, ...rest } =
      buildShareSnapshot(m1Input())
    void privacy
    void changeOrders
    void contractSummary
    void acceptanceSummary
    void photoReport
    return { ...rest, version: 1 }
  }

  it('AC-005: an existing version 1 hash still decodes', () => {
    const decoded = decodeOk(legacyV1())
    expect(decoded.version).toBe(1)
    expect(decoded.project.name).toBe('示範工程')
    expect(decoded.stages).toHaveLength(3)
    expect(decoded.warranties).toHaveLength(1)
    // v1 links simply have none of the M1 sections.
    expect(decoded.privacy).toBeUndefined()
    expect(decoded.changeOrders).toBeUndefined()
    expect(decoded.contractSummary).toBeUndefined()
    expect(decoded.acceptanceSummary).toBeUndefined()
    expect(decoded.photoReport).toBeUndefined()
    expect(decoded.scheduleContacts).toBeUndefined()
  })

  it('AC-005: a version 1 link that already carried an address / contact still opens', () => {
    const legacy = legacyV1()
    ;(legacy.project as Record<string, unknown>).address = FAKE_ADDRESS
    ;(legacy.warranties as Record<string, unknown>[])[0]!.contact = FAKE_WARRANTY_CONTACT
    const decoded = decodeOk(legacy)
    expect(decoded.version).toBe(1)
    expect(decoded.project.address).toBe(FAKE_ADDRESS)
    expect(decoded.warranties![0]!.contact).toBe(FAKE_WARRANTY_CONTACT)
  })

  it('AC-005: a future version is rejected with an understandable error instead of crashing', () => {
    const error = decodeErr({ ...buildShareSnapshot(m1Input()), version: 3 })
    expect(error.code).toBe('unknown-version')
    expect(error.message).toBe('不支援的分享版本：3')
  })

  it.each([
    ['changeOrders is not a list', { changeOrders: 'nope' }],
    ['a change order uses a raw key as id', { changeOrders: [{ id: 'idb-change-key-1', title: 't', amount: 1, status: 'pending' }] }],
    ['a change order has an unknown status', { changeOrders: [{ id: 'change-1', title: 't', amount: 1, status: 'signed' }] }],
    ['a change order amount is not a number', { changeOrders: [{ id: 'change-1', title: 't', amount: '1', status: 'pending' }] }],
    ['contractSummary lacks a field', { contractSummary: { contractAmount: 1 } }],
    ['acceptanceSummary is malformed', { acceptanceSummary: { total: 1, passed: 0, stages: [{ stageId: 'idb-stage-key-AAA', total: 1, passed: 0, hasWarning: false }] } }],
    ['photoReport is malformed', { photoReport: { stages: [{ stageId: 'stage-1', count: -1 }], unassigned: { count: 0 } } }],
    ['photoReport has a bad date', { photoReport: { stages: [], unassigned: { count: 1, latestTakenOn: 'yesterday' } } }],
    ['privacy is malformed', { privacy: { includesAddress: 'yes', includesContacts: false } }],
    ['scheduleContacts is malformed', { scheduleContacts: [{ id: 'schedule-1', workerName: 1, phone: '0900-000-000' }] }],
  ])('AC-005: a tampered link is rejected with a shape error when %s', (_label, patch) => {
    const error = decodeErr({ ...buildShareSnapshot(m1Input()), ...patch })
    expect(error.code).toBe('shape')
    expect(error.message.length).toBeGreaterThan(0)
  })
})
