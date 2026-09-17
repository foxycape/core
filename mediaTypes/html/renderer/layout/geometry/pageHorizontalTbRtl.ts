import type { ILayoutGeometry } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";

export const pageHorizontalTbRtl: ILayoutGeometry = {
    id: "page-horizontal-tb-rtl",
    writingMode: "horizontal-tb",
    direction: "rtl",
    flipMode: "page",
    rootClass: "dir-rtl",
    rendererClass: "layout-page-horizontal-tb-rtl",
    contentClass: "content-page-horizontal-tb-rtl",
    blockAxis: "y",
    blockSign: -1,
    pageAxis: "x",
    pageSign: -1,
    iframeGrow: "width",
    overflowX: "hidden",
    overflowY: "hidden",
    initialScroll: "start",
    useColumnLayout: true,
    isVerticalWriting: false,
    measureColumnsAsLtr: true,
    usesRtlPageStart: true,
    viewport: {
        zeroWrapperMargins: true,
        contentsContainerWidthMode: "measured",
        forceSingleColumn: false,
        contentWrapperWidthMode: "shadow",
        contentWrapperMinWidthMode: "column",
        contentWrapperHeightMode: "viewport",
        contentWrapperMaxHeightMode: "viewport",
        contentContainerWidthMode: "column",
        contentContainerHeightMode: "wrapper",
    },
    getPageStartOffset: (box) => {
        const totalWidth = box.containerWidth > 0 ? box.containerWidth : box.offsetLeft + box.contentWidth;
        return Math.max(0, totalWidth - box.offsetLeft - box.contentWidth);
    },
    getPageTransformOffset: (box, pageNumber, pageMoveLength) => {
        const page = Math.max(1, pageNumber);
        const startOffset = pageHorizontalTbRtl.getPageStartOffset(box);
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
    restorePageTransform: ({
        currentTransform,
        sizeDelta,
        offsetDelta,
        isFirstVisible,
        foundElement,
    }) => {
        let next = currentTransform + sizeDelta;
        if (isFirstVisible && foundElement) {
            next = currentTransform - offsetDelta;
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
        pageNumber = Math.max(1, numberOfPages - pageNumber + 1);
        return pageNumber;
    },
};
