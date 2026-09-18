import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    beginAbsoluteLocate,
    beginProgrammaticScroll,
    endProgrammaticScroll,
    isHoldingAbsoluteAnchor,
    isPinReadingStart,
    isProgrammaticScroll,
    isUserScrollSettling,
    markUserScroll,
    PROGRAMMATIC_SCROLL_QUIET_MS,
    releaseAbsoluteLocate,
    resetUserScroll,
    setPinReadingStart,
    shouldBeginAbsoluteLocate,
    USER_SCROLL_SETTLE_MS,
} from '@/mediaTypes/html/renderer/location/scrollActivity'

describe('scrollActivity', () => {
    afterEach(() => {
        resetUserScroll()
        vi.restoreAllMocks()
    })

    it('is not settling before any user scroll', () => {
        expect(isUserScrollSettling()).toBe(false)
    })

    it('is settling immediately after a user scroll and clear after the settle window', () => {
        const now = vi.spyOn(Date, 'now')
        now.mockReturnValue(20_000)
        markUserScroll()
        expect(isUserScrollSettling()).toBe(true)

        now.mockReturnValue(20_000 + USER_SCROLL_SETTLE_MS)
        expect(isUserScrollSettling()).toBe(false)
    })

    it('tracks the reading-start pin independently of the settle window', () => {
        expect(isPinReadingStart()).toBe(false)
        setPinReadingStart(true)
        expect(isPinReadingStart()).toBe(true)
        resetUserScroll()
        expect(isPinReadingStart()).toBe(false)
    })

    it('holds an absolute locate until a trusted user scroll', () => {
        setPinReadingStart(true)
        beginAbsoluteLocate()
        expect(isHoldingAbsoluteAnchor()).toBe(true)
        expect(isPinReadingStart()).toBe(false)
        markUserScroll()
        expect(isHoldingAbsoluteAnchor()).toBe(true)
        expect(isUserScrollSettling()).toBe(true)
        releaseAbsoluteLocate()
        expect(isHoldingAbsoluteAnchor()).toBe(false)
    })

    it('keeps a quiet window after a programmatic restore scroll', () => {
        const now = vi.spyOn(Date, 'now')
        now.mockReturnValue(30_000)
        expect(isProgrammaticScroll()).toBe(false)
        beginProgrammaticScroll()
        expect(isProgrammaticScroll()).toBe(true)
        endProgrammaticScroll()
        expect(isProgrammaticScroll()).toBe(true)
        now.mockReturnValue(30_000 + PROGRAMMATIC_SCROLL_QUIET_MS)
        expect(isProgrammaticScroll()).toBe(false)
    })

    it('begins an absolute locate hold only when the route asks for it', () => {
        expect(shouldBeginAbsoluteLocate(undefined, false)).toBe(false)
        expect(shouldBeginAbsoluteLocate('toc' as never, false)).toBe(false)
        expect(shouldBeginAbsoluteLocate(undefined, true)).toBe(true)
        expect(shouldBeginAbsoluteLocate('next', true)).toBe(false)
        expect(shouldBeginAbsoluteLocate('previous', true)).toBe(false)
    })
})
