import { md5, sha1 } from 'hash-wasm'
import { describe, expect, it } from 'vitest'
import { WebCrypto } from '@/kernal/crypto/WebCrypto'
import { computeMd5, computeSimpleId } from '@/kernal/crypto/MD5'
import {
    digestMany,
    digestStream,
    HASH_CHUNK_SIZE,
    SIMPLE_ID_BYTE_LENGTH,
} from '@/kernal/crypto/hash'

const fill = (length: number, seed = 1) => {
    const bytes = new Uint8Array(length)
    for (let index = 0; index < bytes.length; index++) {
        bytes[index] = (index + seed) & 0xff
    }
    return bytes
}

describe('digestStream', () => {
    it('matches known MD5 and SHA-1 vectors', async () => {
        expect(await digestStream('', 'MD5')).toBe('d41d8cd98f00b204e9800998ecf8427e')
        expect(await digestStream('abc', 'MD5')).toBe('900150983cd24fb0d6963f7d28e17f72')
        expect(await digestStream('', 'SHA-1')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
        expect(await digestStream('abc', 'SHA-1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
        expect(await digestStream('abc', 'SHA-256')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        )
    })

    it('hashes a Uint8Array view without the surrounding buffer', async () => {
        const backing = new Uint8Array([1, 2, 3, 4, 5])
        const view = backing.subarray(1, 4)
        const viewHash = await digestStream(view, 'MD5')
        expect(viewHash).toBe(await digestStream(new Uint8Array([2, 3, 4]), 'MD5'))
        expect(viewHash).not.toBe(await digestStream(backing, 'MD5'))
    })

    it('matches a one-shot digest for a blob larger than one chunk', async () => {
        const bytes = fill(HASH_CHUNK_SIZE + 64)
        const blob = new Blob([bytes])
        const streamed = await digestStream(blob, 'MD5', { chunkSize: 64 * 1024 })
        expect(streamed).toBe(await digestStream(bytes, 'MD5'))
        expect(streamed).toBe(await md5(bytes))
        expect(await digestStream(blob, 'SHA-1')).toBe(await sha1(bytes))
    })

    it('limits MD5 to the first 5MB while SHA-1 covers the whole source', async () => {
        const head = fill(SIMPLE_ID_BYTE_LENGTH, 7)
        const extra = new Uint8Array([9, 8, 7])
        const all = new Uint8Array(head.byteLength + extra.byteLength)
        all.set(head)
        all.set(extra, head.byteLength)
        const blob = new Blob([all])

        const [simpleId, resourceId] = await digestMany(blob, [
            { algorithm: 'MD5', maxBytes: SIMPLE_ID_BYTE_LENGTH },
            { algorithm: 'SHA-1' },
        ])

        expect(simpleId).toBe(await digestStream(head, 'MD5'))
        expect(simpleId).not.toBe(await digestStream(all, 'MD5'))
        expect(resourceId).toBe(await digestStream(all, 'SHA-1'))
        expect(await computeSimpleId(blob)).toBe(simpleId)
        expect(await computeMd5(head)).toBe(simpleId)
    })
})

describe('WebCrypto.digest', () => {
    const crypto = new WebCrypto()

    it('defaults to SHA-256 and streams MD5 for blobs', async () => {
        expect(await crypto.digest('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        )
        const bytes = fill(HASH_CHUNK_SIZE + 8, 3)
        expect(await crypto.digest(new Blob([bytes]), 'MD5')).toBe(await md5(bytes))
        const view = bytes.subarray(4, 20)
        expect(await crypto.digest(view, 'SHA-1')).toBe(await sha1(view))
    })
})
