import { describe, expect, it } from 'vitest'
import { FileLocation } from '@/kernal/progress/Progress'
import { resolvePdfLocationPageNumber } from '@/mediaTypes/pdf/renderer/documents/resolvePdfLocationPageNumber'

describe('resolvePdfLocationPageNumber', () => {
    const pageFromUrl = (url: string) => {
        const parsed = Number.parseInt(url, 10)
        return Number.isFinite(parsed) && parsed >= 1 ? parsed : null
    }

    it('uses current as a 1-based page when unit is page', () => {
        const location = new FileLocation('12.pdf', 12, 'page')
        location.current = 12
        expect(resolvePdfLocationPageNumber(location, 40, pageFromUrl)).toBe(12)
    })

    it('does not treat a symbol index as a page number', () => {
        const location = new FileLocation('3.pdf', 1, 'symbol')
        location.current = 90
        expect(resolvePdfLocationPageNumber(location, 40, pageFromUrl)).toBe(3)
    })

    it('keeps ratio current in (0, 1) as a page fraction', () => {
        const location = new FileLocation('1.pdf', 1, 'ratio')
        location.current = 0.5
        expect(resolvePdfLocationPageNumber(location, 40, pageFromUrl)).toBe(20)
    })

    it('keeps the legacy ratio+current>=1 page heuristic', () => {
        const location = new FileLocation('1.pdf', 40, 'ratio')
        location.current = 8
        expect(resolvePdfLocationPageNumber(location, 40, pageFromUrl)).toBe(8)
    })

    it('returns null when unit is symbol and the url document is missing', () => {
        const location = new FileLocation('missing.pdf', 1, 'symbol')
        location.current = 90
        expect(resolvePdfLocationPageNumber(location, 40, () => null)).toBeNull()
    })
})
