import { afterEach, describe, expect, it } from 'vitest'
import { ContentCssVariables } from '@/mediaTypes/html/renderer/style/ContentCssVariables'

describe('ContentCssVariables.initializeDefaultVariables', () => {
    afterEach(() => {
        ContentCssVariables.initializeDefaultVariables({
            [ContentCssVariables.FontSize]: '20px',
        })
    })

    it('keeps the builtin desktop font size until overridden', () => {
        expect(ContentCssVariables.getDefaultVariables().get(ContentCssVariables.FontSize)).toBe('20px')
    })

    it('lets the host override default variables', () => {
        ContentCssVariables.initializeDefaultVariables({
            [ContentCssVariables.FontSize]: '18px',
        })
        expect(ContentCssVariables.getDefaultVariables().get(ContentCssVariables.FontSize)).toBe('18px')
        expect(ContentCssVariables.getDefaultVariables().get(ContentCssVariables.TextLineHeight)).toBe('1.65em')
    })
})
