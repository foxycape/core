/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest"
import { dropContainingRects, mergeOverlayRects, rangeTextClientRects } from "@/kernal/mark/overlay"

const rect = (width: number, height: number): DOMRect =>
    ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) })

const asClientRects = (rects: DOMRect[]): DOMRectList =>
    Object.assign(rects, { item: (index: number) => rects[index] ?? null }) as unknown as DOMRectList

describe("mergeOverlayRects", () => {
    it("drops empty boxes", () => {
        expect(mergeOverlayRects([{ x: 0, y: 0, width: 0, height: 10 }])).toEqual([])
    })

    it("merges adjacent boxes on the same line", () => {
        const merged = mergeOverlayRects([
            { x: 0, y: 10, width: 20, height: 12 },
            { x: 20, y: 10, width: 18, height: 12 },
        ])
        expect(merged).toEqual([{ x: 0, y: 10, width: 38, height: 12 }])
    })

    it("keeps boxes on different lines", () => {
        const merged = mergeOverlayRects([
            { x: 0, y: 10, width: 20, height: 12 },
            { x: 0, y: 28, width: 20, height: 12 },
        ])
        expect(merged).toHaveLength(2)
    })

    it("merges adjacent boxes in the same vertical column", () => {
        const merged = mergeOverlayRects(
            [
                { x: 40, y: 0, width: 14, height: 20 },
                { x: 40, y: 20, width: 14, height: 18 },
            ],
            1,
            "vertical",
        )
        expect(merged).toEqual([{ x: 40, y: 0, width: 14, height: 38 }])
    })

    it("keeps boxes in different vertical columns", () => {
        const merged = mergeOverlayRects(
            [
                { x: 40, y: 0, width: 14, height: 20 },
                { x: 20, y: 0, width: 14, height: 20 },
            ],
            1,
            "vertical",
        )
        expect(merged).toHaveLength(2)
    })
})

describe("dropContainingRects", () => {
    it("returns a single rect unchanged", () => {
        const only = { x: 8, y: 10, width: 120, height: 16 }
        expect(dropContainingRects([only])).toEqual([only])
    })

    it("keeps line boxes when there is no containing block", () => {
        const lines = [
            { x: 8, y: 10, width: 200, height: 16 },
            { x: 8, y: 30, width: 160, height: 16 },
        ]
        expect(dropContainingRects(lines)).toEqual(lines)
    })

    it("drops a taller paragraph box around two line boxes", () => {
        const line1 = { x: 12, y: 14, width: 220, height: 16 }
        const line2 = { x: 12, y: 34, width: 180, height: 16 }
        const paragraph = { x: 8, y: 8, width: 240, height: 52 }
        expect(dropContainingRects([paragraph, line1, line2])).toEqual([line1, line2])
    })

    it("keeps a line box that wraps a same-height inline span", () => {
        const line = { x: 0, y: 10, width: 200, height: 16 }
        const span = { x: 40, y: 10, width: 60, height: 16 }
        expect(dropContainingRects([line, span])).toEqual([line, span])
    })

    it("drops a wider containing box in vertical writing", () => {
        const line1 = { x: 40, y: 8, width: 16, height: 180 }
        const line2 = { x: 20, y: 8, width: 16, height: 140 }
        const paragraph = { x: 16, y: 4, width: 48, height: 200 }
        expect(dropContainingRects([paragraph, line1, line2], "vertical")).toEqual([line1, line2])
    })

    it("cannot drop a same-height one-line paragraph box (use rangeTextClientRects)", () => {
        const line = { x: 12, y: 10, width: 80, height: 16 }
        const paragraph = { x: 8, y: 10, width: 240, height: 16 }
        expect(dropContainingRects([paragraph, line])).toEqual([paragraph, line])
    })
})

describe("rangeTextClientRects", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("collects only text-node boxes across a three-paragraph range", () => {
        const root = document.createElement("div")
        root.innerHTML = "<p>first</p><p>mid</p><p>last</p>"
        document.body.appendChild(root)
        const [first, middle, last] = Array.from(root.querySelectorAll("p"))
        const range = document.createRange()
        range.setStart(first.firstChild as Text, 0)
        range.setEnd(last.firstChild as Text, 4)

        vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (this: Range) {
            if (this.startContainer.nodeType === Node.TEXT_NODE && this.endContainer.nodeType === Node.TEXT_NODE) {
                const text = (this.startContainer as Text).data.slice(this.startOffset, this.endOffset)
                return asClientRects([rect(text.length * 10, 16)])
            }
            return asClientRects([rect(400, 80)])
        })

        const rects = rangeTextClientRects(range)
        expect(rects.map((item) => item.width)).toEqual([50, 30, 40])
        expect(rects.every((item) => item.height === 16)).toBe(true)
        expect(middle.textContent).toBe("mid")
        root.remove()
    })

    it("returns the original boxes when the range stays inside one text node", () => {
        const root = document.createElement("div")
        root.appendChild(document.createTextNode("hello"))
        document.body.appendChild(root)
        const range = document.createRange()
        range.setStart(root.firstChild as Text, 1)
        range.setEnd(root.firstChild as Text, 4)
        vi.spyOn(Range.prototype, "getClientRects").mockReturnValue(asClientRects([rect(30, 16)]))
        const rects = rangeTextClientRects(range)
        expect(rects).toHaveLength(1)
        expect(rects[0].width).toBe(30)
        expect(rects[0].height).toBe(16)
        root.remove()
    })
})
