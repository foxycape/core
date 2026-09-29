import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ILocale } from '@/kernal/i18n/ILocale'
import { BlobByteSource } from '@/kernal/io/BlobByteSource'
import { openHttpByteSource } from '@/kernal/io/HttpByteSource'
import { materialize, readExact, sliceByteSource } from '@/kernal/io/IByteSource'
import { MemoryByteSource } from '@/kernal/io/MemoryByteSource'
import { HttpClient } from '@/kernal/network/HttpClient'
import { parseContentRange } from '@/kernal/network/contentRange'
import { DefaultFileUrlParser } from '@/kernal/services/fileUrlParser/DefaultFileUrlParser'
import type { IInternalUrlBuilder } from '@/kernal/services/internalUrlBuilder/IInternalUrlBuilder'

const bytes = Uint8Array.from({ length: 10 }, (_, index) => index)

const createParser = () => {
    const locale = { getText: (_key: string, fallback?: string) => fallback ?? '' } as ILocale
    const internalUrlBuilder = { getAbsoluteUrl: async (url: string) => url } as IInternalUrlBuilder
    return new DefaultFileUrlParser(new HttpClient(), internalUrlBuilder, locale)
}

describe('byte source', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reads a blob slice without exposing the whole file as data', async () => {
        const blob = new Blob([bytes])
        const result = await createParser().parse(blob)
        expect(result.data).toBeUndefined()
        expect(result.byteSource).toBeInstanceOf(BlobByteSource)
        expect(result.byteSource?.size).toBe(bytes.byteLength)
        expect(await result.byteSource?.read(1, 4)).toEqual(bytes.slice(1, 4))
    })

    it('materializes a blob only when requireFullFile is set', async () => {
        const blob = new Blob([bytes])
        const result = await createParser().parse(blob, { requireFullFile: true })
        expect(new Uint8Array(result.data!)).toEqual(bytes)
        expect(await result.byteSource?.read(0, 2)).toEqual(bytes.slice(0, 2))
    })

    it('returns a copy from memory so callers can mutate it', async () => {
        const source = new MemoryByteSource(bytes.slice())
        const chunk = await source.read(1, 3)
        chunk[0] = 99
        expect(await source.read(1, 3)).toEqual(bytes.slice(1, 3))
    })

    it('windows a source and rejects ranges outside it', async () => {
        const source = new MemoryByteSource(bytes)
        const window = sliceByteSource(source, 2, 5)
        expect(window.size).toBe(3)
        expect(await window.read(0, 2)).toEqual(bytes.slice(2, 4))
        expect(await window.read(1, 100)).toEqual(bytes.slice(3, 5))
        await expect(readExact(window, 0, 4)).rejects.toThrow(RangeError)
        expect(() => sliceByteSource(source, 8, 12)).toThrow(RangeError)
        await expect(source.read(-1, 1)).rejects.toThrow(RangeError)
    })

    it('materializes the full source', async () => {
        const source = new MemoryByteSource(bytes)
        expect(new Uint8Array(await materialize(source))).toEqual(bytes)
    })
})

describe('Content-Range', () => {
    it('parses totals, ranges, and unknown totals', () => {
        expect(parseContentRange('bytes 0-0/12345')).toEqual({ start: 0, end: 0, totalSize: 12345 })
        expect(parseContentRange('bytes 10-19/100')).toEqual({ start: 10, end: 19, totalSize: 100 })
        expect(parseContentRange('bytes 0-0/*')).toEqual({ start: 0, end: 0 })
        expect(parseContentRange(null)).toBeUndefined()
    })
})

describe('HTTP byte source', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const installFetch = (partial: boolean) => {
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            const rangeHeader = new Headers(init?.headers).get('Range')
            if (partial && rangeHeader) {
                const match = /bytes=(\d+)-(\d+)/.exec(rangeHeader)
                const start = Number(match?.[1])
                const inclusiveEnd = Number(match?.[2])
                const slice = bytes.slice(start, inclusiveEnd + 1)
                return new Response(slice, {
                    status: 206,
                    headers: { 'Content-Range': `bytes ${start}-${inclusiveEnd}/${bytes.byteLength}` },
                })
            }
            return new Response(bytes, { status: 200 })
        })
        vi.stubGlobal('fetch', fetchMock)
        return fetchMock
    }

    it('keeps range reads when the server returns 206', async () => {
        const fetchMock = installFetch(true)
        const source = await openHttpByteSource(new HttpClient(), 'https://example.com/book.epub')
        expect(source.size).toBe(bytes.byteLength)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(await source.read(8, 10)).toEqual(bytes.slice(8, 10))
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const range = new Headers(fetchMock.mock.calls[1][1]?.headers).get('Range')
        expect(range).toBe('bytes=8-9')
    })

    it('falls back to one full download when the server returns 200', async () => {
        const fetchMock = installFetch(false)
        const source = await openHttpByteSource(new HttpClient(), 'https://example.com/book.epub')
        expect(source.size).toBe(bytes.byteLength)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(await source.read(8, 10)).toEqual(bytes.slice(8, 10))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
