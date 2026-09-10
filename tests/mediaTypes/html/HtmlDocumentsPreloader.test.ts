import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from '@/kernal/EventEmitter'
import { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { HtmlSettings } from '@/mediaTypes/html/HtmlSettings'
import { HtmlDocumentsPreloader } from '@/mediaTypes/html/renderer/documents/HtmlDocumentsPreloader'

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
})
