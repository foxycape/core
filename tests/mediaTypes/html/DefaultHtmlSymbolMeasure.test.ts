/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { defaultHtmlSymbolMeasure } from '@/mediaTypes/html/DefaultHtmlSymbolMeasure'
import { identityHtmlContentNormalizer } from '@/mediaTypes/html/IHtmlContentNormalizer'

describe('identityHtmlContentNormalizer', () => {
    it('returns the source unchanged', () => {
        const html = '<p>hello\nworld</p>'
        expect(identityHtmlContentNormalizer.normalize(html)).toBe(html)
    })
})

describe('DefaultHtmlSymbolMeasure', () => {
    const createRoot = (html: string) => {
        const document = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
        return document.body
    }

    it('counts text length and media tags for custom', () => {
        const root = createRoot('<p>ab</p><img src="x"><svg></svg>')
        expect(defaultHtmlSymbolMeasure.count(root, 'char')).toBe(2)
        expect(defaultHtmlSymbolMeasure.count(root, 'custom')).toBe(4)
    })

    it('maps progress back to an element', () => {
        const root = createRoot('<p>hello</p>')
        const result = defaultHtmlSymbolMeasure.getElementByProgress(root, 0.5, 'char')
        expect(result?.element.tagName.toLowerCase()).toBe('p')
    })
})
