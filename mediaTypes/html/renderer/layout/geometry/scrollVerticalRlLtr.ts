import type { IframeSizeInput, ILayoutGeometry, RestoreScrollInput } from "./ILayoutGeometry";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import { ViewportCssVariableNames } from "../ViewportCssVariableNames";
import {
    alignWrapperToVisualEnd,
    alwaysApplyRestoredScroll,
    compensationRectAlongX,
    getScrollLocateDeltaAlongEnd,
    restorePageTransformAlongEnd,
} from "./restoreLayoutState";

const clampScroll = (value: number) => Math.max(0, value);

const restoreScrollVerticalRlLtr = ({
    liveScroll,
    capturedScroll,
    sizeDelta,
    offsetDelta,
    foundElement,
    currentIndex,
    anchorIndex,
}: RestoreScrollInput) => {
    if (currentIndex < 0 || anchorIndex < 0) {
        return liveScroll;
    }
    if (currentIndex > anchorIndex) {
        return clampScroll(liveScroll + sizeDelta);
    }
    if (currentIndex < anchorIndex) {
        return liveScroll;
    }
    if (foundElement) {
        return clampScroll(liveScroll + offsetDelta);
    }
    if (Math.abs(liveScroll - capturedScroll) > 2) {
        return liveScroll;
    }
    return clampScroll(liveScroll + sizeDelta);
};

const sizeScrollVerticalRlLtrIframe = ({ iframe, contentRoot, body, parentContentHeight }: IframeSizeInput) => {
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

export const scrollVerticalRlLtr: ILayoutGeometry = {
    id: "scroll-vertical-rl-ltr",
    writingMode: "vertical-rl",
    direction: "ltr",
    flipMode: "scroll",
    rootClass: "dir-ltr",
    rendererClass: "layout-scroll-vertical-rl-ltr",
    contentClass: "content-scroll-vertical-rl-ltr",
    blockAxis: "x",
    blockSign: -1,
    pageAxis: "x",
    pageSign: -1,
    iframeGrow: "width",
    overflowX: "auto",
    overflowY: "hidden",
    initialScroll: "end",
    useColumnLayout: false,
    isVerticalWriting: true,
    measureColumnsAsLtr: false,
    usesRtlPageStart: true,
    compensationAnchorEdge: "end",
    compensationAnchorMode: "visual-edge",
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
    getPageStartOffset: (box) => {
        const totalWidth = box.containerWidth > 0 ? box.containerWidth : box.offsetLeft + box.contentWidth;
        return Math.max(0, totalWidth - box.offsetLeft - box.contentWidth);
    },
    getPageTransformOffset: (box, pageNumber, pageMoveLength) => {
        const page = Math.max(1, pageNumber);
        const startOffset = scrollVerticalRlLtr.getPageStartOffset(box);
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
    restoreScroll: restoreScrollVerticalRlLtr,
    getCompensationRect: compensationRectAlongX,
    getScrollLocateDelta: getScrollLocateDeltaAlongEnd,
    alignWrapperToViewport: alignWrapperToVisualEnd,
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
    applyIframeFrame: (iframe) => {
        iframe.style.setProperty("width", "var(" + ViewportCssVariableNames.ContentContainerWidth + ")");
        iframe.style.setProperty("height", "var(" + ViewportCssVariableNames.ContentContainerHeight + ")");
    },
    sizeIframe: sizeScrollVerticalRlLtrIframe,
    shouldSkipSizeRestore: ({ userScrollSettling, holdingAbsoluteLocate }) =>
        userScrollSettling && !holdingAbsoluteLocate,
    restoresScrollAfterResize: true,
};
