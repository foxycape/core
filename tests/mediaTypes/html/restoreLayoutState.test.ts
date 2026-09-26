import { describe, expect, it } from 'vitest'
import { scrollHorizontalTbLtr } from '@/mediaTypes/html/renderer/layout/geometry/scrollHorizontalTbLtr'
import { scrollHorizontalTbRtl } from '@/mediaTypes/html/renderer/layout/geometry/scrollHorizontalTbRtl'
import { scrollVerticalLrLtr } from '@/mediaTypes/html/renderer/layout/geometry/scrollVerticalLrLtr'
import { scrollVerticalLrRtl } from '@/mediaTypes/html/renderer/layout/geometry/scrollVerticalLrRtl'
import { scrollVerticalRlLtr } from '@/mediaTypes/html/renderer/layout/geometry/scrollVerticalRlLtr'
import { scrollVerticalRlRtl } from '@/mediaTypes/html/renderer/layout/geometry/scrollVerticalRlRtl'
import { fromLogicalScrollLeft, toLogicalScrollLeft } from '@/mediaTypes/html/renderer/layout/geometry/scrollLeftAxis'
import { pageHorizontalTbLtr } from '@/mediaTypes/html/renderer/layout/geometry/pageHorizontalTbLtr'
import { pageHorizontalTbRtl } from '@/mediaTypes/html/renderer/layout/geometry/pageHorizontalTbRtl'
import { layoutGeometryById } from '@/mediaTypes/html/renderer/layout/geometry'
import {
    excludeResizingCompensationDocument,
    getScrollLocateDelta,
    isAtReadingStartScroll,
    pickAbsoluteCompensationUrl,
    pickVisibleCompensationDocument,
    pinReadingStartScroll,
    resolveRestoreCompensationAnchor,
    restorePageTransformAlongEnd,
    restorePageTransformAlongStart,
    restoreScrollAlongStart,
} from '@/mediaTypes/html/renderer/layout/geometry/restoreLayoutState'
import type { RestoreScrollInput } from '@/mediaTypes/html/renderer/layout/geometry/ILayoutGeometry'

const scrollInput = (partial: Partial<RestoreScrollInput>): RestoreScrollInput => ({
    liveScroll: 0,
    capturedScroll: 0,
    sizeDelta: 0,
    offsetDelta: 0,
    foundElement: false,
    currentIndex: 0,
    anchorIndex: 0,
    ...partial,
})

describe('restoreScrollAlongLeftAnchoredReverse / scroll-vertical-rl-ltr', () => {
    it('pins the reading start when the current chapter grows and the user has not scrolled', () => {
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 400,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(600)
    })

    it('keeps live scroll after a left swipe while the current chapter grows', () => {
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 900,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(900)
    })

    it('does not move scroll when an earlier chapter on the right changes size', () => {
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 1200,
            capturedScroll: 400,
            sizeDelta: 300,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(1200)
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 1800,
            capturedScroll: 1800,
            sizeDelta: -500,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(1800)
    })

    it('shifts when a later chapter on the left changes size', () => {
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 800,
            capturedScroll: 400,
            sizeDelta: 400,
            currentIndex: 2,
            anchorIndex: 1,
        }))).toBe(1200)
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 1200,
            capturedScroll: 1200,
            sizeDelta: -400,
            currentIndex: 2,
            anchorIndex: 1,
        }))).toBe(800)
    })
})

describe('restoreScrollAlongStart / restorePageTransform wiring', () => {
    it('keeps live scroll on vertical-lr when the preceding chapter shrinks after a user move', () => {
        expect(restoreScrollAlongStart(scrollInput({
            liveScroll: 100,
            sizeDelta: 50,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(100)
        expect(scrollVerticalLrLtr.restoreScroll(scrollInput({
            liveScroll: 80,
            sizeDelta: 20,
            offsetDelta: 7,
            foundElement: true,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(87)
        expect(restoreScrollAlongStart(scrollInput({
            liveScroll: 200,
            capturedScroll: 200,
            sizeDelta: 80,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(280)
        expect(restoreScrollAlongStart(scrollInput({
            liveScroll: 2000,
            capturedScroll: 5000,
            sizeDelta: -3200,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(2000)
        expect(scrollVerticalLrLtr.restoreScroll(scrollInput({
            liveScroll: 2000,
            capturedScroll: 5000,
            sizeDelta: -3200,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(2000)
        expect(restoreScrollAlongStart(scrollInput({
            liveScroll: 5000,
            capturedScroll: 5000,
            sizeDelta: -3200,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(1800)
    })

    it('restores scroll-horizontal-tb with captured + sizeDelta like the pre-geometry helper', () => {
        expect(scrollHorizontalTbLtr.restoreScroll(scrollInput({
            liveScroll: 80,
            capturedScroll: 80,
            sizeDelta: 20,
            offsetDelta: 7,
            foundElement: true,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(87)
        expect(scrollHorizontalTbLtr.restoreScroll(scrollInput({
            liveScroll: 900,
            capturedScroll: 700,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(900)
        expect(scrollHorizontalTbRtl.restoreScroll(scrollInput({
            liveScroll: 900,
            capturedScroll: 700,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(900)
        expect(scrollHorizontalTbLtr.restoreScroll(scrollInput({
            liveScroll: 500,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(600)
        expect(scrollHorizontalTbLtr.shouldApplyRestoredScroll(0, 500)).toBe(true)
        expect(scrollHorizontalTbLtr.skipsRestoreWhileSettling).toBe(false)
        expect(scrollHorizontalTbLtr.compensationAnchorMode).toBe('first-visible')
        expect(scrollVerticalLrLtr.skipsRestoreWhileSettling).toBe(true)
        expect(scrollVerticalRlLtr.skipsRestoreWhileSettling).toBe(true)
        expect(scrollVerticalRlLtr.compensationAnchorMode).toBe('visual-edge')
    })

    it('keeps page transform +offset / -offset helpers', () => {
        expect(restorePageTransformAlongStart({
            currentTransform: 100,
            sizeDelta: 40,
            offsetDelta: 12,
            isFirstVisible: true,
            foundElement: true,
        })).toBe(112)
        expect(restorePageTransformAlongEnd({
            currentTransform: 100,
            sizeDelta: 40,
            offsetDelta: 12,
            isFirstVisible: true,
            foundElement: true,
        })).toBe(88)
        expect(pageHorizontalTbLtr.restorePageTransform({
            currentTransform: 50,
            sizeDelta: 10,
            offsetDelta: 4,
            isFirstVisible: true,
            foundElement: true,
        })).toBe(54)
        expect(pageHorizontalTbRtl.restorePageTransform({
            currentTransform: 50,
            sizeDelta: 10,
            offsetDelta: 4,
            isFirstVisible: true,
            foundElement: true,
        })).toBe(46)
    })

    it('picks the visually rightmost document on the end edge even if it is first in spine order', () => {
        const file0 = { id: 'file0', left: 800, right: 1200 }
        const file1 = { id: 'file1', left: 400, right: 800 }
        const file2 = { id: 'file2', left: 0, right: 400 }
        const visible = [file0, file1, file2]
        const getRect = (item: typeof file0) => ({ start: item.left, end: item.right })
        expect(pickVisibleCompensationDocument(visible, 'end', getRect)).toBe(file0)
        expect(pickVisibleCompensationDocument(visible, 'start', getRect)).toBe(file2)
        expect(pickVisibleCompensationDocument(['a', 'b', 'c'], 'start')).toBe('a')
        expect(pickVisibleCompensationDocument(['a', 'b', 'c'], 'end')).toBe('c')
        expect(scrollVerticalRlLtr.compensationAnchorEdge).toBe('end')
        expect(scrollHorizontalTbLtr.compensationAnchorEdge).toBe('start')
    })
})

describe('pinReadingStartScroll', () => {
    it('pins end routes to the current max and start routes to 0', () => {
        expect(pinReadingStartScroll({
            scrollExtent: 1200,
            clientLength: 400,
            initialScroll: 'end',
        })).toBe(800)
        expect(pinReadingStartScroll({
            scrollExtent: 1200,
            clientLength: 400,
            initialScroll: 'start',
        })).toBe(0)
        expect(pinReadingStartScroll({
            scrollExtent: 200,
            clientLength: 400,
            initialScroll: 'end',
        })).toBe(0)
    })

    it('uses the new max after file 0 grows while still pinned', () => {
        expect(pinReadingStartScroll({
            scrollExtent: 1600,
            clientLength: 400,
            initialScroll: 'end',
        })).toBe(1200)
        expect(isAtReadingStartScroll({
            liveScroll: 800,
            scrollExtent: 1200,
            clientLength: 400,
            initialScroll: 'end',
        })).toBe(true)
        expect(isAtReadingStartScroll({
            liveScroll: 12,
            scrollExtent: 1200,
            clientLength: 400,
            initialScroll: 'start',
        })).toBe(false)
        expect(isAtReadingStartScroll({
            liveScroll: 4,
            scrollExtent: 1200,
            clientLength: 400,
            initialScroll: 'start',
        })).toBe(true)
    })

    it('does not let a pin flag replace geometry.restoreScroll', () => {
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 900,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(900)
        expect(pinReadingStartScroll({
            scrollExtent: 1600,
            clientLength: 400,
            initialScroll: 'end',
        })).toBe(1200)
    })
})

describe('pickAbsoluteCompensationUrl', () => {
    it('keeps currentLocation.url after redirectingDocUrl expires while locate is held', () => {
        expect(pickAbsoluteCompensationUrl({
            direction: undefined,
            currentLocationUrl: 'chapter-8.html',
            redirectingDocUrl: undefined,
            holdAbsoluteAnchor: true,
        })).toBe('chapter-8.html')
        expect(pickAbsoluteCompensationUrl({
            direction: undefined,
            currentLocationUrl: 'chapter-8.html',
            redirectingDocUrl: undefined,
            holdAbsoluteAnchor: false,
        })).toBeUndefined()
        expect(pickAbsoluteCompensationUrl({
            direction: 'next',
            currentLocationUrl: 'chapter-8.html',
            redirectingDocUrl: 'chapter-8.html',
            holdAbsoluteAnchor: true,
        })).toBeUndefined()
    })
})

describe('getScrollLocateDelta', () => {
    it('aligns to the reading-start edge', () => {
        expect(getScrollLocateDelta({
            targetStart: 120,
            viewportStart: 0,
            targetEnd: 200,
            viewportEnd: 400,
            initialScroll: 'start',
        })).toBe(120)
        expect(getScrollLocateDelta({
            targetStart: 120,
            viewportStart: 0,
            targetEnd: 200,
            viewportEnd: 400,
            initialScroll: 'end',
        })).toBe(-200)
        expect(scrollHorizontalTbLtr.getScrollLocateDelta({
            targetStart: 120,
            viewportStart: 0,
            targetEnd: 200,
            viewportEnd: 400,
        })).toBe(120)
        expect(scrollVerticalRlLtr.getScrollLocateDelta({
            targetStart: 120,
            viewportStart: 0,
            targetEnd: 200,
            viewportEnd: 400,
        })).toBe(-200)
    })
})

describe('pipeline-owned scroll I/O policy', () => {
    it('locks preload / hold / visibility / compensation axis by route id', () => {
        expect(scrollHorizontalTbLtr.preloadRangeMode).toBe('visible-span')
        expect(scrollHorizontalTbLtr.rewritesWrapperVisibility).toBe(false)
        expect(scrollHorizontalTbLtr.holdsAbsoluteLocate).toBe(false)
        expect(scrollHorizontalTbLtr.compensationAnchorMode).toBe('first-visible')
        expect(scrollHorizontalTbLtr.getCompensationRect({
            top: 10,
            bottom: 80,
            left: 3,
            right: 90,
        })).toEqual({ start: 10, end: 80 })

        expect(scrollVerticalRlLtr.preloadRangeMode).toBe('visual-edge')
        expect(scrollVerticalRlLtr.rewritesWrapperVisibility).toBe(true)
        expect(scrollVerticalRlLtr.holdsAbsoluteLocate).toBe(true)
        expect(scrollVerticalRlLtr.getCompensationRect({
            top: 10,
            bottom: 80,
            left: 3,
            right: 90,
        })).toEqual({ start: 3, end: 90 })

        expect(layoutGeometryById['scroll-vertical-rl-rtl'].preloadRangeMode).toBe('visual-edge')
        expect(layoutGeometryById['scroll-vertical-lr-ltr'].preloadRangeMode).toBe('visual-edge')
        expect(layoutGeometryById['scroll-vertical-lr-rtl'].holdsAbsoluteLocate).toBe(true)
        expect(layoutGeometryById['page-horizontal-tb-ltr'].preloadRangeMode).toBe('page-fill')
        expect(layoutGeometryById['page-horizontal-tb-ltr'].holdsAbsoluteLocate).toBe(false)
        expect(layoutGeometryById['page-vertical-rl-ltr'].rewritesWrapperVisibility).toBe(false)
    })

    it('keeps the captured reading chapter as restore anchor when locate is not held', () => {
        const previous = { id: 'previous' }
        const current = { id: 'current' }
        expect(excludeResizingCompensationDocument([previous, current], previous)).toEqual([current])
        expect(resolveRestoreCompensationAnchor(current, previous, false)).toBe(current)
        expect(resolveRestoreCompensationAnchor(current, previous, true)).toBe(previous)
        expect(scrollHorizontalTbLtr.restoreScroll(scrollInput({
            liveScroll: 900,
            capturedScroll: 700,
            sizeDelta: 400,
            currentIndex: 0,
            anchorIndex: 1,
        }))).toBe(1100)
        expect(scrollHorizontalTbLtr.restoreScroll(scrollInput({
            liveScroll: 900,
            capturedScroll: 700,
            sizeDelta: 400,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(1100)
    })
})

describe('rtl vertical scrollLeft axis', () => {
    const writeBack = (raw: number, sizeDelta: number, restore: (input: RestoreScrollInput) => number) => {
        const logical = toLogicalScrollLeft(raw, -1)
        const nextLogical = restore(scrollInput({
            liveScroll: logical,
            capturedScroll: logical,
            sizeDelta,
            currentIndex: 0,
            anchorIndex: 0,
        }))
        return fromLogicalScrollLeft(nextLogical, -1)
    }

    it('adds a width delta to the distance from the right edge', () => {
        expect(writeBack(-400, 200, scrollVerticalLrRtl.restoreScroll)).toBe(-600)
    })

    it('does not follow the current chapter width on vertical-rl rtl', () => {
        expect(writeBack(-400, 200, scrollVerticalRlRtl.restoreScroll)).toBe(-400)
    })

    it('follows the current chapter width on vertical-lr rtl', () => {
        expect(scrollVerticalLrRtl.restoreScroll(scrollInput({
            liveScroll: 400,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(600)
    })
})
