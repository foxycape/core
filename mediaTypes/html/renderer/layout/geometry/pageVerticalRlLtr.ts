import type { ILayoutGeometry } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import {
    alignWrapperPassthrough,
    alwaysApplyRestoredScroll,
    compensationRectAlongX,
    getScrollLocateDeltaAlongStart,
    passthroughRestoreScroll,
    restorePageTransformAlongStart,
} from "./restoreLayoutState";

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
    compensationAnchorMode: "first-visible",
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
};
