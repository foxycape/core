import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { WebStorage } from '@/kernal/storage/WebStorage'
import type { DataStorageOptions } from '@/kernal/storage/IStorage'
import { describeStorageContract } from './storageContract'

let dbSeq = 0

const MIN_PAYLOAD_BYTES = 300
const MAX_PAYLOAD_BYTES = 1024
const BULK_INSERT_COUNT = 10_000
const MIXED_SEED_COUNT = 3_000
const MIXED_ROUND_COUNT = 2_000

const createWebStorage = (options?: DataStorageOptions) => {
  dbSeq += 1
  return new WebStorage({
    ...options,
    dbName: options?.dbName ?? `webstorage-test-${dbSeq}`,
  })
}

const payloadByteSizeAt = (index: number, total: number) => {
  if (total <= 1) {
    return MIN_PAYLOAD_BYTES
  }
  return MIN_PAYLOAD_BYTES + Math.round(
    (index / (total - 1)) * (MAX_PAYLOAD_BYTES - MIN_PAYLOAD_BYTES),
  )
}

const createSizedPayload = (index: number, byteSize: number) => {
  const make = (body: string) => ({ id: index, body })
  const emptySize = JSON.stringify(make('')).length
  return make('x'.repeat(Math.max(0, byteSize - emptySize)))
}

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1))
  return sorted[rank]
}

const formatMs = (ms: number) => `${ms.toFixed(3)}ms`

describeStorageContract('WebStorage', () => createWebStorage())

describe('WebStorage', () => {
  const opened: WebStorage[] = []

  const create = (options?: DataStorageOptions) => {
    const instance = createWebStorage(options)
    opened.push(instance)
    return instance
  }

  afterEach(async () => {
    const instances = opened.splice(0)
    await Promise.all(instances.map(async (instance) => {
      try {
        await instance.dropDb()
      } catch {
        // ignore
      }
      try {
        await instance.dispose()
      } catch {
        // ignore
      }
    }))
  })

  it('uses the default database name when none is provided', () => {
    const instance = new WebStorage()
    opened.push(instance)
    expect(instance.dbName).toBe('linghuxiong_reader')
  })

  it('does not mutate the caller options object', () => {
    const options: DataStorageOptions = {
      dbName: `webstorage-options-${++dbSeq}`,
      useMemoryMinKeyCount: 10,
    }
    const instance = create(options)
    expect(options.useMemoryMinKeyCount).toBe(10)
    expect(instance.dbName).toBe(options.dbName)
  })

  it('clamps memory table options without changing caller values', () => {
    const options: DataStorageOptions = {
      dbName: `webstorage-clamp-${++dbSeq}`,
      useMemoryMinKeyCount: 1,
      useMemoryMaxKeyCount: 1_000_000,
    }
    create(options)
    expect(options.useMemoryMinKeyCount).toBe(1)
    expect(options.useMemoryMaxKeyCount).toBe(1_000_000)
  })

  it('persists dates through IndexedDB', async () => {
    const storage = create()
    const openedAt = new Date('2026-08-19T01:02:03.000Z')
    await storage.set('meta', 'openedAt', openedAt)
    const loaded = await storage.get<Date>('meta', 'openedAt')
    expect(loaded).toBeInstanceOf(Date)
    expect(loaded?.toISOString()).toBe(openedAt.toISOString())
  })

  it('skips rewriting an unchanged cached value', async () => {
    const storage = create()
    const payload = { title: 'Foxy' }
    await storage.set('books', 'id-1', payload)
    await storage.get('books', 'id-1')
    await storage.set('books', 'id-1', { title: 'Foxy' })
    await expect(storage.get('books', 'id-1')).resolves.toEqual({ title: 'Foxy' })
  })

  it('reloads from IndexedDB after the cached object is mutated in place', async () => {
    const storage = create()
    await storage.set('books', 'id-1', { n: 1 })
    const cached = await storage.get<{ n: number }>('books', 'id-1')
    expect(cached).toEqual({ n: 1 })
    cached.n = 2
    const reloaded = await storage.get<{ n: number }>('books', 'id-1')
    expect(reloaded).toEqual({ n: 1 })
    expect(reloaded).not.toBe(cached)
  })

  it('persists in-place mutations when set is called', async () => {
    const storage = create()
    await storage.set('books', 'id-1', { n: 1 })
    const cached = await storage.get<{ n: number }>('books', 'id-1')
    cached.n = 2
    await storage.set('books', 'id-1', cached)
    await expect(storage.get('books', 'id-1')).resolves.toEqual({ n: 2 })
  })

  it('does not return cached values after dropTable', async () => {
    const storage = create()
    await storage.set('books', 'id-1', 'cached')
    await expect(storage.get('books', 'id-1')).resolves.toBe('cached')
    await storage.dropTable('books')
    await expect(storage.get('books', 'id-1')).resolves.toBeNull()
  })

  it('allows writing again after dropDb', async () => {
    const storage = create()
    await storage.set('books', 'id-1', 'old')
    await storage.dropDb()
    await storage.set('books', 'id-1', 'new')
    await expect(storage.get('books', 'id-1')).resolves.toBe('new')
  })

  it('returns empty results after dispose', async () => {
    const storage = create()
    await storage.set('books', 'id-1', 'v')
    await storage.dispose()
    await expect(storage.get('books', 'id-1')).resolves.toBeNull()
    await storage.set('books', 'id-1', 'again')
    await expect(storage.get('books', 'id-1')).resolves.toBeNull()
    await expect(storage.getAll('books')).resolves.toEqual(new Map())
    await expect(storage.filter('books', () => true)).resolves.toEqual([])
    await expect(storage.count('books')).resolves.toBe(0)
  })

  it('serializes get and set on the same key', async () => {
    const storage = create()
    await storage.set('books', 'id-1', 0)
    await Promise.all(Array.from({ length: 20 }, (_, index) => storage.set('books', 'id-1', index)))
    await expect(storage.get('books', 'id-1')).resolves.toBe(19)
  })

  it('does not let a concurrent get restore a deleted value', async () => {
    const storage = create()
    await storage.set('books', 'id-1', 'keep')
    await Promise.all([
      storage.get('books', 'id-1'),
      storage.delete('books', 'id-1'),
    ])
    await expect(storage.get('books', 'id-1')).resolves.toBeNull()
  })

  it('loads a memory table once the key count reaches the minimum', async () => {
    const storage = create({
      useMemoryMinKeyCount: 1000,
      useMemoryMaxKeyCount: 2000,
    })
    await Promise.all(Array.from({ length: 1000 }, (_, index) => (
      storage.set('big', String(index), { index })
    )))
    const all = await storage.getAll<{ index: number }>('big')
    expect(all.size).toBe(1000)
    all.delete('0')
    const found = await storage.find<{ index: number }>('big', (value, key) => key === '0')
    expect(found).toEqual({ index: 0 })
    const filtered = await storage.filter<{ index: number }>('big', (value) => value.index < 3)
    expect(filtered.map((item) => item.index).sort((a, b) => a - b)).toEqual([0, 1, 2])
  }, 30_000)

  //npx vitest run tests/kernal/storage/WebStorage.test.ts -t "performance" --disableConsoleIntercept
  describe('performance', () => {
    it('inserts 10000 records of 300B-1KB and reports total and average time', async () => {
      const storage = create()
      const table = 'perf-bulk'
      const firstPayload = createSizedPayload(0, payloadByteSizeAt(0, BULK_INSERT_COUNT))
      const lastPayload = createSizedPayload(
        BULK_INSERT_COUNT - 1,
        payloadByteSizeAt(BULK_INSERT_COUNT - 1, BULK_INSERT_COUNT),
      )
      expect(JSON.stringify(firstPayload).length).toBe(MIN_PAYLOAD_BYTES)
      expect(JSON.stringify(lastPayload).length).toBe(MAX_PAYLOAD_BYTES)

      const startedAt = performance.now()
      for (let index = 0; index < BULK_INSERT_COUNT; index += 1) {
        const payload = createSizedPayload(index, payloadByteSizeAt(index, BULK_INSERT_COUNT))
        await storage.set(table, `item-${index}`, payload)
      }
      const totalMs = performance.now() - startedAt
      const averageMs = totalMs / BULK_INSERT_COUNT

      expect(await storage.count(table)).toBe(BULK_INSERT_COUNT)
      await expect(storage.get(table, 'item-0')).resolves.toEqual(firstPayload)
      await expect(storage.get(table, `item-${BULK_INSERT_COUNT - 1}`)).resolves.toEqual(lastPayload)

      console.info(
        `[WebStorage perf] bulk insert ${BULK_INSERT_COUNT} records (300B-1KB): `
        + `total ${formatMs(totalMs)}, average ${formatMs(averageMs)} per record`,
      )
    }, 180_000)

    it('measures get latency while alternating set, delete, and get', async () => {
      const storage = create()
      const table = 'perf-mixed'
      const queryDurations: number[] = []

      for (let index = 0; index < MIXED_SEED_COUNT; index += 1) {
        const payload = createSizedPayload(index, payloadByteSizeAt(index, MIXED_SEED_COUNT))
        await storage.set(table, `seed-${index}`, payload)
      }

      for (let round = 0; round < MIXED_ROUND_COUNT; round += 1) {
        const writePayload = createSizedPayload(
          MIXED_SEED_COUNT + round,
          payloadByteSizeAt(round, MIXED_ROUND_COUNT),
        )
        await storage.set(table, `mix-${round}`, writePayload)

        const queryKey = `seed-${round % MIXED_SEED_COUNT}`
        const queryStartedAt = performance.now()
        const found = await storage.get<{ id: number, body: string }>(table, queryKey)
        queryDurations.push(performance.now() - queryStartedAt)
        expect(found?.id).toBe(round % MIXED_SEED_COUNT)

        await storage.delete(table, `mix-${round}`)
      }

      const totalQueryMs = queryDurations.reduce((sum, duration) => sum + duration, 0)
      const averageQueryMs = totalQueryMs / queryDurations.length
      const minQueryMs = Math.min(...queryDurations)
      const maxQueryMs = Math.max(...queryDurations)

      expect(await storage.count(table)).toBe(MIXED_SEED_COUNT)
      expect(queryDurations).toHaveLength(MIXED_ROUND_COUNT)

      console.info(
        `[WebStorage perf] mixed set/delete/get x${MIXED_ROUND_COUNT} `
        + `(seed ${MIXED_SEED_COUNT}): query one record average ${formatMs(averageQueryMs)}, `
        + `min ${formatMs(minQueryMs)}, p50 ${formatMs(percentile(queryDurations, 0.5))}, `
        + `p95 ${formatMs(percentile(queryDurations, 0.95))}, `
        + `p99 ${formatMs(percentile(queryDurations, 0.99))}, max ${formatMs(maxQueryMs)}`,
      )
    }, 180_000)
  })
})
