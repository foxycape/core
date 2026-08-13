import type { ContentGeometry, FixedContentRange } from "../../../../kernal/ContentRange";
import { getPagedSelectionRects } from "./textRects";

export type PageLayoutRef = {
    /** Page content-box width (clientWidth; excludes border) */
    width: number;
    /** Page content-box height (clientHeight; excludes border) */
    height: number;
    /** Viewport X of content-box origin (border-box left + clientLeft) */
    contentLeft: number;
    /** Viewport Y of content-box origin (border-box top + clientTop) */
    contentTop: number;
    /** Viewport rotation at layout time (0 | 90 | 180 | 270) */
    rotation?: number;
};

export type ScaledGeometryRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Clockwise delta from stored rotation to current rotation (0 | 90 | 180 | 270). */
    rotationDelta: number;
};

/** Snap to 0 | 90 | 180 | 270. */
export const normalizePageRotation = (degrees: number): number => {
    const n = ((Math.round(degrees) % 360) + 360) % 360;
    return (Math.round(n / 90) * 90) % 360;
};

/**
 * Rotate an axis-aligned rect clockwise in page content-box space (origin top-left, Y down).
 */
export const rotateRectInPage = (
    x: number,
    y: number,
    w: number,
    h: number,
    pageWidth: number,
    pageHeight: number,
    delta: number,
): { x: number; y: number; width: number; height: number } => {
    switch (normalizePageRotation(delta)) {
        case 90:
            return { x: pageHeight - y - h, y: x, width: h, height: w };
        case 180:
            return { x: pageWidth - x - w, y: pageHeight - y - h, width: w, height: h };
        case 270:
            return { x: y, y: pageWidth - x - w, width: h, height: w };
        default:
            return { x, y, width: w, height: h };
    }
};

export type PageLayoutResolver = (pageNumber: number) => PageLayoutRef | undefined;

/**
 * Build layout reference from a page element.
 *
 * Absolute overlays inside `.page` use the padding edge as origin (inside border).
 * Selection client rects are viewport-based, so convert with:
 *   x = rect.x - (pageRect.left + clientLeft)
 * which equals offset from that same padding-edge origin.
 */
export const getPageLayoutRef = (pageEl: HTMLElement): PageLayoutRef | undefined => {
    const pageRect = pageEl.getBoundingClientRect();
    const width = pageEl.clientWidth;
    const height = pageEl.clientHeight;
    if (width <= 0 || height <= 0) {
        return undefined;
    }
    return {
        width,
        height,
        contentLeft: pageRect.left + pageEl.clientLeft,
        contentTop: pageRect.top + pageEl.clientTop,
    };
};

/**
 * Convert a text selection Range into FixedContentRange geometries.
 * Supports multi-page selections; coords are relative to page content box at mark time.
 */
export const selectionToFixedContentRange = (
    range: Range,
    resolveLayout: PageLayoutResolver,
): FixedContentRange | null => {
    const pagedRects = getPagedSelectionRects(range);
    if (pagedRects.length === 0) {
        return null;
    }

    const geometries: ContentGeometry[] = [];
    for (const rect of pagedRects) {
        const layout = resolveLayout(rect.pageNumber);
        if (!layout) {
            continue;
        }
        const x = rect.x - layout.contentLeft;
        const y = rect.y - layout.contentTop;
        const geometry: ContentGeometry = {
            pageNumber: rect.pageNumber,
            width: layout.width,
            height: layout.height,
            shape: "rect",
            coords: [x, y, rect.width, rect.height],
            rotation: normalizePageRotation(layout.rotation ?? 0),
        };
        geometries.push(geometry);
    }

    if (geometries.length === 0) {
        return null;
    }

    return {
        kind: "fixed",
        geometries,
    };
};

/**
 * Map a stored geometry rect into current page content-box pixels.
 * Rotate from stored `rotation` to `currentRotation`, then scale (covers zoom and 90/270 size swap).
 * Missing `rotation` is treated as 0 (legacy marks).
 */
export const scaleGeometryCoords = (
    geometry: ContentGeometry,
    currentWidth: number,
    currentHeight: number,
    currentRotation = 0,
): ScaledGeometryRect => {
    const [x = 0, y = 0, w = 0, h = 0] = geometry.coords;
    const storedRotation = geometry.rotation ?? 0;
    const rotationDelta = normalizePageRotation(currentRotation - storedRotation);
    const rotated = rotateRectInPage(x, y, w, h, geometry.width, geometry.height, rotationDelta);
    const pageWidth = rotationDelta % 180 === 0 ? geometry.width : geometry.height;
    const pageHeight = rotationDelta % 180 === 0 ? geometry.height : geometry.width;
    const sx = pageWidth > 0 ? currentWidth / pageWidth : 1;
    const sy = pageHeight > 0 ? currentHeight / pageHeight : 1;
    return {
        x: rotated.x * sx,
        y: rotated.y * sy,
        width: rotated.width * sx,
        height: rotated.height * sy,
        rotationDelta,
    };
};
