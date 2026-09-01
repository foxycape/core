import { describe, expect, it } from 'vitest'
import {
  buildPdfXyzDestAtTextOffset,
  formatPdfXyzDest,
  getPageText,
} from '@/mediaTypes/pdf/shared/text/pageText'

const textItem = (str: string, x: number, y: number, width: number, height = 12) => ({
  str,
  width,
  height,
  transform: [1, 0, 0, 1, x, y],
  hasEOL: false,
  dir: 'ltr',
  fontName: 'g_d0_f1',
})

const createPage = (
  items: ReturnType<typeof textItem>[],
  ref: { num: number; gen: number } | null = { num: 4, gen: 0 },
) => ({
  ref,
  getTextContent: async () => ({ items, styles: {} }),
})

describe('formatPdfXyzDest', () => {
  it('matches the FileLocation pdfDest JSON shape', () => {
    expect(formatPdfXyzDest({ num: 7, gen: 0 }, 12.5, 640)).toBe(
      '[{"num":7,"gen":0},{"name":"XYZ"},12.5,640,0]',
    )
  })
})

describe('buildPdfXyzDestAtTextOffset', () => {
  it('maps a character offset onto the matching text item in user space', async () => {
    const page = createPage([
      textItem('Hello ', 10, 400, 36),
      textItem('world', 50, 400, 30),
    ])
    const dest = await buildPdfXyzDestAtTextOffset(page, 6)
    expect(dest).toBe(formatPdfXyzDest({ num: 4, gen: 0 }, 50, 412))
  })

  it('prefers a snippet match when the stored offset is stale', async () => {
    const page = createPage([
      textItem('Intro ', 0, 500, 40),
      textItem('cited sentence', 80, 200, 90),
    ])
    const dest = await buildPdfXyzDestAtTextOffset(page, 0, 'cited sentence')
    expect(dest).toBe(formatPdfXyzDest({ num: 4, gen: 0 }, 80, 212))
  })

  it('returns undefined when the page has no dest ref', async () => {
    const page = createPage([textItem('Hello', 10, 400, 30)], null)
    expect(await buildPdfXyzDestAtTextOffset(page, 0)).toBeUndefined()
  })
})

describe('getPageText dest offset space', () => {
  it('keeps dest offsets aligned with concatenated item strings', async () => {
    const items = [textItem('Hello ', 10, 400, 36), textItem('world', 50, 400, 30)]
    const page = createPage(items)
    const text = await getPageText(page)
    expect(text).toBe('Hello world')
    expect(text.indexOf('world')).toBe(6)
  })
})
