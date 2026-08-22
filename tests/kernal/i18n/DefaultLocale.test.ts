import { describe, expect, it } from 'vitest'
import { applyNamed, DefaultLocale } from '@/kernal/i18n/DefaultLocale'

describe('applyNamed', () => {
  it('replaces placeholders in the fallback text', () => {
    expect(applyNamed('Filter {count} highlights', { count: 12 })).toBe('Filter 12 highlights')
  })

  it('returns the original text when no params are given', () => {
    expect(applyNamed('Filter {count} highlights')).toBe('Filter {count} highlights')
  })
})

describe('DefaultLocale.getText', () => {
  it('interpolates named params when the key exists', () => {
    const locale = new DefaultLocale()
    locale.resource = { 'reader.searchMarksHint': 'Filter {count} highlights' }
    expect(locale.getText('reader.searchMarksHint', 'Filter {count} highlights', { count: 3 }))
      .toBe('Filter 3 highlights')
  })

  it('interpolates named params on the default text when the key is missing', () => {
    const locale = new DefaultLocale()
    expect(locale.getText('reader.searchMarksHint', 'Filter {count} highlights', { count: 3 }))
      .toBe('Filter 3 highlights')
  })
})
