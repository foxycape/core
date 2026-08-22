import { describe, expect, it } from 'vitest'
import { applyNamed, DefaultLocale } from '@/kernal/i18n/DefaultLocale'

describe('applyNamed', () => {
  it('replaces placeholders in the fallback text', () => {
    expect(applyNamed('筛选 {count} 条标记', { count: 12 })).toBe('筛选 12 条标记')
  })

  it('returns the original text when no params are given', () => {
    expect(applyNamed('筛选 {count} 条标记')).toBe('筛选 {count} 条标记')
  })
})

describe('DefaultLocale.getText', () => {
  it('interpolates named params when the key exists', () => {
    const locale = new DefaultLocale()
    locale.resource = { 'reader.searchMarksHint': 'Filter {count} highlights' }
    expect(locale.getText('reader.searchMarksHint', '筛选 {count} 条标记', { count: 3 }))
      .toBe('Filter 3 highlights')
  })

  it('interpolates named params on the default text when the key is missing', () => {
    const locale = new DefaultLocale()
    expect(locale.getText('reader.searchMarksHint', '筛选 {count} 条标记', { count: 3 }))
      .toBe('筛选 3 条标记')
  })
})
