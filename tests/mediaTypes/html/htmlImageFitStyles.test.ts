import { describe, expect, it } from 'vitest'
import { getImageFitStyles, getImageForcedHeightCss } from '@/mediaTypes/html/renderer/image/htmlImageFitStyles'

describe('htmlImageFitStyles', () => {
    it('sizes images against the physical column box, not CSS column-width', () => {
        const styles = getImageFitStyles(800, 400)
        expect(styles.width).toBe('calc(var(--column-box-width) * var(--max-image-width-ratio))')
        expect(styles['max-width']).toBe(styles.width)
        expect(styles['max-height']).toBe('min(400px,var(--column-box-height),calc(var(--column-box-width) / 800 * 400))')
        expect(styles['aspect-ratio']).toBe('800 / 400')
        expect(styles.width).not.toContain('--column-width)')
        expect(styles['max-height']).not.toContain('--column-width)')
    })

    it('keeps a 408-wide column from using page-height as the image width', () => {
        const heightCss = getImageForcedHeightCss(1200, 800, '0.7')
        expect(heightCss).toBe(
            'min(calc(800px * 0.7),calc(var(--column-box-height) * 0.7),calc(var(--column-box-width) / 1200 * 800 * 0.7))'
        )
        expect(heightCss).not.toContain('--column-width')
        expect(heightCss).not.toContain('--column-height)')
    })
})
