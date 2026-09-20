// Test setup — runs before every test file.
// - Polyfill IndexedDB via fake-indexeddb (so tests run in jsdom).
// - Register @testing-library/jest-dom matchers.

import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
