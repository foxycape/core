/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { emptyElement } from '@/kernal/html/dom'
import { HtmlSettings } from '@/mediaTypes/html/HtmlSettings'
import { resolveContentWrapperMinWidth } from '@/mediaTypes/html/renderer/layout/resolveContentWrapperMinWidth'
import { isSubstantialWrapperRect, rectsIntersect } from '@/mediaTypes/html/renderer/documents/wrapperVisibility'

describe('resolveContentWrapperMinWidth', () => {
    it('maps viewport mode to the renderer client width', () => {
        expect(resolveContentWrapperMinWidth('viewport', {
            shadowWidth: 360,
            columnWidth: 300,
            columnGap: 40,
            viewportWidth: 800,
        })).toBe('800px')
        expect(resolveContentWrapperMinWidth('0', {
            shadowWidth: 360,
            columnWidth: 300,
            columnGap: 40,
            viewportWidth: 800,
        })).toBe('0')
        expect(resolveContentWrapperMinWidth('shadow', {
            shadowWidth: 360,
            columnWidth: 300,
            columnGap: 40,
            viewportWidth: 800,
        })).toBe('360px')
    })
})

describe('disposed vertical-scroll wrapper placeholder', () => {
    it('keeps min-width after the iframe is emptied', () => {
        const wrapper = document.createElement('div')
        wrapper.className = HtmlSettings.FileContentContainerClassName
        wrapper.style.minWidth = '400px'
        wrapper.appendChild(document.createElement('iframe'))
        wrapper.classList.add(HtmlSettings.FileContentContainerHeightClassName)
        emptyElement(wrapper)
        expect(wrapper.style.minWidth).toBe('400px')
        expect(wrapper.classList.contains(HtmlSettings.FileContentContainerHeightClassName)).toBe(true)
        expect(wrapper.childElementCount).toBe(0)
    })
})

describe('wrapperVisibility', () => {
    it('does not treat a collapsed 0-width rect as visible', () => {
        const viewport = { left: 0, top: 0, right: 400, bottom: 400 }
        const collapsed = { left: 80, top: 0, right: 80, bottom: 400, width: 0, height: 400 }
        expect(rectsIntersect(collapsed, viewport)).toBe(true)
        expect(isSubstantialWrapperRect(collapsed)).toBe(false)
        expect(isSubstantialWrapperRect({
            left: 0,
            top: 0,
            right: 400,
            bottom: 400,
            width: 400,
            height: 400,
        })).toBe(true)
    })
})
