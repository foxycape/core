import type { FlipMode, WritingMode } from "../types";
import type { Rect } from "../common/geometry";
import { findLastNode } from "./finder";
import { createRange, getTextOffsetInElement } from "./selection";

export type EdgeRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type OrderedIntersectOptions = {
    writingMode?: WritingMode;
    fullVisible?: boolean;
    /** Stop after this many consecutive misses past the viewport (default 8). */
    missStreakToStop?: number;
};

/** Element or a live Range — iframe-safe, do not use `instanceof Range`. */
export type LocateTarget = Element | Range;

export const isDomRange = (value: unknown): value is Range =>
    !!value
    && typeof value === "object"
    && !("tagName" in (value as object))
    && "commonAncestorContainer" in (value as object);

export const getFirstClientRect = (range: Range): DOMRect => {
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.height > 0 || rect.width > 0) {
            return rect;
        }
    }
    return range.getBoundingClientRect();
};

export const getLocateClientRect = (target: LocateTarget): DOMRect => {
    if (isDomRange(target)) {
        return getFirstClientRect(target);
    }
    return target.getBoundingClientRect();
};

export const getLocateElement = (target: LocateTarget): Element | null => {
    if (!isDomRange(target)) {
        return target;
    }
    const node = target.startContainer;
    if (node.nodeType === Node.ELEMENT_NODE) {
        return node as Element;
    }
    return node.parentElement;
};

export const getBaseState = (base: Range | Element[] | Element) => {
    let baseDocument: Document;
    let baseWindow: Window;
    let baseBoundingRect: { left: number, top: number, width: number, height: number, right: number, bottom: number };
    let baseRects: { left: number, top: number, width: number, height: number, right: number, bottom: number }[] = [];
    let firstBaseNode: Node;
    let lastBaseNode: Node;
    let baseType: 'elements' | 'element' | 'range'
    if (Array.isArray(base)) {
        baseType = 'elements';
        firstBaseNode = base[0];
        lastBaseNode = base[base.length - 1];
        baseDocument = firstBaseNode.ownerDocument;
        baseWindow = baseDocument.defaultView
        if (base.length > 1) {
            const range = baseWindow.document.createRange();
            range.setStart(firstBaseNode, 0)
            const endElement = base[base.length - 1];
            const lastNode = findLastNode(endElement);
            if (lastNode.nodeType == Node.TEXT_NODE) {
                range.setEnd(lastNode, lastNode.textContent.length)
            }
            else {
                range.setEnd(lastNode, 0)
            }
            const rangeBoundingRect = range.getBoundingClientRect();
            baseBoundingRect = { left: rangeBoundingRect.left, top: rangeBoundingRect.top, width: rangeBoundingRect.width, height: rangeBoundingRect.height, right: rangeBoundingRect.right, bottom: rangeBoundingRect.bottom };
            for (const el of base) {
                const rects = el.getClientRects();
                baseRects.push(...Array.from(rects).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom })));
            }
        }
        else {
            baseBoundingRect = base[0].getBoundingClientRect();
            baseRects = Array.from(base[0].getClientRects()).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
        }
    }
    else if (Object.prototype.hasOwnProperty.call(base, "tagName") || (base as any).tagName) {
        baseType = 'element';
        firstBaseNode = (base as Element)
        lastBaseNode = firstBaseNode;
        baseDocument = firstBaseNode.ownerDocument;
        baseWindow = baseDocument.defaultView;
        baseBoundingRect = (base as Element).getBoundingClientRect();
        baseRects = Array.from((base as Element).getClientRects()).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
    }
    else {
        baseType = 'range';
        firstBaseNode = (base as Range).startContainer;
        lastBaseNode = (base as Range).endContainer;
        baseDocument = firstBaseNode.ownerDocument;
        baseWindow = baseDocument.defaultView;
        baseBoundingRect = (base as Range).getBoundingClientRect();
        baseRects = Array.from((base as Range).getClientRects()).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
    }
    return {
        firstBaseNode,
        lastBaseNode,
        baseWindow,
        baseDocument,
        baseBoundingRect,
        baseType,
        baseRects
    }
};

export const hiddenToolbarPosition = { left: -100000, top: -100000, visible: false };

/**
 * Convert a pointer/mouse event into the viewport of `displayElement`.
 * Walks iframe parents the same way as selection-rect normalization.
 * Uses clientX/Y (not pageX/Y) so the result matches `position: fixed` toolbars.
 */
export const calcCursorPosition = (
    e: PointerEvent | MouseEvent,
    displayElement: Element
): { left: number; top: number; visible: boolean } => {
    const baseElement = e.target as Element | null;
    const baseDocument = baseElement?.ownerDocument;
    if (!baseDocument) {
        return hiddenToolbarPosition;
    }
    let baseWindow = baseDocument.defaultView;
    let left = e.clientX;
    let top = e.clientY;
    const displayWindow = displayElement.ownerDocument.defaultView;
    while (displayWindow != baseWindow) {
        const frameElement = baseWindow?.frameElement;
        const parent = frameElement?.ownerDocument?.defaultView;
        if (!parent) {
            break;
        }
        baseWindow = parent;
        const frameElementRect = frameElement.getBoundingClientRect();
        left += frameElementRect.left;
        top += frameElementRect.top;
    }
    if (displayWindow != baseWindow) {
        return hiddenToolbarPosition;
    }
    return { left, top, visible: true };
};

const isCompletelyVisible = (parent: Rect, child: Rect): boolean => {
    const parentRight = parent.left + parent.width;
    const parentBottom = parent.top + parent.height;
    const childRight = child.left + child.width;
    const childBottom = child.top + child.height;
    return (
        child.left >= parent.left &&
        child.top >= parent.top &&
        childRight <= parentRight &&
        childBottom <= parentBottom
    );
};

/** Intersection of a rect with the container's visible area; returns null if none */
export const intersectWithContainer = (container: Rect, rect: Rect): Rect | null => {
    const cRight = container.left + container.width;
    const cBottom = container.top + container.height;
    const rRight = rect.left + rect.width;
    const rBottom = rect.top + rect.height;
    const left = Math.max(container.left, rect.left);
    const top = Math.max(container.top, rect.top);
    const right = Math.min(cRight, rRight);
    const bottom = Math.min(cBottom, rBottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0)
        return null;
    return { left, top, width, height };
};

const mergeRects = (rects: Rect[]): Rect => {
    return rects.reduce((acc, rect) => {
        const left = Math.min(acc.left, rect.left);
        const top = Math.min(acc.top, rect.top);
        const right = Math.max(acc.left + acc.width, rect.left + rect.width);
        const bottom = Math.max(acc.top + acc.height, rect.top + rect.height);
        return {
            left,
            top,
            width: right - left,
            height: bottom - top
        };
    });
};

/** Convert selection client rects into the viewport coordinates of displayElement's window */
export const normalizeBaseRectsInDisplayWindow = (base: Range | Element[] | Element, displayWindow: Window): { normalizedRects: Rect[]; inSameWindow: boolean } | null => {
    let { baseWindow, baseRects } = getBaseState(base);
    const normalizedRects = baseRects.map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }));

    while (displayWindow != baseWindow) {
        const frameElement = baseWindow.frameElement;
        const parent = frameElement?.ownerDocument?.defaultView
        if (!parent)
            break;
        baseWindow = parent
        const frameElementRect = frameElement.getBoundingClientRect();
        normalizedRects.forEach(rect => {
            rect.left += frameElementRect.left;
            rect.top += frameElementRect.top;
        });
    }

    if (displayWindow != baseWindow)
        return { normalizedRects: [], inSameWindow: false };

    return { normalizedRects, inSameWindow: true };
};

const rectArea = (rect: Rect): number => rect.width * rect.height;

const largestRect = (rects: Rect[]): Rect => {
    let best = rects[0];
    let bestArea = rectArea(best);
    for (let i = 1; i < rects.length; i++) {
        const area = rectArea(rects[i]);
        if (area > bestArea) {
            best = rects[i];
            bestArea = area;
        }
    }
    return best;
};

/**
 * Merge same-column fragments, but keep the largest fragment when boxes sit in
 * different columns (union would span the whole page).
 */
const mergeVisibleFragments = (rects: Rect[]): Rect => {
    if (rects.length === 1) {
        return rects[0];
    }
    const merged = mergeRects(rects);
    const maxWidth = Math.max(...rects.map((rect) => rect.width));
    if (merged.width > maxWidth * 2 + 24) {
        return largestRect(rects);
    }
    return merged;
};

/** Resolve a valid positioning rect for the selection within the container */
export const resolveVisibleBaseRectInContainer = (normalizedRects: Rect[], containerRect: Rect, allowPartialVisibility = true): Rect | null => {
    const usableRects = normalizedRects.filter((rect) => rect.width >= 1 && rect.height >= 1);
    const visibleBaseRects = usableRects.filter(rect => isCompletelyVisible(containerRect, rect));
    if (visibleBaseRects.length > 0)
        return mergeVisibleFragments(visibleBaseRects);

    if (!allowPartialVisibility)
        return null;

    const minVisibleArea = 4;
    const partials: { clipped: Rect; origArea: number }[] = [];
    for (const rect of usableRects) {
        const clipped = intersectWithContainer(containerRect, rect);
        if (!clipped)
            continue;
        const visArea = clipped.width * clipped.height;
        if (visArea < minVisibleArea)
            continue;
        partials.push({ clipped, origArea: rect.width * rect.height });
    }
    if (partials.length === 0)
        return null;

    partials.sort((a, b) => {
        const da = a.clipped.width * a.clipped.height;
        const db = b.clipped.width * b.clipped.height;
        if (db !== da)
            return db - da;
        return b.origArea - a.origArea;
    });
    return partials[0].clipped;
};

export const toRect = (rect: { left: number; top: number; width: number; height: number }): Rect => ({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
});

export const applyContainerInset = (containerRect: Rect, inset?: { top?: number; bottom?: number; left?: number; right?: number }): Rect => {
    if (!inset)
        return containerRect;
    return {
        left: containerRect.left + (inset.left ?? 0),
        top: containerRect.top + (inset.top ?? 0),
        width: containerRect.width - (inset.left ?? 0) - (inset.right ?? 0),
        height: containerRect.height - (inset.top ?? 0) - (inset.bottom ?? 0)
    };
};

export type ToolbarPreferPosition = "top" | "bottom" | "right";

const clamp = (value: number, min: number, max: number): number =>
    max < min ? min : Math.min(Math.max(value, min), max);

/**
 * Compute toolbar left/top from a base rect and container.
 * @param containerRect Container rect
 * @param baseRect Base rect
 * @param displayElement Display element
 * @param toolbarPreferPosition Preferred toolbar position
 * @param bias Offset bias
 * @returns \{ left: number; top: number; visible: boolean \}
 */
export const calcToolbarPositionFromRect = (
    containerRect: Rect,
    baseRect: Rect,
    displayElement: Element,
    toolbarPreferPosition: ToolbarPreferPosition = "bottom",
    bias = 5
): { left: number; top: number; visible: boolean } => {
    const displayElementRect = displayElement.getBoundingClientRect();
    const toolbarWidth = displayElementRect.width;
    const toolbarHeight = displayElementRect.height;
    if (toolbarWidth < 1 || toolbarHeight < 1) {
        return hiddenToolbarPosition;
    }
    const selectionRight = baseRect.left + baseRect.width;
    const selectionBottom = baseRect.top + baseRect.height;
    const containerBottom = containerRect.top + containerRect.height;
    const spaceBelow = containerBottom - selectionBottom;
    const spaceAbove = baseRect.top - containerRect.top;
    const spaceRequired = toolbarHeight + bias;
    const containerLeft = containerRect.left;
    const containerRight = containerRect.left + containerRect.width;
    const containerTop = containerRect.top;
    const minLeft = containerLeft + bias;
    const maxLeft = containerRight - toolbarWidth - bias;
    const minTop = containerTop + bias;
    const maxTop = containerBottom - toolbarHeight - bias;

    if (toolbarPreferPosition === "right") {
        const left = clamp(selectionRight + bias, minLeft, maxLeft);
        const centerY = baseRect.top + baseRect.height / 2;
        const top = clamp(centerY - toolbarHeight / 2, minTop, maxTop);
        return { left, top, visible: true };
    }

    const centerX = baseRect.left + baseRect.width / 2;
    const left = clamp(centerX - toolbarWidth / 2, minLeft, maxLeft);

    const preferTop = toolbarPreferPosition === "top";
    let top: number;
    if (spaceBelow >= spaceRequired && spaceAbove >= spaceRequired) {
        top = preferTop
            ? baseRect.top - toolbarHeight - bias
            : selectionBottom + bias;
    } else if (spaceBelow >= spaceRequired) {
        top = selectionBottom + bias;
    } else if (spaceAbove >= spaceRequired) {
        top = baseRect.top - toolbarHeight - bias;
    } else {
        const centerY = baseRect.top + baseRect.height / 2;
        top = centerY - toolbarHeight / 2;
    }
    return { left, top: clamp(top, minTop, maxTop), visible: true };
};

/** Compute toolbar position within a container (multi-rect visibility + placement) */
export const calcToolbarPositionInContainer = (
    containerElement: HTMLElement,
    base: Range | Element[] | Element,
    displayElement: Element,
    toolbarPreferPosition?: ToolbarPreferPosition,
    containerInset?: { top?: number; bottom?: number; left?: number; right?: number }
): { left: number; top: number; visible: boolean } => {
    if (!displayElement || !base)
        return hiddenToolbarPosition;

    const displayWindow = displayElement.ownerDocument.defaultView;
    const normalized = normalizeBaseRectsInDisplayWindow(base, displayWindow);
    if (!normalized?.inSameWindow)
        return hiddenToolbarPosition;

    const containerRect = applyContainerInset(toRect(containerElement.getBoundingClientRect()), containerInset);
    const baseRect = resolveVisibleBaseRectInContainer(normalized.normalizedRects, containerRect, true);
    if (!baseRect)
        return hiddenToolbarPosition;

    return calcToolbarPositionFromRect(containerRect, baseRect, displayElement, toolbarPreferPosition ?? "bottom");
};

export const checkRangeOrElementIsVisible = (rendererContainer: Element, base: Range | Element[] | Element, displayWindow: Window, margin?: { left?: number, right?: number, top?: number, bottom?: number }): { left: number, top: number, visible: boolean } => {
    if (!base)
        return hiddenToolbarPosition;

    const normalized = normalizeBaseRectsInDisplayWindow(base, displayWindow);
    if (!normalized?.inSameWindow)
        return hiddenToolbarPosition;

    let normalizedRects = normalized.normalizedRects;
    const rendererContainerRect = toRect(rendererContainer.getBoundingClientRect());
    const visibleContainerRect = applyContainerInset(rendererContainerRect, margin);

    if (margin?.left != null || margin?.right != null || margin?.top != null || margin?.bottom != null) {
        normalizedRects = normalizedRects.map(rect => ({
            left: rect.left + (margin?.left ?? 0),
            top: rect.top + (margin?.top ?? 0),
            width: rect.width - (margin?.left ?? 0) - (margin?.right ?? 0),
            height: rect.height - (margin?.top ?? 0) - (margin?.bottom ?? 0)
        }));
    }

    const finalBaseBoundingRect = resolveVisibleBaseRectInContainer(normalizedRects, visibleContainerRect, false);
    if (!finalBaseBoundingRect)
        return hiddenToolbarPosition;

    return { left: finalBaseBoundingRect.left, top: finalBaseBoundingRect.top, visible: true };
};

export const recalculateRect = (baseBoundingRect: { left: number; top: number; width: number; height: number; right: number; bottom: number; }, firstBaseNode: Node, lastBaseNode: Node, baseWindow: Window) => {
    const baseWindowInnerWidth = baseWindow.innerWidth;
    const baseWindowInnerHeight = baseWindow.innerHeight;
    if (baseBoundingRect.left < 0 || Math.floor(baseBoundingRect.right) > baseWindowInnerWidth) {
        if (baseBoundingRect.left >= 0) {
            const firstBaseNodeRects = firstBaseNode.nodeType != Node.ELEMENT_NODE ? firstBaseNode.parentElement.getClientRects() : (firstBaseNode as Element).getClientRects();
            const firstBaseNodeRect = firstBaseNodeRects[0];
            const visibleWidth = baseWindowInnerWidth - firstBaseNodeRect.left;
            const visibleHeight = baseWindowInnerHeight - firstBaseNodeRect.top;
            baseBoundingRect = {
                left: firstBaseNodeRect.left,
                top: firstBaseNodeRect.top,
                width: visibleWidth,
                height: visibleHeight,
                right: firstBaseNodeRect.left + visibleWidth,
                bottom: firstBaseNodeRect.top + visibleHeight
            };
        }
        else {
            const lastBaseNodeRects = lastBaseNode.nodeType != Node.ELEMENT_NODE ? lastBaseNode.parentElement.getClientRects() : (lastBaseNode as Element).getClientRects();
            const lastBaseNodeRect = lastBaseNodeRects[lastBaseNodeRects.length - 1];
            const remainRightWidth = Math.floor(baseBoundingRect.width + baseBoundingRect.left);
            if (remainRightWidth < baseWindowInnerWidth || (remainRightWidth == baseWindowInnerWidth && lastBaseNodeRect.bottom < baseWindowInnerHeight)) {
                let maxRemainWidth = lastBaseNodeRect.right;
                let minRemainLeft = lastBaseNodeRect.left;
                let minRemainTop = lastBaseNodeRect.top;
                for (let i = 0; i < lastBaseNodeRects.length; i++) {
                    if (lastBaseNodeRects[i].left < 0)
                        continue;
                    const currentRect = lastBaseNodeRects[i];
                    if (maxRemainWidth < currentRect.width) {
                        maxRemainWidth = currentRect.width;
                    }
                    if (minRemainLeft > currentRect.left) {
                        minRemainLeft = currentRect.left;
                    }
                    if (minRemainTop > currentRect.top) {
                        minRemainTop = currentRect.top;
                    }
                }
                const visibleWidth = maxRemainWidth;
                const visibleHeight = lastBaseNodeRect.bottom;
                baseBoundingRect = {
                    left: minRemainLeft,
                    top: minRemainTop,
                    width: visibleWidth,
                    height: visibleHeight,
                    right: minRemainLeft + visibleWidth,
                    bottom: minRemainTop + visibleHeight
                };

            }
            else {
                baseBoundingRect = {
                    left: 0,
                    top: 0,
                    width: baseWindowInnerWidth,
                    height: baseWindowInnerHeight,
                    right: baseWindowInnerWidth,
                    bottom: baseWindowInnerHeight
                };
            }
        }
    }
    return baseBoundingRect;
};

export type ToolbarContainerInset = { top?: number; bottom?: number; left?: number; right?: number };

/** Default inset when chrome bars sit inside the same container as content. */
export const DEFAULT_TOOLBAR_CONTAINER_INSET: ToolbarContainerInset = { top: 8, bottom: 8, left: 8, right: 8 };

export const calcToolbarPosition = (
    ownerPanel: HTMLElement,
    base: Range | Element[] | Element,
    displayElement: Element,
    toolbarPreferPosition?: ToolbarPreferPosition,
    flipMode?: FlipMode,
    containerInset: ToolbarContainerInset = DEFAULT_TOOLBAR_CONTAINER_INSET
): { left: number, top: number, visible: boolean } => {
    if (!displayElement || !base)
        return hiddenToolbarPosition;

    const preferPosition = toolbarPreferPosition ?? "bottom";

    if (flipMode == "page") {
        const { baseWindow, baseBoundingRect } = getBaseState(base);

        const baseWindowInnerWidth = baseWindow.innerWidth;
        const baseWindowInnerHeight = baseWindow.innerHeight;
        const baseBoundingRectLeft = Math.round(baseBoundingRect.left);
        if (baseBoundingRect.right < 0)
            return hiddenToolbarPosition;

        if (baseBoundingRectLeft > baseWindowInnerWidth)
            return hiddenToolbarPosition;

        if (baseBoundingRect.bottom < 0)
            return hiddenToolbarPosition;

        if (baseBoundingRect.top > baseWindowInnerHeight)
            return hiddenToolbarPosition;

        // Use visible client rects instead of recalculateRect. A highlight flush
        // with the iframe edge is a subpixel "overflow"; recalculateRect then
        // inflates it to the window origin, which sends large panels to 0,0.
        return calcToolbarPositionInContainer(ownerPanel, base, displayElement, preferPosition, containerInset);
    }

    return calcToolbarPositionInContainer(ownerPanel, base, displayElement, preferPosition, containerInset);
};

export const containsRect = (source: { left: number, top: number, right: number, bottom: number }, target: { left: number, top: number, right: number, bottom: number }) => {
    return target.left >= source.left
        && target.top >= source.top
        && target.right <= source.right
        && target.bottom <= source.bottom;
};

export const intersectRect = (source: { left: number, top: number, right: number, bottom: number }, target: { left: number, top: number, right: number, bottom: number }) => {
    return target.right > source.left
        && target.left < source.right
        && target.top < source.bottom
        && target.bottom > source.top;
};

const isVerticalWritingMode = (writingMode?: WritingMode) =>
    writingMode == "vertical-lr" || writingMode == "vertical-rl";

const toEdgeRect = (rect: { left: number; top: number; right: number; bottom: number }): EdgeRect => ({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom
});

/** Whether the rect is completely before the viewport along reading flow. */
const isCompletelyBeforeViewport = (rect: EdgeRect, viewport: EdgeRect, writingMode?: WritingMode) => {
    if (isVerticalWritingMode(writingMode)) {
        if (writingMode == "vertical-rl") {
            return rect.left >= viewport.right || rect.bottom <= viewport.top;
        }
        return rect.right <= viewport.left || rect.bottom <= viewport.top;
    }
    return rect.bottom <= viewport.top || rect.right <= viewport.left;
};

/** Whether the rect is completely after the viewport along reading flow. */
const isCompletelyAfterViewport = (rect: EdgeRect, viewport: EdgeRect, writingMode?: WritingMode) => {
    if (isVerticalWritingMode(writingMode)) {
        if (writingMode == "vertical-rl") {
            return rect.right <= viewport.left || rect.top >= viewport.bottom;
        }
        return rect.left >= viewport.right || rect.top >= viewport.bottom;
    }
    return rect.top >= viewport.bottom || rect.left >= viewport.right;
};

/**
 * Resolve the visually visible area inside contentWindow coordinates.
 * When content lives in an iframe, clips by the parent window (and optional top inset).
 */
export const resolveVisibleViewportInContentWindow = (
    contentWindow: Window,
    options?: { topInset?: number; bottomInset?: number; leftInset?: number; rightInset?: number }
): EdgeRect | null => {
    let viewport: EdgeRect = {
        left: 0,
        top: 0,
        right: contentWindow.innerWidth,
        bottom: contentWindow.innerHeight
    };

    const frameElement = contentWindow.frameElement as Element | null;
    const parentWindow = frameElement?.ownerDocument?.defaultView;
    if (frameElement && parentWindow) {
        const frameRect = frameElement.getBoundingClientRect();
        const parentViewport: EdgeRect = {
            left: 0,
            top: 0,
            right: parentWindow.innerWidth,
            bottom: parentWindow.innerHeight
        };
        const clippedLeft = Math.max(frameRect.left, parentViewport.left);
        const clippedTop = Math.max(frameRect.top, parentViewport.top);
        const clippedRight = Math.min(frameRect.right, parentViewport.right);
        const clippedBottom = Math.min(frameRect.bottom, parentViewport.bottom);
        if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
            return null;
        }
        viewport = {
            left: clippedLeft - frameRect.left,
            top: clippedTop - frameRect.top,
            right: clippedRight - frameRect.left,
            bottom: clippedBottom - frameRect.top
        };
    }

    const left = viewport.left + (options?.leftInset ?? 0);
    const top = viewport.top + (options?.topInset ?? 0);
    const right = viewport.right - (options?.rightInset ?? 0);
    const bottom = viewport.bottom - (options?.bottomInset ?? 0);
    if (right <= left || bottom <= top) {
        return null;
    }
    return { left, top, right, bottom };
};

/**
 * Find visible elements among reading-order candidates via binary search + linear scan.
 * Only calls getBoundingClientRect on O(log n + k) elements in typical single-column flow.
 */
export const getOrderedElementsIntersectingRect = (
    candidates: Element[],
    viewport: EdgeRect,
    options?: OrderedIntersectOptions
): Element[] => {
    if (!candidates.length) {
        return [];
    }

    const writingMode = options?.writingMode;
    const fullVisible = options?.fullVisible ?? false;
    const missStreakToStop = options?.missStreakToStop ?? 8;
    const matches = (rect: EdgeRect) =>
        fullVisible ? containsRect(viewport, rect) : intersectRect(viewport, rect);

    let low = 0;
    let high = candidates.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        const midRect = toEdgeRect(candidates[mid].getBoundingClientRect());
        if (isCompletelyBeforeViewport(midRect, viewport, writingMode)) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }

    const visible: Element[] = [];
    let missStreak = 0;
    let hasVisible = false;
    for (let i = low; i < candidates.length; i++) {
        const rect = toEdgeRect(candidates[i].getBoundingClientRect());
        if (matches(rect)) {
            visible.push(candidates[i]);
            hasVisible = true;
            missStreak = 0;
            continue;
        }
        if (hasVisible && isCompletelyAfterViewport(rect, viewport, writingMode)) {
            missStreak++;
            if (missStreak >= missStreakToStop) {
                break;
            }
        }
    }
    return visible;
};

/**
 * Get a Range from x,y coordinates.
 * @param x X coordinate
 * @param y Y coordinate
 * @returns Range | null
 */
export const getRangeFromPoint = (doc: Document, x: number, y: number) => {
    // WebKit / Blink
    if (doc.caretRangeFromPoint) {
        return doc.caretRangeFromPoint(x, y);
    }
    // Firefox / standard
    if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(x, y);
        if (pos) {
            const range = doc.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
            return range;
        }
    }
    return null;
}

const UNSPLITTABLE_TAGS = new Set(["img", "image", "svg", "video", "audio", "canvas", "iframe"]);

const hasMeaningfulText = (element: Element) => {
    const text = element.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code != 32 && code != 9 && code != 10 && code != 13 && code != 160) {
            return true;
        }
    }
    return false;
};

/** Images, media, and empty nodes cannot be split into a character Range. */
export const isUnsplittableContentElement = (element: Element) => {
    const tag = element.tagName?.toLowerCase();
    if (tag && UNSPLITTABLE_TAGS.has(tag)) {
        return true;
    }
    return !hasMeaningfulText(element);
};

export type VisibleTextAnchor = {
    textOffset: number;
    rect: DOMRect;
};

const caretPointForWritingMode = (viewport: EdgeRect, writingMode?: WritingMode) => {
    if (writingMode == "vertical-rl") {
        return { x: Math.max(viewport.left, viewport.right - 1), y: viewport.top + 1 };
    }
    return { x: viewport.left + 1, y: viewport.top + 1 };
};

const isZeroSizeRect = (rect: { width: number; height: number }) =>
    rect.width === 0 && rect.height === 0;

const isNodeInsideElement = (element: Element, node: Node) =>
    element === node || element.contains(node);

const resolveTextOffsetAnchor = (
    element: Element,
    textOffset: number,
    textLength: number
): VisibleTextAnchor | undefined => {
    const end = Math.min(textOffset + 1, textLength);
    if (textOffset < 0 || textOffset >= textLength) {
        return undefined;
    }
    const range = createRange(element, element, textOffset, end);
    if (!range) {
        return undefined;
    }
    return { textOffset, rect: getFirstClientRect(range) };
};

/**
 * First visible character inside `element` as a textContent offset, without wrapping glyphs in DOM.
 * Prefers caretRangeFromPoint at the reading-start corner; falls back to binary search over Range rects.
 */
export const findFirstVisibleTextOffset = (
    element: Element,
    viewport: EdgeRect,
    writingMode?: WritingMode
): VisibleTextAnchor | undefined => {
    if (isUnsplittableContentElement(element)) {
        return undefined;
    }
    const textLength = element.textContent?.length ?? 0;
    if (textLength <= 0) {
        return undefined;
    }
    const ownerDocument = element.ownerDocument;
    if (!ownerDocument) {
        return undefined;
    }

    const point = caretPointForWritingMode(viewport, writingMode);
    const pointRange = getRangeFromPoint(ownerDocument, point.x, point.y);
    if (pointRange && isNodeInsideElement(element, pointRange.startContainer)) {
        const textOffset = getTextOffsetInElement(element, pointRange.startContainer, pointRange.startOffset);
        const anchor = resolveTextOffsetAnchor(element, textOffset, textLength);
        if (anchor && !isZeroSizeRect(anchor.rect)) {
            const edge = toEdgeRect(anchor.rect);
            if (!isCompletelyBeforeViewport(edge, viewport, writingMode) && intersectRect(viewport, edge)) {
                return anchor;
            }
        }
    }

    let low = 0;
    let high = textLength - 1;
    let found: VisibleTextAnchor | undefined;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const anchor = resolveTextOffsetAnchor(element, mid, textLength);
        if (!anchor || isZeroSizeRect(anchor.rect) || isCompletelyBeforeViewport(toEdgeRect(anchor.rect), viewport, writingMode)) {
            low = mid + 1;
            continue;
        }
        found = anchor;
        high = mid - 1;
    }
    return found;
};

/**
 * Get a Range covering the last line of an element range.
 * @param elementRange Element range
 * @returns Range | null
 */
export const getLastLineRangeFromElementRange = (elementRange: Range) => {
    // Client rects for each line (elementRange on a block element yields one rect per line)
    const rects = elementRange.getClientRects();
    if (rects.length === 0)
        return null;
    let lastRect: DOMRect;
    for (let i = rects.length - 1; i >= 0; i--) {
        if (rects[i].height > 0) {
            lastRect = rects[i];
            break;
        }
    }
    if (!lastRect)
        return null;
    const ownerDocument = elementRange.startContainer.ownerDocument;
    // Start of the last line (top-left)
    const startRange = getRangeFromPoint(ownerDocument, lastRect.left, lastRect.top);
    // End of the last line (near bottom-right, inset to avoid landing on the next line)
    const endRange = getRangeFromPoint(ownerDocument, lastRect.right - 1, lastRect.bottom - 1);

    if (!startRange || !endRange) return null;

    const newRange = ownerDocument.createRange();
    newRange.setStart(startRange.startContainer, startRange.startOffset);
    newRange.setEnd(endRange.startContainer, endRange.startOffset);
    return newRange;
}