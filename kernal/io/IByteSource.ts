import { HASH_CHUNK_SIZE } from "../crypto/hash";

/**
 * Random-access bytes. `read` uses a half-open range `[start, end)`.
 * Returned bytes are owned by the caller and must not alias a buffer a later read can overwrite.
 */
export type IByteSource = {
    readonly size: number
    /** Read `[start, end)`. A read past `size` returns a shorter array. `start >= size` returns an empty array. */
    read(start: number, end: number): Promise<Uint8Array>
    close(): Promise<void>
}

export const assertByteRange = (start: number, end: number) => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
        throw new RangeError(`Invalid byte range: ${start}-${end}`)
    }
}

/** Read `[start, end)` and throw when the source returns fewer bytes. */
export const readExact = async (source: IByteSource, start: number, end: number): Promise<Uint8Array> => {
    assertByteRange(start, end)
    const bytes = await source.read(start, end)
    const expected = end - start
    if (bytes.byteLength !== expected) {
        throw new RangeError(`Expected ${expected} bytes at ${start}, received ${bytes.byteLength}`)
    }
    return bytes
}

/**
 * A window over `source`. Offset 0 of the window is `start` in the parent.
 * Closing the window does not close the parent.
 */
export const sliceByteSource = (source: IByteSource, start: number, end: number): IByteSource => {
    assertByteRange(start, end)
    if (end > source.size) {
        throw new RangeError(`Byte window ${start}-${end} exceeds source size ${source.size}`)
    }
    const size = end - start
    return {
        size,
        read: async (innerStart, innerEnd) => {
            assertByteRange(innerStart, innerEnd)
            if (innerStart >= size) {
                return new Uint8Array(0)
            }
            const clampedEnd = Math.min(innerEnd, size)
            return source.read(start + innerStart, start + clampedEnd)
        },
        close: async () => { },
    }
}

/** Read the whole source into a new ArrayBuffer. */
export const materialize = async (source: IByteSource): Promise<ArrayBuffer> => {
    const output = new Uint8Array(source.size)
    let offset = 0
    while (offset < source.size) {
        const end = Math.min(offset + HASH_CHUNK_SIZE, source.size)
        const chunk = await source.read(offset, end)
        if (chunk.byteLength === 0) {
            break
        }
        output.set(chunk, offset)
        offset += chunk.byteLength
    }
    return output.buffer
}
