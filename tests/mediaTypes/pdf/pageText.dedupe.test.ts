import { describe, expect, it } from 'vitest'
import { getPageText } from '@/mediaTypes/pdf/shared/text/pageText'

const textItem = (
  str: string,
  x: number,
  y: number,
  width: number,
  height = 12,
) => ({
  str,
  width,
  height,
  transform: [1, 0, 0, 1, x, y],
  hasEOL: false,
  dir: 'ltr',
  fontName: 'g_d0_f1',
})

const createPage = (items: ReturnType<typeof textItem>[]) => ({
  getTextContent: async () => ({ items, styles: {} }),
})

describe('getPageText overlapping item dedupe', () => {
  it('keeps one copy of fake-bold overlay text at the same position', async () => {
    const page = createPage([
      textItem('字', 10, 100, 12),
      textItem('字', 10.2, 100.1, 12),
    ])
    expect(await getPageText(page)).toBe('字')
  })

  it('keeps the same character when it appears far apart', async () => {
    const page = createPage([
      textItem('字', 10, 100, 12),
      textItem('字', 10, 400, 12),
    ])
    expect(await getPageText(page)).toBe('字字')
  })

  it('replaces an earlier overlay when a later item has a clearly larger area', async () => {
    const page = createPage([
      textItem('字', 10, 100, 10, 10),
      textItem('字', 10, 100, 20, 20),
    ])
    expect(await getPageText(page)).toBe('字')
  })

  it('keeps the more complete text when overlapping areas are similar', async () => {
    const page = createPage([
      textItem('hel', 10, 100, 30),
      textItem('hello', 10, 100, 30),
    ])
    expect(await getPageText(page)).toBe('hello')
  })

  it('does not drop compatible text that does not overlap enough', async () => {
    const page = createPage([
      textItem('hello', 10, 100, 50),
      textItem('hello', 70, 100, 50),
    ])
    expect(await getPageText(page)).toBe('hellohello')
  })

  it('preserves whitespace-only structural items', async () => {
    const page = createPage([
      textItem('前', 10, 100, 12),
      textItem(' ', 22, 100, 4),
      textItem('后', 26, 100, 12),
    ])
    expect(await getPageText(page)).toBe('前 后')
  })

  it('does not drop distant items that share a prefix among many page items', async () => {
    const items = []
    for (let row = 0; row < 40; row++) {
      items.push(textItem(`第${row}行`, 10, 800 - row * 18, 48))
    }
    items.push(textItem('第0行', 10, 800, 48))
    const page = createPage(items)
    const text = await getPageText(page)
    expect(text.startsWith('第0行')).toBe(true)
    expect(text.includes('第39行')).toBe(true)
    expect(text.match(/第0行/g)?.length).toBe(1)
  })
})
