import type { IByteSource } from '../../kernal/io/IByteSource'
import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs'

/**
 * pdf.js range transport over an {@link IByteSource}.
 * `requestDataRange(begin, end)` is a half-open range `[begin, end)`.
 * `progressiveDone` is set so the full-file reader finishes without pulling every byte.
 */
export class ByteSourceRangeTransport extends pdfjsLib.PDFDataRangeTransport {
    private aborted = false

    constructor(
        private readonly source: IByteSource,
        private readonly onRangeError?: (error: unknown) => void,
    ) {
        super(source.size, null, true)
    }

    override requestDataRange(begin: number, end: number): void {
        if (this.aborted || end <= begin) {
            return
        }
        void this.readRange(begin, end)
    }

    override abort(): void {
        this.aborted = true
    }

    private async readRange(begin: number, end: number): Promise<void> {
        try {
            const chunk = await this.source.read(begin, end)
            if (this.aborted) {
                return
            }
            this.onDataRange(begin, chunk)
        } catch (error) {
            if (this.aborted) {
                return
            }
            this.onRangeError?.(error)
        }
    }
}
