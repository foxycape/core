import { describe, expect, it, vi } from 'vitest'
import type { IByteSource } from '@/kernal/io/IByteSource'
import { ByteSourceRangeTransport } from '@/mediaTypes/pdf/ByteSourceRangeTransport'

const bytes = Uint8Array.from({ length: 1000 }, (_, index) => index % 256)

const recordingSource = (): { source: IByteSource; reads: Array<[number, number]> } => {
    const reads: Array<[number, number]> = []
    const source: IByteSource = {
        size: bytes.byteLength,
        read: async (start, end) => {
            reads.push([start, end])
            return bytes.slice(start, end)
        },
        close: async () => { },
    }
    return { source, reads }
}

describe('ByteSourceRangeTransport', () => {
    it('reads half-open ranges and does not load the whole source', async () => {
        const { source, reads } = recordingSource()
        const transport = new ByteSourceRangeTransport(source)
        const received: Array<{ begin: number; chunk: Uint8Array }> = []
        vi.spyOn(transport, 'onDataRange').mockImplementation((begin, chunk) => {
            received.push({ begin, chunk: chunk ?? new Uint8Array() })
        })

        transport.requestDataRange(10, 20)
        transport.requestDataRange(100, 116)
        await vi.waitFor(() => expect(received).toHaveLength(2))

        expect(reads).toEqual([[10, 20], [100, 116]])
        expect(received[0]?.begin).toBe(10)
        expect(received[0]?.chunk).toEqual(bytes.slice(10, 20))
        expect(received[1]?.begin).toBe(100)
        expect(received[1]?.chunk).toEqual(bytes.slice(100, 116))
        expect(reads.some(([start, end]) => start === 0 && end === source.size)).toBe(false)
        expect(transport.length).toBe(source.size)
        expect(transport.progressiveDone).toBe(true)
        expect(transport.initialData).toBeNull()
    })

    it('reports a failed range read instead of delivering bytes', async () => {
        const failure = new Error('range failed')
        const errors: unknown[] = []
        const transport = new ByteSourceRangeTransport({
            size: 64,
            read: async () => {
                throw failure
            },
            close: async () => { },
        }, (error) => {
            errors.push(error)
        })
        const onDataRange = vi.spyOn(transport, 'onDataRange')

        transport.requestDataRange(0, 8)
        await vi.waitFor(() => expect(errors).toEqual([failure]))
        expect(onDataRange).not.toHaveBeenCalled()
    })
})
