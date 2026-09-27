import { assertByteRange, type IByteSource } from "./IByteSource";

/** `Blob` or `File`. Each read uses `slice` and does not load the whole blob. */
export class BlobByteSource implements IByteSource {
    readonly size: number

    constructor(private readonly blob: Blob) {
        this.size = blob.size
    }

    static async fromHandle(handle: FileSystemFileHandle): Promise<BlobByteSource> {
        return new BlobByteSource(await handle.getFile())
    }

    async read(start: number, end: number): Promise<Uint8Array> {
        assertByteRange(start, end)
        if (start >= this.size) {
            return new Uint8Array(0)
        }
        const slice = this.blob.slice(start, Math.min(end, this.size))
        return new Uint8Array(await slice.arrayBuffer())
    }

    async close(): Promise<void> {
    }
}
