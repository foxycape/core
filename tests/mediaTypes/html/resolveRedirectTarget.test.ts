/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { FileLocation } from '@/kernal/progress/Progress'
import { isDomRange } from '@/kernal/html/geometry'
import type { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { HtmlSettings } from '@/mediaTypes/html/HtmlSettings'
import { HtmlPageCalculator } from '@/mediaTypes/html/renderer/document/HtmlPageCalculator'
import type { HtmlLayoutMetrics } from '@/mediaTypes/html/renderer/layout/HtmlLayoutMetrics'
import { resolveContentRedirectTarget } from '@/mediaTypes/html/renderer/location/resolveRedirectTarget'
import type { IHtmlDocument } from '@/mediaTypes/html/renderer/IHtmlDocument'

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    }) as DOMRect

const imageLocation = () => {
    const location = new FileLocation('OPS/Chapter003_2.html')
    location.tagName = 'P'
    location.tagIndex = 28
    location.textOffset = 0
    location.from = 'mark'
    return location
}

describe('resolveContentRedirectTarget image-only paragraph', () => {
    it('selects the image instead of a character at offset 0', () => {
        const parsed = new DOMParser().parseFromString('<body><p><img src="pic.png"></p></body>', 'text/html')
        const paragraph = parsed.querySelector('p') as HTMLElement
        const image = parsed.querySelector('img') as HTMLImageElement
        const target = resolveContentRedirectTarget(paragraph, imageLocation())
        expect(isDomRange(target)).toBe(true)
        const range = target as Range
        expect(range.startContainer.childNodes[range.startOffset]).toBe(image)
        expect(range.endContainer.childNodes[range.endOffset - 1]).toBe(image)
    })

    it('selects the image when the paragraph only has whitespace around it', () => {
        const parsed = new DOMParser().parseFromString('<body><p>\n<img src="pic.png">\n</p></body>', 'text/html')
        const image = parsed.querySelector('img') as HTMLImageElement
        const target = resolveContentRedirectTarget(parsed.querySelector('p') as HTMLElement, imageLocation())
        expect(isDomRange(target)).toBe(true)
        const range = target as Range
        expect(range.startContainer.childNodes[range.startOffset]).toBe(image)
    })

    it('keeps a character range when the paragraph has text', () => {
        const parsed = new DOMParser().parseFromString('<body><p>Hello image</p></body>', 'text/html')
        const location = new FileLocation('chapter.html')
        location.textOffset = 0
        const target = resolveContentRedirectTarget(parsed.querySelector('p') as HTMLElement, location)
        expect(isDomRange(target)).toBe(true)
        const range = target as Range
        expect(range.startContainer.nodeType).toBe(Node.TEXT_NODE)
        expect(range.startContainer.textContent).toBe('Hello image')
    })

    it('uses the image client rect for the page number instead of the origin', () => {
        const parsed = new DOMParser().parseFromString('<body><p><img src="pic.png"></p></body>', 'text/html')
        parsed.documentElement.setAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName, '8')
        const paragraph = parsed.querySelector('p') as HTMLElement
        paragraph.getBoundingClientRect = () => rect(0, 0, 0, 0)
        const target = resolveContentRedirectTarget(paragraph, imageLocation())
        expect(isDomRange(target)).toBe(true)
        const range = target as Range
        range.getClientRects = () => [rect(2100, 20, 400, 300)] as unknown as DOMRectList

        const calculator = new HtmlPageCalculator(
            { getContentContainer: () => parsed.body } as unknown as IHtmlDocument,
            {
                getLayoutMetrics: () => ({
                    pageMoveLength: 500,
                    pageWidth: 480,
                    pageHeight: 800,
                    columnWidth: 480,
                    columnHeight: 800,
                    columnGap: 20,
                    shadowWidth: 0,
                    clientWidth: 480,
                    clientHeight: 800,
                }) as HtmlLayoutMetrics,
            } as never,
            { flipMode: 'page', writingMode: 'horizontal-tb', direction: 'ltr' } as HtmlOptions,
        )

        expect(calculator.getPageNumber(paragraph)).toBe(1)
        expect(calculator.getPageNumber(range)).toBe(5)
    })
})
