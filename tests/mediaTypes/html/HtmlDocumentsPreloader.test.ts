import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from '@/kernal/EventEmitter'
import { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { HtmlSettings } from '@/mediaTypes/html/HtmlSettings'
import { HtmlDocumentsPreloader } from '@/mediaTypes/html/renderer/documents/HtmlDocumentsPreloader'
import { collectPreloadNeighbors } from '@/mediaTypes/html/renderer/documents/preloadNeighbors'

const createDoc = (load: () => Promise<void>) => ({
    load,
    getWrapperContainer: () => ({
        isVisible: true,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
        clientWidth: 100,
    }),
    getContentContainer: () => undefined,
    dispose: async () => undefined,
})

describe('HtmlDocumentsPreloader page-moving gate', () => {
    it('skips and cancels preload while the page is moving', async () => {
        let isMoving = true
        const load = vi.fn(async () => undefined)
        const doc = createDoc(load)
        const transform = {
            hasAttribute: (name: string) =>
                isMoving && name === HtmlSettings.PageMovingAttributeName,
        }
        const renderer = {
            clientWidth: 400,
            querySelector: (selector: string) =>
                selector.includes(HtmlSettings.TransformContainerCssName) ? transform : null,
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 400 }),
        }
        const provider = {
            owner: { context: { currentLocation: {} } },
            getRendererContainer: () => renderer,
            getScrollElement: () => renderer,
            getDocuments: () => [doc],
            getVisibleDocuments: () => [doc],
            getLoadedDocuments: () => [doc],
        }
        const preloader = new HtmlDocumentsPreloader(
            new EventEmitter(),
            provider as never,
            () => undefined as never,
            new HtmlOptions(),
        )

        await preloader.preloadDocuments()
        expect(load).not.toHaveBeenCalled()

        isMoving = false
        await preloader.preloadDocuments()
        expect(load).toHaveBeenCalled()

        await preloader.dispose()
    })

    it('loads the previous chapter before the next one after a backward page turn', async () => {
        const order: string[] = []
        const createNamedDoc = (name: string, rect: { left: number; right: number }) => ({
            load: vi.fn(async () => {
                order.push(name)
            }),
            getWrapperContainer: () => ({
                isVisible: name === 'current',
                getBoundingClientRect: () => ({ left: rect.left, top: 0, right: rect.right, bottom: 100 }),
                clientWidth: 400,
            }),
            getContentContainer: () => undefined,
            dispose: async () => undefined,
        })
        const previous = createNamedDoc('previous', { left: -400, right: 0 })
        const current = createNamedDoc('current', { left: 0, right: 400 })
        const next = createNamedDoc('next', { left: 400, right: 800 })
        const renderer = {
            clientWidth: 400,
            querySelector: () => ({ hasAttribute: () => false }),
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 400 }),
            ownerDocument: { defaultView: { innerWidth: 400, innerHeight: 400 } },
        }
        const options = new HtmlOptions()
        options.flipMode = 'page'
        const preloader = new HtmlDocumentsPreloader(
            new EventEmitter(),
            {
                owner: { context: { currentLocation: { direction: 'previous' } } },
                getRendererContainer: () => renderer,
                getScrollElement: () => renderer,
                getDocuments: () => [previous, current, next],
                getVisibleDocuments: () => [current],
                getLoadedDocuments: () => [current],
            } as never,
            () => undefined as never,
            options,
        )

        await preloader.preloadDocuments()
        expect(order[0]).toBe('current')
        expect(order.indexOf('previous')).toBeGreaterThan(-1)
        expect(order.indexOf('previous')).toBeLessThan(order.indexOf('next'))
        await preloader.dispose()
    })
})

describe('collectPreloadNeighbors', () => {
    it('puts previous chapters first when flipping backward', () => {
        expect(collectPreloadNeighbors(['a', 'b', 'c', 'd'], 2, 2, 1, true)).toEqual(['b', 'd'])
        expect(collectPreloadNeighbors(['a', 'b', 'c', 'd'], 2, 2, 1, false)).toEqual(['d', 'b'])
    })
})
