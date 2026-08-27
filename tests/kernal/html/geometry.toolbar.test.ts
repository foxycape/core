import { describe, expect, it } from "vitest"
import {
    calcToolbarPositionFromRect,
    resolveVisibleBaseRectInContainer,
    type Rect,
} from "@/kernal/html/geometry"

const rect = (left: number, top: number, width: number, height: number): Rect => ({
    left,
    top,
    width,
    height,
})

const fakeToolbar = (width: number, height: number): Element =>
    ({
        getBoundingClientRect: () => ({
            width,
            height,
            left: 0,
            top: 0,
            right: width,
            bottom: height,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }),
    }) as Element

describe("calcToolbarPositionFromRect", () => {
    const container = rect(100, 40, 800, 600)

    it("keeps a large panel beside an edge-flush highlight instead of at the origin", () => {
        const highlight = rect(100, 300, 36, 18)
        const pos = calcToolbarPositionFromRect(
            container,
            highlight,
            fakeToolbar(320, 220),
            "bottom",
        )
        expect(pos.visible).toBe(true)
        expect(pos.left).toBeGreaterThanOrEqual(container.left)
        expect(pos.left + 320).toBeLessThanOrEqual(container.left + container.width)
        expect(pos.top).toBeGreaterThan(highlight.top - 1)
        expect(pos.left).toBeGreaterThan(90)
        expect(pos.top).not.toBe(0)
        expect(pos.left).not.toBe(0)
    })

    it("clamps a right-edge highlight so a wide panel stays inside the container", () => {
        const highlight = rect(860, 280, 32, 18)
        const pos = calcToolbarPositionFromRect(
            container,
            highlight,
            fakeToolbar(320, 220),
            "bottom",
        )
        expect(pos.visible).toBe(true)
        expect(pos.left).toBeGreaterThanOrEqual(container.left + 5)
        expect(pos.left + 320).toBeLessThanOrEqual(container.left + container.width - 5)
        expect(pos.top).toBeGreaterThan(highlight.top)
    })

    it("clamps vertical position when the panel is taller than remaining space", () => {
        const highlight = rect(400, 500, 40, 18)
        const pos = calcToolbarPositionFromRect(
            container,
            highlight,
            fakeToolbar(320, 520),
            "bottom",
        )
        expect(pos.visible).toBe(true)
        expect(pos.top).toBeGreaterThanOrEqual(container.top + 5)
        expect(pos.top + 520).toBeLessThanOrEqual(container.top + container.height - 5)
        expect(pos.top).not.toBe(0)
    })

    it("hides when the toolbar has not been laid out yet", () => {
        const pos = calcToolbarPositionFromRect(
            container,
            rect(400, 200, 40, 18),
            fakeToolbar(0, 0),
        )
        expect(pos.visible).toBe(false)
    })
})

describe("resolveVisibleBaseRectInContainer", () => {
    const container = rect(0, 0, 800, 600)

    it("clips a highlight that is 1px past the container edge", () => {
        const edge = resolveVisibleBaseRectInContainer(
            [rect(780, 240, 24, 16)],
            container,
        )
        expect(edge).toEqual(rect(780, 240, 20, 16))
    })

    it("uses the largest fragment when boxes sit in different columns", () => {
        const leftCol = rect(8, 40, 40, 16)
        const rightCol = rect(760, 40, 36, 16)
        const picked = resolveVisibleBaseRectInContainer([leftCol, rightCol], container)
        expect(picked).toEqual(leftCol)
    })

    it("still merges stacked lines in the same column", () => {
        const line1 = rect(120, 80, 200, 18)
        const line2 = rect(120, 100, 180, 18)
        const picked = resolveVisibleBaseRectInContainer([line1, line2], container)
        expect(picked).toEqual(rect(120, 80, 200, 38))
    })
})
