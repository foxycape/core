import { LastElementAttributeName } from "../../../../../kernal";
import type { IframeSizeInput, ILayoutGeometry } from "./ILayoutGeometry";
import { ViewportCssVariableNames } from "../ViewportCssVariableNames";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import {
    alignWrapperPassthrough,
    alwaysApplyRestoredScroll,
    compensationRectAlongX,
    getScrollLocateDeltaAlongStart,
    measureBlockSizeDeltaAlongX,
    measureOffsetDeltaAlongX,
    measureOffsetDeltaAlongY,
    measurePageSizeDeltaAlongY,
    passthroughRestoreScroll,
    readCapturedLogicalScrollAlongX,
    readLogicalScrollAlongX,
    readPageTransformAlongY,
    restorePageTransformAlongStart,
    writeLogicalScrollAlongX,
} from "./restoreLayoutState";

const sizePageVerticalRlLtrIframe = (input: IframeSizeInput) => {
    const { iframe, contentRoot, body, columnWidth, pageHeight, columnGap } = input;
    contentRoot.style.removeProperty("height");
    contentRoot.style.removeProperty("max-height");
    contentRoot.style.removeProperty("width");
    body?.style.removeProperty("height");
    body?.style.removeProperty("max-height");
    body?.style.removeProperty("width");
    iframe.style.removeProperty("min-width");
    iframe.style.removeProperty("min-height");
    const pageBox = {
        width: columnWidth > 0 ? columnWidth : Math.round(iframe.getBoundingClientRect().width) || 0,
        height: pageHeight > 0 ? pageHeight : Math.round(iframe.getBoundingClientRect().height) || 0,
    };
    if (pageBox.width > 0) {
        iframe.style.width = `${pageBox.width}px`;
    }
    else {
        iframe.style.setProperty("width", `var(${ViewportCssVariableNames.ContentContainerWidth})`);
    }
    if (pageBox.height > 0) {
        iframe.style.height = `${pageBox.height}px`;
    }
    else {
        iframe.style.setProperty("height", `var(${ViewportCssVariableNames.ContentContainerHeight})`);
    }
    void iframe.offsetWidth;
    const parent = iframe.parentElement;
    const originParentWidth = parent?.style.width ?? "";
    const originParentMinWidth = parent?.style.minWidth ?? "";
    const originMinWidth = contentRoot.style.minWidth;
    contentRoot.style.setProperty("min-width", "0", "important");
    const measureExtent = (root: HTMLElement, contentBody: HTMLElement | null, measureAxis: "x" | "y") => {
        const rootRect = root.getBoundingClientRect();
        const marked = contentBody?.querySelector(`[${LastElementAttributeName}="true"]`);
        const last = marked instanceof HTMLElement
            ? marked
            : contentBody?.lastElementChild instanceof HTMLElement
                ? contentBody.lastElementChild
                : null;
        if (last) {
            const lastRect = last.getBoundingClientRect();
            const fromLast = measureAxis == "y"
                ? lastRect.bottom - rootRect.top
                : lastRect.right - rootRect.left;
            if (fromLast > 1) {
                return fromLast;
            }
        }
        if (contentBody) {
            const bodyRect = contentBody.getBoundingClientRect();
            return measureAxis == "y" ? bodyRect.height : bodyRect.width;
        }
        return measureAxis == "y" ? root.scrollHeight : root.scrollWidth;
    };
    const occupied = (measureAxis: "x" | "y", columnLength: number) => {
        const column = columnLength > 0 ? columnLength : 1;
        const stride = column + columnGap;
        const used = measureExtent(contentRoot, body, measureAxis);
        const safeUsed = used > 1 ? used : column;
        const columns = Math.max(1, Math.floor((safeUsed - 1) / stride) + 1);
        return Math.round(columns * column + Math.max(0, columns - 1) * columnGap);
    };
    try {
        void iframe.offsetHeight;
        void contentRoot.offsetHeight;
        iframe.style.setProperty("height", `var(${ViewportCssVariableNames.ContentContainerHeight})`);
        iframe.style.minHeight = occupied("y", pageBox.height) + "px";
    }
    finally {
        if (originMinWidth) {
            contentRoot.style.minWidth = originMinWidth;
        }
        else {
            contentRoot.style.removeProperty("min-width");
        }
        if (parent) {
            if (originParentWidth) {
                parent.style.width = originParentWidth;
            }
            else {
                parent.style.removeProperty("width");
            }
            if (originParentMinWidth) {
                parent.style.minWidth = originParentMinWidth;
            }
            else {
                parent.style.removeProperty("min-width");
            }
        }
    }
};

export const pageVerticalRlLtr: ILayoutGeometry = {
    id: "page-vertical-rl-ltr",
    writingMode: "vertical-rl",
    direction: "ltr",
    flipMode: "page",
    rootClass: "dir-ltr",
    rendererClass: "layout-page-vertical-rl-ltr",
    contentClass: "content-page-vertical-rl-ltr",
    blockAxis: "x",
    blockSign: -1,
    pageAxis: "y",
    pageSign: 1,
    iframeGrow: "height",
    overflowX: "hidden",
    overflowY: "hidden",
    initialScroll: "start",
    useColumnLayout: true,
    isVerticalWriting: true,
    measureColumnsAsLtr: false,
    usesRtlPageStart: false,
    compensationAnchorEdge: "start",
    documentOrderAnchor: "first",
    preloadRangeMode: "page-fill",
    rewritesWrapperVisibility: false,
    holdsAbsoluteLocate: false,
    skipsRestoreWhileSettling: true,
    viewport: {
        zeroWrapperMargins: true,
        contentsContainerWidthMode: "measured",
        forceSingleColumn: true,
        contentWrapperWidthMode: "shadow",
        contentWrapperMinWidthMode: "column",
        contentWrapperHeightMode: "auto",
        contentWrapperMaxHeightMode: "none",
        contentContainerWidthMode: "column",
        contentContainerHeightMode: "page",
    },
    getPageStartOffset: (box) => Math.max(0, box.offsetLeft),
    getPageTransformOffset: (box, pageNumber, pageMoveLength) => {
        const page = Math.max(1, pageNumber);
        const startOffset = pageVerticalRlLtr.getPageStartOffset(box);
        return Math.max(0, startOffset + (page - 1) * pageMoveLength);
    },
    getPageTranslateCss: (length) => formatTranslate3d(length, "y", 1),
    getSignedTranslateLength: (length) => signedTranslateLength(length, "y", 1),
    getLastContentExtent: (lastWrapper) => lastWrapper.offsetTop + lastWrapper.scrollHeight,
    getDocumentPageStartOffset: (wrapper) => wrapper?.offsetTop ?? 0,
    getPageMoveLength: (pageBoxWidth, pageHeight, columnGap) => pageHeight + columnGap,
    getColumnWidthForCss: (columnWidth, pageHeight) => pageHeight,
    getCaptureExtent: (wrapper) => ({
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
    }),
    restorePageTransform: restorePageTransformAlongStart,
    restoreScroll: passthroughRestoreScroll,
    readLogicalScroll: readLogicalScrollAlongX,
    readCapturedLogicalScroll: readCapturedLogicalScrollAlongX,
    writeLogicalScroll: writeLogicalScrollAlongX,
    measureBlockSizeDelta: measureBlockSizeDeltaAlongX,
    measureBlockOffsetDelta: measureOffsetDeltaAlongX,
    readPageTransform: readPageTransformAlongY,
    measurePageSizeDelta: measurePageSizeDeltaAlongY,
    measurePageOffsetDelta: measureOffsetDeltaAlongY,
    getCompensationRect: compensationRectAlongX,
    getScrollLocateDelta: getScrollLocateDeltaAlongStart,
    alignWrapperToViewport: alignWrapperPassthrough,
    shouldApplyRestoredScroll: alwaysApplyRestoredScroll,
    getLocateAxisOffset: (rect, translateX, translateY) => rect.top + translateY,
    getPageBoxLength: (metrics) => metrics.pageHeight,
    getOccupiedLength: (iframe, documentElement) => (iframe?.offsetHeight || documentElement.scrollHeight),
    getPageNumberFromPoint: ({
        axisOffset,
        pageMoveLength,
        pageLength,
        numberOfPages,
    }) => {
        let pageNumber = Math.floor(axisOffset / pageMoveLength);
        if (axisOffset > pageLength && axisOffset % pageMoveLength >= 0) {
            pageNumber = pageNumber + 1;
        }
        if (pageNumber == 0) {
            pageNumber = 1;
        }
        return pageNumber;
    },
    applyIframeFrame: (iframe) => {
        iframe.style.setProperty("width", "var(" + ViewportCssVariableNames.ContentContainerWidth + ")");
        iframe.style.setProperty("height", "auto");
    },
    sizeIframe: sizePageVerticalRlLtrIframe,
    shouldSkipSizeRestore: ({ userScrollSettling }) => userScrollSettling,
    restoresScrollAfterResize: false,
};
