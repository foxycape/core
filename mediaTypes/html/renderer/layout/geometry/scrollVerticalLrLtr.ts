import type { IframeSizeInput, ILayoutGeometry, RestoreScrollInput } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import { ViewportCssVariableNames } from "../ViewportCssVariableNames";
import {
    alignWrapperNative,
    compensationRectAlongX,
    getScrollLocateDeltaAlongStart,
    measureBlockSizeDeltaAlongX,
    measureOffsetDeltaAlongX,
    measurePageSizeDeltaAlongX,
    readCapturedLogicalScrollAlongX,
    readLogicalScrollAlongX,
    readPageTransformAlongX,
    rejectPinnedStartScroll,
    restorePageTransformAlongStart,
    writeLogicalScrollAlongX,
} from "./restoreLayoutState";

const clampScroll = (value: number) => Math.max(0, value);

const restoreScrollVerticalLrLtr = ({
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
            return clampScroll(liveScroll + offsetDelta);
        }
        return liveScroll;
    }
    if (Math.abs(liveScroll - capturedScroll) > 2) {
        return liveScroll;
    }
    return clampScroll(capturedScroll + sizeDelta);
};

const sizeScrollVerticalLrLtrIframe = ({ iframe, contentRoot, body, parentContentHeight }: IframeSizeInput) => {
    iframe.style.removeProperty("min-height");
    const lockedHeight = parentContentHeight || iframe.clientHeight;
    iframe.style.height = lockedHeight
        ? lockedHeight + "px"
        : `var(${ViewportCssVariableNames.ContentContainerHeight})`;
    if (lockedHeight) {
        contentRoot.style.height = lockedHeight + "px";
        contentRoot.style.maxHeight = lockedHeight + "px";
        if (body) {
            body.style.height = lockedHeight + "px";
            body.style.maxHeight = lockedHeight + "px";
        }
    }
    void iframe.offsetWidth;
    iframe.style.minWidth = Math.max(1, Math.round(contentRoot.getBoundingClientRect().width)) + "px";
};

export const scrollVerticalLrLtr: ILayoutGeometry = {
    id: "scroll-vertical-lr-ltr",
    writingMode: "vertical-lr",
    direction: "ltr",
    flipMode: "scroll",
    rootClass: "dir-ltr",
    rendererClass: "layout-scroll-vertical-lr-ltr",
    contentClass: "content-scroll-vertical-lr-ltr",
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
    compensationAnchorEdge: "start",
    documentOrderAnchor: "last",
    preloadRangeMode: "visual-edge",
    rewritesWrapperVisibility: true,
    holdsAbsoluteLocate: true,
    skipsRestoreWhileSettling: true,
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
        const startOffset = scrollVerticalLrLtr.getPageStartOffset(box);
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
    restoreScroll: restoreScrollVerticalLrLtr,
    readLogicalScroll: readLogicalScrollAlongX,
    readCapturedLogicalScroll: readCapturedLogicalScrollAlongX,
    writeLogicalScroll: writeLogicalScrollAlongX,
    measureBlockSizeDelta: measureBlockSizeDeltaAlongX,
    measureBlockOffsetDelta: measureOffsetDeltaAlongX,
    readPageTransform: readPageTransformAlongX,
    measurePageSizeDelta: measurePageSizeDeltaAlongX,
    measurePageOffsetDelta: measureOffsetDeltaAlongX,
    getCompensationRect: compensationRectAlongX,
    getScrollLocateDelta: getScrollLocateDeltaAlongStart,
    alignWrapperToViewport: alignWrapperNative,
    shouldApplyRestoredScroll: rejectPinnedStartScroll,
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
    applyIframeFrame: (iframe) => {
        iframe.style.setProperty("width", "var(" + ViewportCssVariableNames.ContentContainerWidth + ")");
        iframe.style.setProperty("height", "var(" + ViewportCssVariableNames.ContentContainerHeight + ")");
    },
    sizeIframe: sizeScrollVerticalLrLtrIframe,
    shouldSkipSizeRestore: ({ userScrollSettling, holdingAbsoluteLocate }) =>
        userScrollSettling && !holdingAbsoluteLocate,
    restoresScrollAfterResize: true,
};
