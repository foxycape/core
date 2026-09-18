import type { ILayoutGeometry } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import {
    alignWrapperNative,
    alwaysApplyRestoredScroll,
    compensationRectAlongY,
    getScrollLocateDeltaAlongStart,
    restorePageTransformAlongStart,
    restoreScrollCapturedPlusSize,
} from "./restoreLayoutState";

export const scrollHorizontalTbLtr: ILayoutGeometry = {
    id: "scroll-horizontal-tb-ltr",
    writingMode: "horizontal-tb",
    direction: "ltr",
    flipMode: "scroll",
    rootClass: "dir-ltr",
    rendererClass: "layout-scroll-horizontal-tb-ltr",
    contentClass: "content-scroll-horizontal-tb-ltr",
    blockAxis: "y",
    blockSign: 1,
    pageAxis: "x",
    pageSign: 1,
    iframeGrow: "height",
    overflowX: "hidden",
    overflowY: "auto",
    initialScroll: "start",
    useColumnLayout: false,
    isVerticalWriting: false,
    measureColumnsAsLtr: false,
    usesRtlPageStart: false,
    compensationAnchorEdge: "start",
    compensationAnchorMode: "first-visible",
    preloadRangeMode: "visible-span",
    rewritesWrapperVisibility: false,
    holdsAbsoluteLocate: false,
    skipsRestoreWhileSettling: false,
    viewport: {
        zeroWrapperMargins: false,
        contentsContainerWidthMode: "measured",
        forceSingleColumn: false,
        contentWrapperWidthMode: "shadow",
        contentWrapperMinWidthMode: "shadow",
        contentWrapperHeightMode: "host",
        contentWrapperMaxHeightMode: "viewport",
        contentContainerWidthMode: "full",
        contentContainerHeightMode: "wrapper",
    },
    getPageStartOffset: (box) => Math.max(0, box.offsetLeft),
    getPageTransformOffset: (box, pageNumber, pageMoveLength) => {
        const page = Math.max(1, pageNumber);
        const startOffset = scrollHorizontalTbLtr.getPageStartOffset(box);
        return Math.max(0, startOffset + (page - 1) * pageMoveLength);
    },
    getPageTranslateCss: (length) => formatTranslate3d(length, "x", 1),
    getSignedTranslateLength: (length) => signedTranslateLength(length, "x", 1),
    getLastContentExtent: (lastWrapper) => lastWrapper.offsetLeft + lastWrapper.scrollWidth,
    getDocumentPageStartOffset: (wrapper) => wrapper?.offsetLeft ?? 0,
    getPageMoveLength: (pageBoxWidth, pageHeight, columnGap) => pageBoxWidth + columnGap,
    getColumnWidthForCss: (columnWidth, pageHeight) => columnWidth,
    getCaptureExtent: (wrapper) => ({
        width: wrapper.scrollWidth,
        height: wrapper.offsetHeight,
    }),
    restorePageTransform: restorePageTransformAlongStart,
    restoreScroll: restoreScrollCapturedPlusSize,
    getCompensationRect: compensationRectAlongY,
    getScrollLocateDelta: getScrollLocateDeltaAlongStart,
    alignWrapperToViewport: alignWrapperNative,
    shouldApplyRestoredScroll: alwaysApplyRestoredScroll,
    getLocateAxisOffset: (rect, translateX, translateY) => rect.left + translateX,
    getPageBoxLength: (metrics) => metrics.pageWidth,
    getOccupiedLength: (iframe, documentElement) => (iframe?.offsetWidth || documentElement.scrollWidth),
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
