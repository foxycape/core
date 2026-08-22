import type {
    ContentRange,
    FixedContentRange,
    ReflowableContentRange,
} from "../ContentRange";
import type { MarkStyleName, MarkType } from "./types";

/**
 * Persisted annotation mark.
 * Position is expressed by {@link contentRange} (reflowable / fixed / media).
 */
export type Mark = {
    markId: string;
    resourceId: string;
    type: MarkType;
    text: string;
    styleName: MarkStyleName;
    customColor?: string;
    /** Position source for restore / hit-test; format depends on media type */
    contentRange: ContentRange;
    /** Convenience page for fixed-layout marks; omit for reflowable / media */
    pageNumber?: number;
    /** Convenience spine/document URL for reflowable marks; omit for fixed / media */
    url?: string;
    createTime: string;
    updateTime: string;
};

export const buildMark = (
    resourceId: string,
    type: MarkType,
    text: string,
    styleName: MarkStyleName,
    contentRange: ContentRange,
    markId: string,
    customColor?: string,
    url?: string,
): Mark => {
    const now = new Date().toISOString();
    const pageNumber =
        contentRange.kind === "fixed"
            ? contentRange.geometries[0]?.pageNumber
            : undefined;
    return {
        markId,
        resourceId,
        type,
        text,
        styleName,
        customColor,
        contentRange,
        pageNumber,
        url,
        createTime: now,
        updateTime: now,
    };
};

export const getFixedContentRange = (mark: Mark): FixedContentRange | undefined => {
    const range = mark.contentRange as ContentRange | undefined;
    if (!range) {
        return undefined;
    }
    if (range.kind === "fixed") {
        return range;
    }
    const geometries = (range as { geometries?: FixedContentRange["geometries"] }).geometries;
    if (Array.isArray(geometries) && geometries.length > 0) {
        return { kind: "fixed", geometries };
    }
    return undefined;
};

/** Fill pageNumber on legacy PDF marks that only stored it inside geometries. */
export const hydrateLegacyMark = (mark: Mark): Mark => {
    if (mark.pageNumber == null) {
        const pageNumber = getFixedContentRange(mark)?.geometries[0]?.pageNumber;
        if (pageNumber != null) {
            mark.pageNumber = pageNumber;
        }
    }
    return mark;
};

/**
 * Resolve a mark-query url to a page number.
 * Pure digits ("3") and PDF spine urls ("3.pdf") map to pageNumber for old Dexie rows.
 */
export const parseMarkQueryPageNumber = (url: string): number | undefined => {
    const trimmed = url.trim();
    if (/^\d+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10);
    }
    const spine = /^(\d+)\.pdf$/i.exec(trimmed);
    if (spine) {
        return Number.parseInt(spine[1], 10);
    }
    return undefined;
};

export const markMatchesPageNumber = (mark: Mark, pageNumber: number): boolean =>
    mark.pageNumber === pageNumber ||
    (getFixedContentRange(mark)?.geometries.some((g) => g.pageNumber === pageNumber) ?? false);

export const getReflowableContentRange = (
    mark: Mark,
): ReflowableContentRange | undefined =>
    mark.contentRange.kind === "reflowable" ? mark.contentRange : undefined;
