import type { IframeSizeInput, ILayoutGeometry, RestoreScrollInput } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import { ViewportCssVariableNames } from "../ViewportCssVariableNames";
import {
    alignWrapperNative,
    alwaysApplyRestoredScroll,
    compensationRectAlongY,
    getScrollLocateDeltaAlongStart,
    restorePageTransformAlongStart,
} from "./restoreLayoutState";

const clampScroll = (value: number) => Math.max(0, value);

const restoreScrollHorizontalTbLtr = ({
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

const sizeScrollHorizontalTbLtrIframe = ({ iframe, contentRoot, body, forceScroll }: IframeSizeInput) => {
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
    restoreScroll: restoreScrollHorizontalTbLtr,
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
    applyIframeFrame: (iframe, forceScroll) => {
        iframe.style.setProperty(
            "width",
            forceScroll ? "100%" : "var(" + ViewportCssVariableNames.ContentContainerWidth + ")"
        );
        iframe.style.setProperty("height", "var(" + ViewportCssVariableNames.ContentContainerHeight + ")");
    },
    sizeIframe: sizeScrollHorizontalTbLtrIframe,
    shouldSkipSizeRestore: () => false,
    restoresScrollAfterResize: true,
};
