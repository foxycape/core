import { describe, expect, it } from "vitest"
import { mergeOverlayRects } from "@/kernal/mark/overlay"

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
