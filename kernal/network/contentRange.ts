export type ContentRange = {
    /** Inclusive start, as in the Content-Range header. */
    start: number
    /** Inclusive end, as in the Content-Range header. */
    end: number
    totalSize?: number
}

const CONTENT_RANGE_PATTERN = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i

/** Parse a Content-Range value such as `bytes 0-0/12345` or `bytes 0-0/*`. */
export const parseContentRange = (value: string | null | undefined): ContentRange | undefined => {
    if (!value) {
        return undefined
    }
    const match = CONTENT_RANGE_PATTERN.exec(value.trim())
    if (!match) {
        return undefined
    }
    const range: ContentRange = {
        start: Number(match[1]),
        end: Number(match[2]),
    }
    if (match[3] !== '*') {
        range.totalSize = Number(match[3])
    }
    return range
}
