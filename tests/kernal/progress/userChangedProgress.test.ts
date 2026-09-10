import { describe, expect, it } from 'vitest'
import { EventEmitter } from '@/kernal/EventEmitter'
import { EventNames } from '@/kernal/EventNames'
import { Context } from '@/kernal/Context'
import {
  applyPagingLocationFrom,
  isAppLocationFrom,
  locationFromOfPagingExtra,
  shouldSetUserChangedProgress,
} from '@/kernal/progress/userChangedProgress'

describe('locationFromOfPagingExtra', () => {
  it('maps paging trigger types onto LocationFrom', () => {
    expect(locationFromOfPagingExtra({ trigger: 'user', triggerType: 'mouse' })).toBe('mouse')
    expect(locationFromOfPagingExtra({ trigger: 'user', triggerType: 'touch' })).toBe('touch')
    expect(locationFromOfPagingExtra({ trigger: 'user', triggerType: 'keyboard' })).toBe('keyboard')
    expect(locationFromOfPagingExtra({ trigger: 'user', triggerType: 'key' })).toBe('keyboard')
    expect(locationFromOfPagingExtra({ trigger: 'user', triggerType: 'wheel' })).toBe('wheel')
    expect(locationFromOfPagingExtra({ trigger: 'user', triggerType: 'pen' })).toBe('mouse')
  })

  it('defaults user flips without a trigger type to mouse', () => {
    expect(locationFromOfPagingExtra({ trigger: 'user' })).toBe('mouse')
  })

  it('ignores app-triggered page turns', () => {
    expect(locationFromOfPagingExtra({ trigger: 'app', triggerType: 'mouse' })).toBeUndefined()
    expect(locationFromOfPagingExtra(undefined)).toBeUndefined()
  })

  it('writes from onto a location', () => {
    const location = applyPagingLocationFrom({ current: 2 }, { trigger: 'user', triggerType: 'touch' })
    expect(location.from).toBe('touch')
  })
})

describe('shouldSetUserChangedProgress', () => {
  it('treats tts follow and open-book restore as non-user jumps', () => {
    expect(isAppLocationFrom('tts')).toBe(true)
    expect(isAppLocationFrom('restore')).toBe(true)
    expect(shouldSetUserChangedProgress(false, 'tts')).toBe(false)
    expect(shouldSetUserChangedProgress(false, 'restore')).toBe(false)
    expect(shouldSetUserChangedProgress(false, 'toc')).toBe(true)
    expect(shouldSetUserChangedProgress(true, 'toc')).toBe(false)
  })
})

describe('Context.setUserChangedProgress', () => {
  it('does not emit or keep the flag for tts and restore', () => {
    const events = new EventEmitter()
    const emitted: unknown[] = []
    events.on(EventNames.UserChangedProgress, (from) => {
      emitted.push(from)
    })
    const context = new Context(events)
    context.currentNavPointKey = 'keep-me'

    context.setUserChangedProgress(true, 'tts')
    expect(context.userChangedProgress).toBe(false)
    expect(emitted).toEqual([])
    expect(context.currentNavPointKey).toBe('keep-me')

    context.setUserChangedProgress(true, 'restore')
    expect(context.userChangedProgress).toBe(false)
    expect(emitted).toEqual([])

    context.setUserChangedProgress(true, 'toc')
    expect(context.userChangedProgress).toBe(true)
    expect(emitted).toEqual(['toc'])
    expect(context.currentNavPointKey).toBe('keep-me')
  })
})
