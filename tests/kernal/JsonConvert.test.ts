import { describe, expect, it } from 'vitest'
import { JsonConvert } from '@/kernal/JsonConvert'

describe('JsonConvert', () => {
  it('keeps bibliographic ISO datetimes as strings when parsing', () => {
    const parsed = JsonConvert.parse(
      JSON.stringify({
        issueDate: '2020-01-01T00:00:00Z',
        serverTime: '2026-01-01T00:00:00.000Z',
      }),
    ) as { issueDate: unknown; serverTime: unknown }

    expect(parsed.issueDate).toBe('2020-01-01T00:00:00Z')
    expect(typeof parsed.issueDate).toBe('string')
    expect(parsed.serverTime).toBe('2026-01-01T00:00:00.000Z')
    expect(typeof parsed.serverTime).toBe('string')
  })

  it('stringifies Date fields to ISO without throwing', () => {
    const json = JsonConvert.stringify({
      serverTime: new Date('2026-01-01T00:00:00.000Z'),
    })

    expect(json).toBe('{"serverTime":"2026-01-01T00:00:00.000Z"}')
    expect(JsonConvert.parse(json)).toEqual({
      serverTime: '2026-01-01T00:00:00.000Z',
    })
  })

  it('still restores Map and ArrayBuffer wrappers', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    const source = {
      map: new Map<string, number>([['a', 1]]),
      buffer,
    }

    const parsed = JsonConvert.parse(JsonConvert.stringify(source)) as {
      map: Map<string, number>
      buffer: ArrayBuffer
    }

    expect(parsed.map).toBeInstanceOf(Map)
    expect(parsed.map.get('a')).toBe(1)
    expect(parsed.buffer).toBeInstanceOf(ArrayBuffer)
    expect([...new Uint8Array(parsed.buffer)]).toEqual([1, 2, 3])
  })
})
