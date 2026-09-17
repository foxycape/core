import type { ILayoutGeometry } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";

export const pageVerticalRlRtl: ILayoutGeometry = {
    id: "page-vertical-rl-rtl",
    writingMode: "vertical-rl",
    direction: "rtl",
    flipMode: "page",
    rootClass: "dir-rtl",
    rendererClass: "layout-page-vertical-rl-rtl",
    contentClass: "content-page-vertical-rl-rtl",
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
        const startOffset = pageVerticalRlRtl.getPageStartOffset(box);
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
    restorePageTransform: ({
        currentTransform,
        sizeDelta,
        offsetDelta,
        isFirstVisible,
        foundElement,
    }) => {
        let next = currentTransform + sizeDelta;
        if (isFirstVisible && foundElement) {
            next = currentTransform + offsetDelta;
        }
        return Math.max(0, next);
    },
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
