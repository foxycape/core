/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { FileLocation } from '@/kernal/progress/Progress'
import { defaultHtmlSymbolMeasure } from '@/mediaTypes/html/DefaultHtmlSymbolMeasure'
import type { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { HtmlElementLocator } from '@/mediaTypes/html/renderer/location/HtmlElementLocator'
import type { IHtmlDocument } from '@/mediaTypes/html/renderer/IHtmlDocument'

describe('HtmlElementLocator symbol unit', () => {
    const createDoc = (html: string) => {
        const parsed = new DOMParser().parseFromString(`<body><div id="content">${html}</div></body>`, 'text/html')
        const root = parsed.getElementById('content') as HTMLElement
        return {
            root,
            doc: {
                getContentContainer: () => root,
                getNumberOfPages: async () => 1,
                getPageNumber: async () => 1,
            } as unknown as IHtmlDocument,
        }
    }

    const locator = new HtmlElementLocator({
        fileParser: { symbolMeasure: defaultHtmlSymbolMeasure },
    } as never)

    const options = { flipMode: 'scroll' } as HtmlOptions

    it('writes unit=symbol current into intra-element textOffset', async () => {
        const { root, doc } = createDoc('<p>Hello cited world</p>')
        const location = new FileLocation('chapter-2.xhtml', 1, 'symbol')
        location.symbolType = 'char'
        location.current = (root.textContent ?? '').indexOf('cited')
        location.textOffset = 999

        const result = await locator.locateElement(doc, location, options)
        expect(result.target).toBeTruthy()
        expect(location.textOffset).toBeDefined()
        expect(location.textOffset).not.toBe(999)
    })
})

describe('HtmlElementLocator page unit', () => {
    const locator = new HtmlElementLocator({
        fileParser: { symbolMeasure: defaultHtmlSymbolMeasure },
    } as never)

    it('maps a previous-chapter 1/1 location to the last page after the chapter grows', async () => {
        const parsed = new DOMParser().parseFromString('<body><p>chapter</p></body>', 'text/html')
        const doc = {
            getContentContainer: () => parsed.body,
            getNumberOfPages: async () => 8,
            getPageNumber: async () => 1,
        } as unknown as IHtmlDocument
        const location = new FileLocation('chapter-2.xhtml', 1, 'page')
        location.current = 1
        location.direction = 'previous'
        const result = await locator.locateElement(doc, location, { flipMode: 'page' } as HtmlOptions)
        expect(result.pageNumber).toBe(8)
    })
})
