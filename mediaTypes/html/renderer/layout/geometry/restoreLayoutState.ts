import { parseNumber } from "../../../../../kernal/common/number";
import { getTransformLength, scrollElementIntoView } from "../../../../../kernal/html/style";
import type {
    AlignWrapperInput,
    CapturedAnchorOffset,
    CapturedBlockScroll,
    CapturedExtent,
    CompensationAnchorEdge,
    CompensationRect,
    CompensationRectSource,
    InitialScroll,
    LayoutAxis,
    RestorePageTransformInput,
    RestoreScrollInput,
    ScrollLocateDeltaInput,
} from "./ILayoutGeometry";
import { fromLogicalScrollLeft, resolveScrollLeftSign, toLogicalScrollLeft } from "./scrollLeftAxis";

const USER_SCROLLED_THRESHOLD = 2;

const clampScroll = (value: number) => Math.max(0, value);

export const restorePageTransformAlongStart = ({
    currentTransform,
    sizeDelta,
    offsetDelta,
    isFirstVisible,
    foundElement,
}: RestorePageTransformInput) => {
    let next = currentTransform + sizeDelta;
    if (isFirstVisible && foundElement) {
        next = currentTransform + offsetDelta;
    }
    return Math.max(0, next);
};

export const restorePageTransformAlongEnd = ({
    currentTransform,
    sizeDelta,
    offsetDelta,
    isFirstVisible,
    foundElement,
}: RestorePageTransformInput) => {
    let next = currentTransform + sizeDelta;
    if (isFirstVisible && foundElement) {
        next = currentTransform - offsetDelta;
    }
    return Math.max(0, next);
};

export const restoreScrollAlongStart = ({
    liveScroll,
    capturedScroll,
    sizeDelta,
    offsetDelta,
    foundElement,
    currentIndex,
    anchorIndex,
}: RestoreScrollInput) => {
    if (currentIndex < 0 || anchorIndex < 0 || currentIndex > anchorIndex) {
        return liveScroll;
    }
    if (currentIndex === anchorIndex) {
        if (foundElement) {
            return clampScroll(liveScroll + offsetDelta);
        }
        return liveScroll;
    }
    if (Math.abs(liveScroll - capturedScroll) > USER_SCROLLED_THRESHOLD) {
        return liveScroll;
    }
    return clampScroll(capturedScroll + sizeDelta);
};

/** horizontal-tb: preceding chapter adds sizeDelta; the anchor chapter keeps live scroll unless an element anchor exists. */
export const restoreScrollCapturedPlusSize = ({
    liveScroll,
    capturedScroll,
    sizeDelta,
    offsetDelta,
    foundElement,
    currentIndex,
    anchorIndex,
}: RestoreScrollInput) => {
    if (currentIndex < 0 || anchorIndex < 0 || currentIndex > anchorIndex) {
        return liveScroll;
    }
    if (currentIndex === anchorIndex) {
        if (foundElement) {
            return clampScroll(capturedScroll + offsetDelta);
        }
        return liveScroll;
    }
    return clampScroll(capturedScroll + sizeDelta);
};

export const restoreScrollAlongEnd = ({
    liveScroll,
    capturedScroll,
    sizeDelta,
    offsetDelta,
    foundElement,
    currentIndex,
    anchorIndex,
}: RestoreScrollInput) => {
    if (currentIndex < 0 || anchorIndex < 0 || currentIndex > anchorIndex) {
        return liveScroll;
    }
    if (currentIndex < anchorIndex) {
        return clampScroll(liveScroll + sizeDelta);
    }
    if (foundElement) {
        return clampScroll(liveScroll + offsetDelta);
    }
    if (Math.abs(liveScroll - capturedScroll) > USER_SCROLLED_THRESHOLD) {
        return liveScroll;
    }
    return clampScroll(liveScroll + sizeDelta);
};

/**
 * scroll-vertical-rl-ltr: row-reverse inside a left-anchored max-content strip.
 * A later chapter (higher index, on the left) shifts every chapter to its right,
 * so scrollLeft must follow that width delta. An earlier chapter only extends
 * the far right edge. The anchor chapter's own growth follows scroll only while
 * the viewport is still pinned to the reading start (the right edge).
 */
export const restoreScrollAlongLeftAnchoredReverse = ({
    liveScroll,
    capturedScroll,
    sizeDelta,
    offsetDelta,
    foundElement,
    currentIndex,
    anchorIndex,
    atReadingStart,
}: RestoreScrollInput) => {
    if (currentIndex < 0 || anchorIndex < 0) {
        return liveScroll;
    }
    if (currentIndex > anchorIndex) {
        return clampScroll(liveScroll + sizeDelta);
    }
    if (currentIndex < anchorIndex) {
        return liveScroll;
    }
    if (foundElement) {
        return clampScroll(liveScroll + offsetDelta);
    }
    if (Math.abs(liveScroll - capturedScroll) > USER_SCROLLED_THRESHOLD) {
        return liveScroll;
    }
    if (!atReadingStart) {
        return liveScroll;
    }
    return clampScroll(liveScroll + sizeDelta);
};

export const passthroughRestoreScroll = ({ liveScroll }: RestoreScrollInput) => liveScroll;

const readLogicalScrollAlong = (scrollElement: HTMLElement, raw: number, axis: LayoutAxis) => {
    if (axis === "y") {
        return raw;
    }
    return toLogicalScrollLeft(raw, resolveScrollLeftSign(scrollElement));
};

export const readLogicalScrollAlongX = (scrollElement: HTMLElement) =>
    readLogicalScrollAlong(scrollElement, scrollElement.scrollLeft, "x");

export const readLogicalScrollAlongY = (scrollElement: HTMLElement) =>
    scrollElement.scrollTop;

export const readCapturedLogicalScrollAlongX = (
    scrollElement: HTMLElement,
    captured: CapturedBlockScroll,
) => readLogicalScrollAlong(scrollElement, captured.scrollLeft, "x");

export const readCapturedLogicalScrollAlongY = (
    _scrollElement: HTMLElement,
    captured: CapturedBlockScroll,
) => captured.scrollTop;

export const writeLogicalScrollAlongX = (scrollElement: HTMLElement, logical: number) => {
    const raw = fromLogicalScrollLeft(logical, resolveScrollLeftSign(scrollElement));
    scrollElement.scrollTo({ left: raw, top: scrollElement.scrollTop });
};

export const writeLogicalScrollAlongY = (scrollElement: HTMLElement, logical: number) => {
    scrollElement.scrollTo({ left: scrollElement.scrollLeft, top: logical });
};

export const measureBlockSizeDeltaAlongX = (
    wrapper: HTMLElement | null | undefined,
    captured: CapturedExtent,
) => (wrapper?.scrollWidth ?? 0) - captured.width;

export const measureBlockSizeDeltaAlongY = (
    wrapper: HTMLElement | null | undefined,
    captured: CapturedExtent,
) => (wrapper?.offsetHeight ?? 0) - captured.height;

export const measurePageSizeDeltaAlongX = (
    wrapper: HTMLElement | null | undefined,
    captured: CapturedExtent,
) => (wrapper?.scrollWidth ?? 0) - captured.width;

/** Horizontal page strips shift by the flex item's border box, not overflow scrollWidth. */
export const measurePageBoxDeltaAlongX = (
    wrapper: HTMLElement | null | undefined,
    captured: CapturedExtent,
) => (wrapper?.offsetWidth ?? 0) - captured.width;

export const measurePageSizeDeltaAlongY = (
    wrapper: HTMLElement | null | undefined,
    captured: CapturedExtent,
) => (wrapper?.scrollHeight ?? 0) - captured.height;

export const measureOffsetDeltaAlongX = (anchor: HTMLElement, captured: CapturedAnchorOffset) =>
    anchor.offsetLeft - captured.offsetLeft;

export const measureOffsetDeltaAlongY = (anchor: HTMLElement, captured: CapturedAnchorOffset) =>
    anchor.offsetTop - captured.offsetTop;

const readPageTransformAlong = (transformContainer: HTMLElement, axis: LayoutAxis) => {
    const targetTransform = transformContainer.getAttribute("data-target-transform");
    if (targetTransform) {
        return parseNumber(targetTransform, 0, "parseFloat");
    }
    return getTransformLength(transformContainer, axis);
};

export const readPageTransformAlongX = (transformContainer: HTMLElement) =>
    readPageTransformAlong(transformContainer, "x");

export const readPageTransformAlongY = (transformContainer: HTMLElement) =>
    readPageTransformAlong(transformContainer, "y");

export type ScrollLocateDeltaWithEdgeInput = ScrollLocateDeltaInput & {
    initialScroll: InitialScroll;
};

export const getScrollLocateDeltaAlongStart = ({
    targetStart,
    viewportStart,
}: ScrollLocateDeltaInput) => targetStart - viewportStart;

export const getScrollLocateDeltaAlongEnd = ({
    targetEnd,
    viewportEnd,
}: ScrollLocateDeltaInput) => targetEnd - viewportEnd;

export const getScrollLocateDelta = ({
    targetStart,
    viewportStart,
    targetEnd,
    viewportEnd,
    initialScroll,
}: ScrollLocateDeltaWithEdgeInput) => {
    if (initialScroll === "end") {
        return getScrollLocateDeltaAlongEnd({ targetStart, viewportStart, targetEnd, viewportEnd });
    }
    return getScrollLocateDeltaAlongStart({ targetStart, viewportStart, targetEnd, viewportEnd });
};

export const compensationRectAlongY = (rect: CompensationRectSource): CompensationRect => ({
    start: rect.top,
    end: rect.bottom,
});

export const compensationRectAlongX = (rect: CompensationRectSource): CompensationRect => ({
    start: rect.left,
    end: rect.right,
});

export const alwaysApplyRestoredScroll = (_nextScroll: number, _liveScroll: number) => true;

export const rejectPinnedStartScroll = (nextScroll: number, liveScroll: number) =>
    !(nextScroll <= 1 && liveScroll > 8);

export const alignWrapperNative = ({
    wrapper,
    rootDocument,
}: AlignWrapperInput) => {
    scrollElementIntoView(wrapper, undefined, undefined, rootDocument);
};

export const alignWrapperToVisualEnd = ({
    wrapper,
    scrollElement,
}: AlignWrapperInput) => {
    const wrapperRect = wrapper.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    scrollElement.scrollBy(wrapperRect.right - scrollRect.right, 0);
};

export const alignWrapperPassthrough = (_input: AlignWrapperInput) => {};

export const READING_START_SCROLL_THRESHOLD = 8;

export type ReadingStartScrollInput = {
    liveScroll: number;
    scrollExtent: number;
    clientLength: number;
    initialScroll: InitialScroll;
};

export const pinReadingStartScroll = ({
    scrollExtent,
    clientLength,
    initialScroll,
}: Omit<ReadingStartScrollInput, "liveScroll">) => {
    if (initialScroll === "end") {
        return Math.max(0, scrollExtent - clientLength);
    }
    return 0;
};

export const isAtReadingStartScroll = ({
    liveScroll,
    scrollExtent,
    clientLength,
    initialScroll,
}: ReadingStartScrollInput) => {
    const pin = pinReadingStartScroll({ scrollExtent, clientLength, initialScroll });
    return Math.abs(liveScroll - pin) <= READING_START_SCROLL_THRESHOLD;
};

export type CompensationDocumentRect = CompensationRect;

export const pickVisibleCompensationDocument = <T>(
    visible: readonly T[],
    edge: CompensationAnchorEdge,
    getRect?: (item: T) => CompensationDocumentRect | undefined,
): T | undefined => {
    if (visible.length === 0) {
        return undefined;
    }
    if (getRect) {
        let picked: T | undefined;
        let best = edge === "end" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
        let hasRect = false;
        for (const item of visible) {
            const rect = getRect(item);
            if (!rect) {
                continue;
            }
            hasRect = true;
            if (edge === "end") {
                if (rect.end > best) {
                    best = rect.end;
                    picked = item;
                }
            }
            else if (rect.start < best) {
                best = rect.start;
                picked = item;
            }
        }
        if (hasRect) {
            return picked;
        }
    }
    return edge === "end" ? visible[visible.length - 1] : visible[0];
};
