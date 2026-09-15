import { describe, expect, it, vi } from 'vitest'
import { Options } from '@/kernal/Options'
import { OptionsProvider } from '@/kernal/OptionsProvider'
import { EventNames } from '@/kernal/EventNames'

const createProvider = (partial: Partial<Options> = {}) => {
  const options = Object.assign(new Options(), partial)
  const events = { emit: vi.fn() }
  return { options, events, provider: new OptionsProvider(events as any, options) }
}

const createStyleRoot = () => {
  const props: Record<string, string> = {}
  return {
    style: {
      setProperty: (key: string, value: string) => {
        props[key] = value
      },
      getPropertyValue: (key: string) => props[key] ?? '',
    },
  } as HTMLElement
}

describe('OptionsProvider', () => {
  it('applies scrollbar CSS variables without chrome insets', () => {
    const { provider } = createProvider()
    const root = createStyleRoot()
    provider.applyCssVariables(root)
    expect(root.style.getPropertyValue(Options.ScrollbarSize)).toBe('10px')
    expect(root.style.getPropertyValue(Options.ScrollbarRadius)).toBe('4px')
    expect(root.style.getPropertyValue(Options.ScrollbarBorder)).toBe('1px')
    expect(root.style.getPropertyValue('--header-height')).toBe('')
    expect(root.style.getPropertyValue('--footer-height')).toBe('')
  })

  it('emits OptionsChange when a known option is set', () => {
    const { options, events, provider } = createProvider()
    provider.setOptionValue('scrollbarSize', '12px')
    expect(options.scrollbarSize).toBe('12px')
    expect(events.emit).toHaveBeenCalledWith(EventNames.OptionsChange, 'scrollbarSize', '12px')
  })
})
