import { describe, expect, it } from "vitest"
import type { ReflowableContentRange } from "@/kernal/ContentRange"
import {
    getLatestNote,
    getNotes,
    markMatchesKeyword,
    removeNote,
    upsertNote,
    type Mark,
} from "@/kernal/mark/Mark"

const contentRange: ReflowableContentRange = {
    kind: "reflowable",
    start: { tagName: "p", tagIndex: 0, textOffset: 0 },
    end: { tagName: "p", tagIndex: 0, textOffset: 4 },
}

const createMark = (overrides: Partial<Mark> = {}): Mark => ({
    markId: "mark-1",
    resourceId: "book-1",
    type: "drawline",
    text: "hello",
    styleName: "mark_pen",
    contentRange,
    createTime: "2026-01-01T00:00:00.000Z",
    updateTime: "2026-01-01T00:00:00.000Z",
    ...overrides,
})

describe("mark notes", () => {
    it("upserts a new note when id is omitted", () => {
        const mark = createMark()
        const note = upsertNote(mark, { content: "first" })
        expect(note.id).toBeTruthy()
        expect(note.content).toBe("first")
        expect(getNotes(mark)).toHaveLength(1)
        expect(getNotes(mark)[0].id).toBe(note.id)
    })

    it("updates an existing note by id without adding another", () => {
        const mark = createMark()
        const created = upsertNote(mark, { content: "first" })
        const updated = upsertNote(mark, { id: created.id, content: "edited" })
        expect(updated.id).toBe(created.id)
        expect(getNotes(mark)).toHaveLength(1)
        expect(getNotes(mark)[0].content).toBe("edited")
        expect(getNotes(mark)[0].updateTime >= created.updateTime).toBe(true)
    })

    it("removes a note and drops the field when empty", () => {
        const mark = createMark()
        const first = upsertNote(mark, { content: "a" })
        const second = upsertNote(mark, { content: "b" })
        removeNote(mark, first.id)
        expect(getNotes(mark).map((note) => note.id)).toEqual([second.id])
        removeNote(mark, second.id)
        expect(mark.notes).toBeUndefined()
    })

    it("returns the most recently updated note", () => {
        const mark = createMark({
            notes: [
                {
                    id: "old",
                    content: "older",
                    createTime: "2026-01-01T00:00:00.000Z",
                    updateTime: "2026-01-01T00:00:00.000Z",
                },
                {
                    id: "new",
                    content: "newer",
                    createTime: "2026-01-02T00:00:00.000Z",
                    updateTime: "2026-01-03T00:00:00.000Z",
                },
            ],
        })
        expect(getLatestNote(mark)?.id).toBe("new")
    })

    it("matches keywords against any note content", () => {
        const mark = createMark({
            text: "unrelated",
            notes: [
                {
                    id: "n1",
                    content: "alpha",
                    createTime: "2026-01-01T00:00:00.000Z",
                    updateTime: "2026-01-01T00:00:00.000Z",
                },
                {
                    id: "n2",
                    content: "contains HELLO",
                    createTime: "2026-01-01T00:00:00.000Z",
                    updateTime: "2026-01-01T00:00:00.000Z",
                },
            ],
        })
        expect(markMatchesKeyword(mark, "hello")).toBe(true)
        expect(markMatchesKeyword(mark, "zzzz")).toBe(false)
    })
})
