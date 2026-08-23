import { describe, expect, it } from 'vitest'
import {
  isRtlLanguage,
  normalizeLanguageCode,
  resolveTextDirectionFromLanguage,
} from '@/kernal/i18n/textDirection'
import { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { resolveHtmlTextDirection, resolveLayoutFlow } from '@/mediaTypes/html/renderer/layout/resolveLayoutFlow'

describe('textDirection', () => {
  it('normalizes region tags to the primary subtag', () => {
    expect(normalizeLanguageCode('ar-SA')).toBe('ar')
    expect(normalizeLanguageCode('he_IL')).toBe('he')
  })

  it('treats Arabic, Hebrew, Persian and Urdu as RTL', () => {
    expect(isRtlLanguage('ar')).toBe(true)
    expect(isRtlLanguage('ar-EG')).toBe(true)
    expect(isRtlLanguage('heb')).toBe(true)
    expect(isRtlLanguage('fa')).toBe(true)
    expect(isRtlLanguage('ur-PK')).toBe(true)
    expect(isRtlLanguage('en')).toBe(false)
    expect(isRtlLanguage('zh-CN')).toBe(false)
  })

  it('resolves language to a text direction', () => {
    expect(resolveTextDirectionFromLanguage('ar')).toBe('rtl')
    expect(resolveTextDirectionFromLanguage('en-US')).toBe('ltr')
    expect(resolveTextDirectionFromLanguage()).toBe('ltr')
  })

  it('uses an explicit htmlOptions.direction when provided', () => {
    const htmlOptions = Object.assign(new HtmlOptions(), {
      direction: 'ltr' as const,
      documentLanguage: 'ar',
    })
    expect(resolveHtmlTextDirection(htmlOptions)).toBe('ltr')
    expect(resolveLayoutFlow(htmlOptions).direction).toBe('ltr')
  })

  it('infers rtl from document language when direction is unset', () => {
    const htmlOptions = Object.assign(new HtmlOptions(), {
      documentLanguage: 'ar-SA',
    })
    expect(htmlOptions.direction).toBeUndefined()
    expect(resolveHtmlTextDirection(htmlOptions)).toBe('rtl')
    expect(resolveLayoutFlow(htmlOptions).isRtlProgression).toBe(true)
  })
})
