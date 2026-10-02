/** @vitest-environment happy-dom */
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
import { pageVerticalLrLtr } from '@/mediaTypes/html/renderer/layout/geometry/pageVerticalLrLtr'
import { layoutGeometryById } from '@/mediaTypes/html/renderer/layout/geometry'
import {
    getScrollLocateDelta,
    isAtReadingStartScroll,
    pickVisibleCompensationDocument,
    pinReadingStartScroll,
    measurePageBoxDeltaAlongX,
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
    atReadingStart: false,
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
            atReadingStart: true,
        }))).toBe(600)
    })

    it('keeps live scroll when the anchor chapter grows away from the reading start', () => {
        expect(scrollVerticalRlLtr.restoreScroll(scrollInput({
            liveScroll: 400,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(400)
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

    it('restores scroll-horizontal-tb: preceding chapter adds sizeDelta, anchor chapter keeps live scroll', () => {
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
        }))).toBe(500)
        expect(scrollHorizontalTbRtl.restoreScroll(scrollInput({
            liveScroll: 1386,
            capturedScroll: 1386,
            sizeDelta: 145614,
            currentIndex: 0,
            anchorIndex: 0,
        }))).toBe(1386)
        expect(scrollHorizontalTbLtr.shouldApplyRestoredScroll(0, 500)).toBe(true)
        expect(scrollHorizontalTbLtr.skipsRestoreWhileSettling).toBe(false)
        expect(scrollVerticalLrLtr.skipsRestoreWhileSettling).toBe(true)
        expect(scrollVerticalRlLtr.skipsRestoreWhileSettling).toBe(true)
    })

    it('measures horizontal page size delta from scrollWidth outside Safari', () => {
        const wrapper = document.createElement('div')
        Object.defineProperty(wrapper, 'offsetWidth', { configurable: true, value: 480 })
        Object.defineProperty(wrapper, 'scrollWidth', { configurable: true, value: 960 })
        const captured = { width: 120, height: 40 }
        expect(pageHorizontalTbLtr.measurePageSizeDelta(wrapper, captured)).toBe(840)
        expect(pageHorizontalTbRtl.measurePageSizeDelta(wrapper, captured)).toBe(840)
        expect(pageHorizontalTbLtr.getCaptureExtent(wrapper).width).toBe(960)
        expect(pageHorizontalTbRtl.getCaptureExtent(wrapper).width).toBe(960)
        expect(measurePageBoxDeltaAlongX(wrapper, captured)).toBe(360)
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

    it('still compensates from the captured chapter index', () => {
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
        }))).toBe(900)
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

describe('layout axis measurement', () => {
    const wrapper = { scrollWidth: 500, offsetWidth: 420, offsetHeight: 80, scrollHeight: 240 } as HTMLElement
    const extent = { width: 300, height: 40 }
    const anchor = { offsetLeft: 30, offsetTop: 12 } as HTMLElement
    const capturedOffset = { offsetLeft: 10, offsetTop: 4 }

    it('measures vertical lr and rl on the same x axis', () => {
        expect(scrollVerticalLrLtr.measureBlockSizeDelta(wrapper, extent)).toBe(200)
        expect(scrollVerticalRlLtr.measureBlockSizeDelta(wrapper, extent)).toBe(200)
        expect(scrollVerticalLrLtr.measureBlockOffsetDelta(anchor, capturedOffset)).toBe(20)
        expect(scrollVerticalRlLtr.measureBlockOffsetDelta(anchor, capturedOffset)).toBe(20)
        expect(scrollVerticalLrLtr.measureBlockSizeDelta(null, extent)).toBe(-300)
    })

    it('compensates a later chapter on vertical-rl and leaves vertical-lr', () => {
        const input = scrollInput({
            liveScroll: 400,
            capturedScroll: 400,
            sizeDelta: 200,
            currentIndex: 2,
            anchorIndex: 0,
        })
        expect(scrollVerticalLrLtr.restoreScroll(input)).toBe(400)
        expect(scrollVerticalRlLtr.restoreScroll(input)).toBe(600)
    })

    it('measures horizontal scroll on y and page routes on their page axis', () => {
        expect(scrollHorizontalTbLtr.measureBlockSizeDelta(wrapper, extent)).toBe(40)
        expect(scrollHorizontalTbLtr.measureBlockOffsetDelta(anchor, capturedOffset)).toBe(8)
        expect(pageVerticalLrLtr.measurePageSizeDelta(wrapper, extent)).toBe(200)
        expect(pageVerticalLrLtr.measurePageOffsetDelta(anchor, capturedOffset)).toBe(8)
        expect(pageHorizontalTbLtr.measurePageSizeDelta(wrapper, extent)).toBe(200)
        expect(pageHorizontalTbLtr.measurePageOffsetDelta(anchor, capturedOffset)).toBe(20)
    })

    it('reads and writes logical scroll on the route axis', () => {
        const scrollElement = document.createElement('div')
        scrollElement.scrollLeft = 40
        scrollElement.scrollTop = 90
        const written: { left?: number; top?: number }[] = []
        scrollElement.scrollTo = (options?: ScrollToOptions) => {
            if (!options) {
                return
            }
            if (options.left != null) {
                scrollElement.scrollLeft = options.left
            }
            if (options.top != null) {
                scrollElement.scrollTop = options.top
            }
            written.push(options)
        }
        expect(scrollVerticalLrLtr.readLogicalScroll(scrollElement)).toBe(40)
        expect(scrollHorizontalTbLtr.readLogicalScroll(scrollElement)).toBe(90)
        expect(scrollVerticalLrLtr.readCapturedLogicalScroll(scrollElement, { scrollLeft: 15, scrollTop: 70 })).toBe(15)
        expect(scrollHorizontalTbLtr.readCapturedLogicalScroll(scrollElement, { scrollLeft: 15, scrollTop: 70 })).toBe(70)
        scrollVerticalLrLtr.writeLogicalScroll(scrollElement, 55)
        expect(scrollElement.scrollLeft).toBe(55)
        expect(scrollElement.scrollTop).toBe(90)
        scrollHorizontalTbLtr.writeLogicalScroll(scrollElement, 12)
        expect(scrollElement.scrollTop).toBe(12)
        expect(scrollElement.scrollLeft).toBe(55)
        expect(written).toEqual([{ left: 55, top: 90 }, { left: 55, top: 12 }])

        const transform = document.createElement('div')
        transform.setAttribute('data-target-transform', '120')
        expect(pageVerticalLrLtr.readPageTransform(transform)).toBe(120)
        expect(pageHorizontalTbLtr.readPageTransform(transform)).toBe(120)
        transform.removeAttribute('data-target-transform')
        transform.style.transform = 'translateY(30px)'
        expect(pageVerticalLrLtr.readPageTransform(transform)).toBe(30)
        transform.style.transform = 'translateX(18px)'
        expect(pageHorizontalTbLtr.readPageTransform(transform)).toBe(18)
    })
})

describe('document order compensation anchor', () => {
    it('uses the last visible document on scroll routes that compensate earlier chapters', () => {
        expect(scrollHorizontalTbLtr.documentOrderAnchor).toBe('last')
        expect(scrollHorizontalTbRtl.documentOrderAnchor).toBe('last')
        expect(scrollVerticalLrLtr.documentOrderAnchor).toBe('last')
        expect(scrollVerticalLrRtl.documentOrderAnchor).toBe('last')
        expect(scrollVerticalRlRtl.documentOrderAnchor).toBe('last')
        expect(scrollVerticalRlLtr.documentOrderAnchor).toBe('first')
    })

    it('keeps the first visible document on page routes', () => {
        expect(layoutGeometryById['page-horizontal-tb-ltr'].documentOrderAnchor).toBe('first')
        expect(layoutGeometryById['page-horizontal-tb-rtl'].documentOrderAnchor).toBe('first')
        expect(layoutGeometryById['page-vertical-lr-ltr'].documentOrderAnchor).toBe('first')
        expect(layoutGeometryById['page-vertical-lr-rtl'].documentOrderAnchor).toBe('first')
        expect(layoutGeometryById['page-vertical-rl-ltr'].documentOrderAnchor).toBe('first')
        expect(layoutGeometryById['page-vertical-rl-rtl'].documentOrderAnchor).toBe('first')
    })
})
