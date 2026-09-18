import type { ILayoutGeometry } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import {
    alignWrapperNative,
    alwaysApplyRestoredScroll,
    compensationRectAlongY,
    getScrollLocateDeltaAlongStart,
    restorePageTransformAlongEnd,
    restoreScrollCapturedPlusSize,
} from "./restoreLayoutState";

export const scrollHorizontalTbRtl: ILayoutGeometry = {
    id: "scroll-horizontal-tb-rtl",
    writingMode: "horizontal-tb",
    direction: "rtl",
    flipMode: "scroll",
    rootClass: "dir-rtl",
    rendererClass: "layout-scroll-horizontal-tb-rtl",
    contentClass: "content-scroll-horizontal-tb-rtl",
    blockAxis: "y",
    blockSign: -1,
    pageAxis: "x",
    pageSign: -1,
    iframeGrow: "height",
    overflowX: "hidden",
    overflowY: "auto",
    initialScroll: "end",
    useColumnLayout: false,
    isVerticalWriting: false,
    measureColumnsAsLtr: false,
    usesRtlPageStart: true,
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
    getPageStartOffset: (box) => {
        const totalWidth = box.containerWidth > 0 ? box.containerWidth : box.offsetLeft + box.contentWidth;
        return Math.max(0, totalWidth - box.offsetLeft - box.contentWidth);
    },
    getPageTransformOffset: (box, pageNumber, pageMoveLength) => {
        const page = Math.max(1, pageNumber);
        const startOffset = scrollHorizontalTbRtl.getPageStartOffset(box);
        return Math.max(0, startOffset + (page - 1) * pageMoveLength);
    },
    getPageTranslateCss: (length) => formatTranslate3d(length, "x", -1),
    getSignedTranslateLength: (length) => signedTranslateLength(length, "x", -1),
    getLastContentExtent: (_lastWrapper, transformContainer) => transformContainer.offsetWidth || 0,
    getDocumentPageStartOffset: (_wrapper, pageBox) => pageBox.startOffset,
    getPageMoveLength: (pageBoxWidth, pageHeight, columnGap) => pageBoxWidth + columnGap,
    getColumnWidthForCss: (columnWidth, pageHeight) => columnWidth,
    getCaptureExtent: (wrapper) => ({
        width: wrapper.scrollWidth,
        height: wrapper.offsetHeight,
    }),
    restorePageTransform: restorePageTransformAlongEnd,
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
        pageNumber = Math.max(1, numberOfPages - pageNumber + 1);
        return pageNumber;
    },
};
