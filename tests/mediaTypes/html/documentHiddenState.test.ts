import { describe, expect, it } from 'vitest'
import {
    consumeDocumentHiddenRestore,
    DOCUMENT_HIDDEN_FLAG,
    DOCUMENT_REQUIRE_RESIZE_FLAG,
    isCollapsedSize,
    isHostContainerCollapsed,
    markDocumentHidden,
} from '@/mediaTypes/html/renderer/documents/documentHiddenState'

const createContainer = () => ({}) as HTMLElement

describe('isCollapsedSize', () => {
    it('treats zero width as hidden', () => {
        expect(isCollapsedSize(0, 400, false)).toBe(true)
    })

    it('ignores zero height unless requested', () => {
        expect(isCollapsedSize(400, 0, false)).toBe(false)
        expect(isCollapsedSize(400, 0, true)).toBe(true)
    })
})

describe('isHostContainerCollapsed', () => {
    it('returns false when the container is missing', () => {
        expect(isHostContainerCollapsed(undefined, true)).toBe(false)
    })

    it('reads clientWidth and clientHeight', () => {
        const container = { clientWidth: 0, clientHeight: 200 } as HTMLElement
        expect(isHostContainerCollapsed(container, false)).toBe(true)
    })
})

describe('document hidden flags', () => {
    it('skips restore after a hide/show cycle with no extra resize', () => {
        const container = createContainer()
        markDocumentHidden(container)
        expect(container[DOCUMENT_HIDDEN_FLAG]).toBe('true')
        expect(consumeDocumentHiddenRestore(container)).toBe(true)
        expect(container[DOCUMENT_HIDDEN_FLAG]).toBeUndefined()
        expect(container[DOCUMENT_REQUIRE_RESIZE_FLAG]).toBeUndefined()
    })

    it('requires a real resize when the container was resized while hidden', () => {
        const container = createContainer()
        markDocumentHidden(container)
        markDocumentHidden(container)
        expect(container[DOCUMENT_REQUIRE_RESIZE_FLAG]).toBe('true')
        expect(consumeDocumentHiddenRestore(container)).toBe(false)
        expect(container[DOCUMENT_HIDDEN_FLAG]).toBeUndefined()
        expect(container[DOCUMENT_REQUIRE_RESIZE_FLAG]).toBeUndefined()
    })

    it('does nothing when the container was not hidden', () => {
        const container = createContainer()
        expect(consumeDocumentHiddenRestore(container)).toBe(false)
    })
})
