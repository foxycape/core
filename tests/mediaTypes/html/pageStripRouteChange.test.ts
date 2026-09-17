/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { HtmlSettings } from '@/mediaTypes/html/HtmlSettings'
import {
    freezePageStripForRouteChange,
    shouldIgnoreResizeAfterRouteChange,
    unfreezePageStripForRouteChange,
} from '@/mediaTypes/html/renderer/layout/pageStripRouteChange'

describe('page strip route change', () => {
    const createStrip = () => {
        const renderer = document.createElement('div')
        const transform = document.createElement('div')
        transform.className = HtmlSettings.TransformContainerCssName
        transform.setAttribute('data-target-transform', '120')
        transform.style.transform = 'translate3d(120px,0,0)'
        transform.style.transition = 'transform 0.2s ease'
        transform.style.willChange = 'transform'
        transform.setAttribute(HtmlSettings.PageMovingAttributeName, 'true')
        renderer.appendChild(transform)
        return { renderer, transform }
    }

    it('hides the strip and drops the old signed transform before LTR/RTL class swap', () => {
        const { renderer, transform } = createStrip()
        freezePageStripForRouteChange(renderer)
        expect(transform.getAttribute(HtmlSettings.LayoutSwitchingAttributeName)).toBe('true')
        expect(transform.hasAttribute(HtmlSettings.PageMovingAttributeName)).toBe(false)
        expect(transform.getAttribute('data-target-transform')).toBe('0')
        expect(transform.style.transform).toBe('translate3d(0px,0,0)')
        expect(transform.style.transition).toBe('none')
        expect(transform.style.willChange).toBe('')
    })

    it('reveals the strip after the new route transform is written', () => {
        const { renderer, transform } = createStrip()
        freezePageStripForRouteChange(renderer)
        transform.style.transform = 'translate3d(-120px,0,0)'
        transform.setAttribute('data-target-transform', '120')
        unfreezePageStripForRouteChange(renderer)
        expect(transform.hasAttribute(HtmlSettings.LayoutSwitchingAttributeName)).toBe(false)
        expect(transform.style.transform).toBe('translate3d(-120px,0,0)')
        expect(transform.getAttribute('data-target-transform')).toBe('120')
        expect(shouldIgnoreResizeAfterRouteChange(renderer)).toBe(true)
    })
})
