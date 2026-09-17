import type { ILayoutGeometry } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";

export const scrollVerticalLrRtl: ILayoutGeometry = {
    id: "scroll-vertical-lr-rtl",
    writingMode: "vertical-lr",
    direction: "rtl",
    flipMode: "scroll",
    rootClass: "dir-rtl",
    rendererClass: "layout-scroll-vertical-lr-rtl",
    contentClass: "content-scroll-vertical-lr-rtl",
    blockAxis: "x",
    blockSign: 1,
    pageAxis: "x",
    pageSign: 1,
    iframeGrow: "width",
    overflowX: "auto",
    overflowY: "hidden",
    initialScroll: "start",
    useColumnLayout: false,
    isVerticalWriting: true,
    measureColumnsAsLtr: false,
    usesRtlPageStart: false,
    viewport: {
        zeroWrapperMargins: true,
        contentsContainerWidthMode: "max-content",
        forceSingleColumn: true,
        contentWrapperWidthMode: "auto",
        contentWrapperMinWidthMode: "0",
        contentWrapperHeightMode: "viewport",
        contentWrapperMaxHeightMode: "viewport",
        contentContainerWidthMode: "auto",
        contentContainerHeightMode: "wrapper",
    },
    getPageStartOffset: (box) => Math.max(0, box.offsetLeft),
    getPageTransformOffset: (box, pageNumber, pageMoveLength) => {
        const page = Math.max(1, pageNumber);
        const startOffset = scrollVerticalLrRtl.getPageStartOffset(box);
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
