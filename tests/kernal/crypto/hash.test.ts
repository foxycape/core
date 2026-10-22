import { describe, expect, it } from 'vitest'
import { WebCrypto } from '@/kernal/crypto/WebCrypto'

describe('WebCrypto.digest', () => {
    const crypto = new WebCrypto()

    it('defaults to SHA-256', async () => {
        expect(await crypto.digest('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        )
        expect(await crypto.digest(new Blob([new TextEncoder().encode('abc')]))).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        )
    })

    it('hashes SHA-1 and ignores bytes outside a Uint8Array view', async () => {
        expect(await crypto.digest('abc', 'SHA-1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
        const backing = new Uint8Array([1, 2, 3, 4, 5])
        const view = backing.subarray(1, 4)
        const viewHash = await crypto.digest(view, 'SHA-1')
        expect(viewHash).toBe(await crypto.digest(new Uint8Array([2, 3, 4]), 'SHA-1'))
        expect(viewHash).not.toBe(await crypto.digest(backing, 'SHA-1'))
    })

    it('rejects MD5', async () => {
        await expect(crypto.digest('abc', 'MD5')).rejects.toThrow('MD5 is not implemented')
    })
})
