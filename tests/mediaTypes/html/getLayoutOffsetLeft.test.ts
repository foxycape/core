/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { getLayoutOffsetLeft } from '@/mediaTypes/html/renderer/layout/geometry/getLayoutOffsetLeft'

type OffsetNode = HTMLElement & {
    offsetLeft: number
    clientLeft: number
    offsetParent: HTMLElement | null
}

const offsetNode = (
    offsetLeft: number,
    clientLeft = 0,
    offsetParent: HTMLElement | null = null,
): OffsetNode => {
    const node = document.createElement('div') as OffsetNode
    Object.defineProperty(node, 'offsetLeft', { configurable: true, get: () => offsetLeft })
    Object.defineProperty(node, 'clientLeft', { configurable: true, get: () => clientLeft })
    Object.defineProperty(node, 'offsetParent', { configurable: true, get: () => offsetParent })
    return node
}

describe('getLayoutOffsetLeft', () => {
    it('includes an intermediate RTL wrapper left border so page start stays on the step grid', () => {
        const transform = offsetNode(0)
        const wrapper = offsetNode(490, 1, transform)
        const iframe = offsetNode(0, 0, wrapper)

        expect(getLayoutOffsetLeft(iframe, transform)).toBe(491)
    })

    it('does not add the ancestor border, and stays unchanged when the wrapper has no left border', () => {
        const transform = offsetNode(0, 4)
        const wrapper = offsetNode(100, 0, transform)
        const iframe = offsetNode(20, 0, wrapper)

        expect(getLayoutOffsetLeft(iframe, transform)).toBe(120)
    })
})
