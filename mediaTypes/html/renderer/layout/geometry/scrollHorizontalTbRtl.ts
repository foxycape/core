import type { IframeSizeInput, ILayoutGeometry, RestoreScrollInput } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import { ViewportCssVariableNames } from "../ViewportCssVariableNames";
import {
    alignWrapperNative,
    alwaysApplyRestoredScroll,
    compensationRectAlongY,
    getScrollLocateDeltaAlongStart,
    restorePageTransformAlongEnd,
} from "./restoreLayoutState";

const clampScroll = (value: number) => Math.max(0, value);

const restoreScrollHorizontalTbRtl = ({
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
            return clampScroll(capturedScroll + offsetDelta);
        }
        return liveScroll;
    }
    return clampScroll(capturedScroll + sizeDelta);
};

const clearInlineContentBox = (contentRoot: HTMLElement, body: HTMLElement | null) => {
    contentRoot.style.removeProperty("height");
    contentRoot.style.removeProperty("max-height");
    contentRoot.style.removeProperty("width");
    if (!body) {
        return;
    }
    body.style.removeProperty("height");
    body.style.removeProperty("max-height");
    body.style.removeProperty("width");
};

const sizeScrollHorizontalTbRtlIframe = ({ iframe, contentRoot, body, forceScroll }: IframeSizeInput) => {
    clearInlineContentBox(contentRoot, body);
    iframe.style.removeProperty("min-width");
    iframe.style.setProperty(
        "width",
        forceScroll ? "100%" : `var(${ViewportCssVariableNames.ContentContainerWidth})`
    );
    const declaredHeight = iframe.style.height;
    if (!declaredHeight || declaredHeight === "auto") {
        iframe.style.setProperty("height", `var(${ViewportCssVariableNames.ContentContainerHeight})`);
    }
    void iframe.offsetHeight;
    iframe.style.minHeight = Math.max(1, Math.round(contentRoot.getBoundingClientRect().height)) + "px";
};

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
    restoreScroll: restoreScrollHorizontalTbRtl,
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
    applyIframeFrame: (iframe, forceScroll) => {
        iframe.style.setProperty(
            "width",
            forceScroll ? "100%" : "var(" + ViewportCssVariableNames.ContentContainerWidth + ")"
        );
        iframe.style.setProperty("height", "var(" + ViewportCssVariableNames.ContentContainerHeight + ")");
    },
    sizeIframe: sizeScrollHorizontalTbRtlIframe,
    shouldSkipSizeRestore: () => false,
    restoresScrollAfterResize: true,
};
