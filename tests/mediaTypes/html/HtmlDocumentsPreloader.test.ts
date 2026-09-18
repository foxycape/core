import { afterEach, describe, expect, it, vi } from 'vitest'
import { beginProgrammaticScroll, endProgrammaticScroll, isUserScrollSettling, resetUserScroll } from '@/mediaTypes/html/renderer/location/scrollActivity'
import { EventEmitter } from '@/kernal/EventEmitter'
import { EventNames } from '@/kernal/EventNames'
import { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { HtmlSettings } from '@/mediaTypes/html/HtmlSettings'
import {
    HtmlDocumentsPreloader,
    SCROLL_PRELOAD_SETTLE_MS,
} from '@/mediaTypes/html/renderer/documents/HtmlDocumentsPreloader'
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

describe('HtmlDocumentsPreloader scroll settle gate', () => {
    afterEach(() => {
        resetUserScroll()
        vi.restoreAllMocks()
    })

    it('does not dispose leftover chapters immediately after a scroll', async () => {
        const now = vi.spyOn(Date, 'now')
        now.mockReturnValue(10_000)
        const leftoverDispose = vi.fn(async () => undefined)
        const visible = createDoc(vi.fn(async () => undefined))
        const neighbor = {
            ...createDoc(vi.fn(async () => undefined)),
            getWrapperContainer: () => ({
                isVisible: false,
                getBoundingClientRect: () => ({ left: 400, top: 0, right: 600, bottom: 100 }),
                clientWidth: 200,
            }),
        }
        const leftover = {
            ...createDoc(vi.fn(async () => undefined)),
            dispose: leftoverDispose,
            getWrapperContainer: () => ({
                isVisible: false,
                getBoundingClientRect: () => ({ left: -800, top: 0, right: -600, bottom: 100 }),
                clientWidth: 200,
            }),
        }
        const renderer = {
            clientWidth: 400,
            querySelector: () => ({ hasAttribute: () => false }),
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 400 }),
            ownerDocument: { defaultView: { innerWidth: 400, innerHeight: 400 } },
        }
        const events = new EventEmitter()
        const preloader = new HtmlDocumentsPreloader(
            events,
            {
                owner: { context: { currentLocation: {} } },
                getRendererContainer: () => renderer,
                getScrollElement: () => renderer,
                getDocuments: () => [leftover, neighbor, visible],
                getVisibleDocuments: () => [visible],
                getLoadedDocuments: () => [leftover, visible],
            } as never,
            () => undefined as never,
            new HtmlOptions(),
        )

        events.emit(EventNames.ReaderDebounceScroll)
        await preloader.preloadDocuments()
        expect(leftoverDispose).not.toHaveBeenCalled()

        now.mockReturnValue(10_000 + SCROLL_PRELOAD_SETTLE_MS)
        await preloader.preloadDocuments()
        expect(leftoverDispose).toHaveBeenCalled()

        now.mockRestore()
        await preloader.dispose()
    })

    it('does not treat a programmatic restore scroll as user activity', async () => {
        const renderer = {
            clientWidth: 400,
            querySelector: () => ({ hasAttribute: () => false }),
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 400 }),
        }
        const events = new EventEmitter()
        const preloader = new HtmlDocumentsPreloader(
            events,
            {
                owner: { context: { currentLocation: {} } },
                getRendererContainer: () => renderer,
                getScrollElement: () => renderer,
                getDocuments: () => [],
                getVisibleDocuments: () => [],
                getLoadedDocuments: () => [],
            } as never,
            () => undefined as never,
            new HtmlOptions(),
        )

        beginProgrammaticScroll()
        events.emit(EventNames.ReaderDebounceScroll, undefined, { isTrusted: false })
        endProgrammaticScroll()
        expect(isUserScrollSettling()).toBe(false)

        await preloader.dispose()
    })
})

describe('HtmlDocumentsPreloader substantial visible range', () => {
    afterEach(() => {
        resetUserScroll()
        vi.restoreAllMocks()
    })

    it('ignores collapsed wrappers and does not reserve a distant chapter', async () => {
        const createNamedDoc = (
            name: string,
            rect: { left: number; right: number },
            extra?: { dispose?: () => Promise<void> },
        ) => ({
            load: vi.fn(async () => undefined),
            dispose: extra?.dispose ?? vi.fn(async () => undefined),
            getWrapperContainer: () => ({
                isVisible: false,
                getBoundingClientRect: () => ({
                    left: rect.left,
                    top: 0,
                    right: rect.right,
                    bottom: 100,
                    width: rect.right - rect.left,
                    height: 100,
                }),
                clientWidth: Math.max(0, rect.right - rect.left),
            }),
            getContentContainer: () => undefined,
        })
        const file0 = createNamedDoc('file0', { left: 0, right: 400 })
        const file1 = createNamedDoc('file1', { left: 80, right: 80 })
        const file2 = createNamedDoc('file2', { left: 80, right: 80 })
        const file3 = createNamedDoc('file3', { left: 80, right: 80 })
        const file4 = createNamedDoc('file4', { left: 80, right: 80 })
        const file5Dispose = vi.fn(async () => undefined)
        const file5 = createNamedDoc('file5', { left: 80, right: 80 }, { dispose: file5Dispose })
        const renderer = {
            clientWidth: 400,
            querySelector: () => ({ hasAttribute: () => false }),
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 400 }),
            ownerDocument: { defaultView: { innerWidth: 400, innerHeight: 400 } },
        }
        const options = new HtmlOptions()
        options.flipMode = 'scroll'
        options.writingMode = 'vertical-rl'
        options.direction = 'ltr'
        options.preloadFileCount = 1
        const preloader = new HtmlDocumentsPreloader(
            new EventEmitter(),
            {
                owner: { context: { currentLocation: {} } },
                getRendererContainer: () => renderer,
                getScrollElement: () => renderer,
                getDocuments: () => [file0, file1, file2, file3, file4, file5],
                getVisibleDocuments: () => [file0],
                getLoadedDocuments: () => [file0, file5],
            } as never,
            () => undefined as never,
            options,
        )

        await preloader.preloadDocuments()
        expect(file0.load).toHaveBeenCalled()
        expect(file5.load).not.toHaveBeenCalled()
        expect(file5Dispose).toHaveBeenCalled()
        expect(file0.dispose).not.toHaveBeenCalled()

        await preloader.dispose()
    })
})

describe('HtmlDocumentsPreloader horizontal-tb visible range', () => {
    afterEach(() => {
        resetUserScroll()
        vi.restoreAllMocks()
    })

    it('reserves the visible first-to-last span instead of a single visual chapter', async () => {
        const createNamedDoc = (
            name: string,
            rect: { left: number; right: number; top?: number; bottom?: number },
            extra?: { isVisible?: boolean; dispose?: () => Promise<void> },
        ) => ({
            load: vi.fn(async () => undefined),
            dispose: extra?.dispose ?? vi.fn(async () => undefined),
            getWrapperContainer: () => ({
                isVisible: extra?.isVisible ?? false,
                getBoundingClientRect: () => ({
                    left: rect.left,
                    top: rect.top ?? 0,
                    right: rect.right,
                    bottom: rect.bottom ?? 100,
                    width: rect.right - rect.left,
                    height: (rect.bottom ?? 100) - (rect.top ?? 0),
                }),
                clientWidth: Math.max(0, rect.right - rect.left),
            }),
            getContentContainer: () => undefined,
        })
        const file0 = createNamedDoc('file0', { left: 0, right: 400, top: 0, bottom: 200 }, { isVisible: true })
        const file1 = createNamedDoc('file1', { left: 0, right: 400, top: 200, bottom: 400 })
        const file2Dispose = vi.fn(async () => undefined)
        const file2 = createNamedDoc('file2', { left: 0, right: 400, top: 400, bottom: 600 }, { dispose: file2Dispose })
        const file3 = createNamedDoc('file3', { left: 0, right: 400, top: 600, bottom: 800 }, { isVisible: true })
        const file4 = createNamedDoc('file4', { left: 0, right: 400, top: 800, bottom: 1000 })
        const file5Dispose = vi.fn(async () => undefined)
        const file5 = createNamedDoc('file5', { left: 0, right: 400, top: 1000, bottom: 1200 }, { dispose: file5Dispose })
        const renderer = {
            clientWidth: 400,
            querySelector: () => ({ hasAttribute: () => false }),
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 400 }),
            ownerDocument: { defaultView: { innerWidth: 400, innerHeight: 400 } },
        }
        const options = new HtmlOptions()
        options.flipMode = 'scroll'
        options.writingMode = 'horizontal-tb'
        options.direction = 'ltr'
        options.preloadFileCount = 1
        const preloader = new HtmlDocumentsPreloader(
            new EventEmitter(),
            {
                owner: { context: { currentLocation: {} } },
                getRendererContainer: () => renderer,
                getScrollElement: () => renderer,
                getDocuments: () => [file0, file1, file2, file3, file4, file5],
                getVisibleDocuments: () => [file0, file3],
                getLoadedDocuments: () => [file0, file2, file5],
            } as never,
            () => undefined as never,
            options,
        )

        await preloader.preloadDocuments()
        expect(file0.load).toHaveBeenCalled()
        expect(file1.load).toHaveBeenCalled()
        expect(file2.load).toHaveBeenCalled()
        expect(file2Dispose).not.toHaveBeenCalled()
        expect(file5Dispose).toHaveBeenCalled()

        await preloader.dispose()
    })
})

describe('collectPreloadNeighbors', () => {
    it('puts previous chapters first when flipping backward', () => {
        expect(collectPreloadNeighbors(['a', 'b', 'c', 'd'], 2, 2, 1, true)).toEqual(['b', 'd'])
        expect(collectPreloadNeighbors(['a', 'b', 'c', 'd'], 2, 2, 1, false)).toEqual(['d', 'b'])
    })
})
