import { describe, expect, it } from 'vitest'
import {
    remapStoredPageNumber,
    shouldKeepPageEndOnContentGrow,
} from '@/mediaTypes/html/renderer/location/remapStoredPageNumber'

describe('remapStoredPageNumber', () => {
    it('keeps the last page when a previous-chapter 1/1 location grows', () => {
        expect(remapStoredPageNumber({
            unit: 'page',
            current: 1,
            total: 1,
            direction: 'previous',
        }, 8)).toBe(8)
    })

    it('stays on page 1 when entering the next chapter at 1/1', () => {
        expect(remapStoredPageNumber({
            unit: 'page',
            current: 1,
            total: 1,
            direction: 'next',
        }, 8)).toBe(1)
    })

    it('scales a mid-chapter page when the total changes', () => {
        expect(remapStoredPageNumber({
            unit: 'page',
            current: 3,
            total: 6,
            direction: 'next',
        }, 12)).toBe(6)
    })

    it('does not remap when the page count is unchanged', () => {
        expect(remapStoredPageNumber({
            unit: 'page',
            current: 4,
            total: 10,
            direction: 'previous',
        }, 10)).toBe(4)
    })
})

describe('shouldKeepPageEndOnContentGrow', () => {
    it('is true only for a previous-chapter last-page location', () => {
        expect(shouldKeepPageEndOnContentGrow({
            url: 'ch2.xhtml',
            unit: 'page',
            current: 1,
            total: 1,
            direction: 'previous',
        }, 'ch2.xhtml')).toBe(true)
        expect(shouldKeepPageEndOnContentGrow({
            url: 'ch2.xhtml',
            unit: 'page',
            current: 1,
            total: 1,
            direction: 'next',
        }, 'ch2.xhtml')).toBe(false)
        expect(shouldKeepPageEndOnContentGrow({
            url: 'ch3.xhtml',
            unit: 'page',
            current: 1,
            total: 1,
            direction: 'previous',
        }, 'ch2.xhtml')).toBe(false)
    })
})
