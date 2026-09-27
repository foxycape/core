import { assertByteRange, type IByteSource } from "./IByteSource";

/** Bytes already in memory. `read` returns a copy. */
export class MemoryByteSource implements IByteSource {
    readonly size: number
    private readonly bytes: Uint8Array

    constructor(data: ArrayBuffer | Uint8Array) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        this.size = this.bytes.byteLength
    }

    async read(start: number, end: number): Promise<Uint8Array> {
        assertByteRange(start, end)
        if (start >= this.size) {
            return new Uint8Array(0)
        }
        return this.bytes.slice(start, Math.min(end, this.size))
    }

    async close(): Promise<void> {
    }
}
