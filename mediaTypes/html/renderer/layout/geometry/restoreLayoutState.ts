import { scrollElementIntoView } from "../../../../../kernal/html/style";
import type {
    AlignWrapperInput,
    CompensationAnchorEdge,
    CompensationRect,
    CompensationRectSource,
    InitialScroll,
    RestorePageTransformInput,
    RestoreScrollInput,
    ScrollLocateDeltaInput,
} from "./ILayoutGeometry";

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

/** horizontal-tb (pre-geometry): captured + sizeDelta, or captured + offsetDelta on the first-visible element. */
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
    if (currentIndex === anchorIndex && foundElement) {
        return clampScroll(capturedScroll + offsetDelta);
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
 * the far right edge. The anchor chapter is right-aligned, so its own growth
 * moves the visible text unless the user has already scrolled.
 */
export const restoreScrollAlongLeftAnchoredReverse = ({
    liveScroll,
    capturedScroll,
    sizeDelta,
    offsetDelta,
    foundElement,
    currentIndex,
    anchorIndex,
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
    return clampScroll(liveScroll + sizeDelta);
};

export const passthroughRestoreScroll = ({ liveScroll }: RestoreScrollInput) => liveScroll;

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

export type AbsoluteCompensationUrlInput = {
    direction?: string;
    currentLocationUrl?: string;
    redirectingDocUrl?: string;
    holdAbsoluteAnchor: boolean;
};

export const pickAbsoluteCompensationUrl = ({
    direction,
    currentLocationUrl,
    redirectingDocUrl,
    holdAbsoluteAnchor,
}: AbsoluteCompensationUrlInput) => {
    if (direction === "next" || direction === "previous") {
        return undefined;
    }
    if (holdAbsoluteAnchor) {
        return currentLocationUrl || redirectingDocUrl;
    }
    return undefined;
};

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

/** The document changing size is not the reading anchor if another chapter is visible. */
export const excludeResizingCompensationDocument = <T>(
    visible: readonly T[],
    resizing?: T,
) => (resizing ? visible.filter((item) => item !== resizing) : [...visible]);

export const resolveRestoreCompensationAnchor = <T>(
    captured: T | undefined,
    liveHold: T | undefined,
    useLiveHold: boolean,
) => (useLiveHold ? liveHold ?? captured : captured);
