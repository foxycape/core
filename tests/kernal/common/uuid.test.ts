import { describe, expect, it } from 'vitest'
import { computeUniqueId } from '@/kernal/common/uuid'

const goldenHashes: Array<[string, string]> = [
    ['', '4bcf7aef838e96d'],
    ['a', 'bb2929403ea4f5e8'],
    ['hello', 'e69c48650bb57be0'],
    ['12345678901234567890123456789012', '255c339dc1b27924'],
    ['123456789012345678901234567890123', 'cd25f6a0e58c032d'],
    ['{"enableHeader":true,"zenMode":false}', '5b0e045b5dde1b6c'],
    ['https://example.com/path?query=1&x=2', 'b3d7d6e28f1c8c09'],
    ['中文内容与 emoji 🦊', '8e2512c061b7f7b4'],
    ['a'.repeat(1000), '9fee8c974413c39f'],
    ['resource-id|geometry-key|selected text', '1310425ad7839bab'],
]

describe('computeUniqueId', () => {
    it('matches the previous xxhashjs h64 hex output', () => {
        for (const [content, hash] of goldenHashes) {
            expect(computeUniqueId(content)).toBe(hash)
        }
    })
})
