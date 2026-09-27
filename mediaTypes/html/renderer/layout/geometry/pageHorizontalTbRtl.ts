import { LastElementAttributeName } from "../../../../../kernal";
import { HtmlSettings } from "../../../HtmlSettings";
import type { IframeSizeInput, ILayoutGeometry } from "./ILayoutGeometry";
import { ViewportCssVariableNames } from "../ViewportCssVariableNames";
import { formatTranslate3d, signedTranslateLength } from "./formatTranslate3d";
import {
    alignWrapperPassthrough,
    alwaysApplyRestoredScroll,
    compensationRectAlongX,
    getScrollLocateDeltaAlongStart,
    passthroughRestoreScroll,
    restorePageTransformAlongEnd,
} from "./restoreLayoutState";

const sizePageHorizontalTbRtlIframe = (input: IframeSizeInput) => {
    const { iframe, contentRoot, body, columnWidth, pageHeight, columnGap } = input;
    contentRoot.style.removeProperty("height");
    contentRoot.style.removeProperty("max-height");
    contentRoot.style.removeProperty("width");
    body?.style.removeProperty("height");
    body?.style.removeProperty("max-height");
    body?.style.removeProperty("width");
    iframe.style.removeProperty("min-width");
    iframe.style.removeProperty("min-height");
    const pageBox = {
        width: columnWidth > 0 ? columnWidth : Math.round(iframe.getBoundingClientRect().width) || 0,
        height: pageHeight > 0 ? pageHeight : Math.round(iframe.getBoundingClientRect().height) || 0,
    };
    if (pageBox.width > 0) {
        iframe.style.width = `${pageBox.width}px`;
    }
    else {
        iframe.style.setProperty("width", `var(${ViewportCssVariableNames.ContentContainerWidth})`);
    }
    if (pageBox.height > 0) {
        iframe.style.height = `${pageBox.height}px`;
    }
    else {
        iframe.style.setProperty("height", `var(${ViewportCssVariableNames.ContentContainerHeight})`);
    }
    void iframe.offsetWidth;
    const parent = iframe.parentElement;
    const originParentWidth = parent?.style.width ?? "";
    const originParentMinWidth = parent?.style.minWidth ?? "";
    if (parent && pageBox.width > 0) {
        parent.style.width = `${pageBox.width}px`;
        parent.style.minWidth = `${pageBox.width}px`;
    }
    const originMinWidth = contentRoot.style.minWidth;
    const originDirection = contentRoot.style.direction;
    const originBodyDirection = body?.style.direction ?? "";
    const hadRtlClass = contentRoot.classList.contains(HtmlSettings.RtlProgressionClassName);
    contentRoot.style.setProperty("min-width", "0", "important");
    contentRoot.style.setProperty("direction", "ltr", "important");
    body?.style.setProperty("direction", "ltr", "important");
    contentRoot.classList.remove(HtmlSettings.RtlProgressionClassName);
    const measureExtent = (root: HTMLElement, contentBody: HTMLElement | null, measureAxis: "x" | "y") => {
        const rootRect = root.getBoundingClientRect();
        const marked = contentBody?.querySelector(`[${LastElementAttributeName}="true"]`);
        const last = marked instanceof HTMLElement
            ? marked
            : contentBody?.lastElementChild instanceof HTMLElement
                ? contentBody.lastElementChild
                : null;
        if (last) {
            const lastRect = last.getBoundingClientRect();
            const fromLast = measureAxis == "y"
                ? lastRect.bottom - rootRect.top
                : lastRect.right - rootRect.left;
            if (fromLast > 1) {
                return fromLast;
            }
        }
        if (contentBody) {
            const bodyRect = contentBody.getBoundingClientRect();
            return measureAxis == "y" ? bodyRect.height : bodyRect.width;
        }
        return measureAxis == "y" ? root.scrollHeight : root.scrollWidth;
    };
    const occupied = (measureAxis: "x" | "y", columnLength: number) => {
        const column = columnLength > 0 ? columnLength : 1;
        const stride = column + columnGap;
        const used = measureExtent(contentRoot, body, measureAxis);
        const safeUsed = used > 1 ? used : column;
        const columns = Math.max(1, Math.floor((safeUsed - 1) / stride) + 1);
        return Math.round(columns * column + Math.max(0, columns - 1) * columnGap);
    };
    try {
        void iframe.offsetWidth;
        void contentRoot.offsetWidth;
        iframe.style.setProperty("width", `var(${ViewportCssVariableNames.ContentContainerWidth})`);
        iframe.style.minWidth = occupied("x", pageBox.width) + "px";
    }
    finally {
        if (originMinWidth) {
            contentRoot.style.minWidth = originMinWidth;
        }
        else {
            contentRoot.style.removeProperty("min-width");
        }
        if (originDirection) {
            contentRoot.style.direction = originDirection;
        }
        else {
            contentRoot.style.removeProperty("direction");
        }
        if (body) {
            if (originBodyDirection) {
                body.style.direction = originBodyDirection;
            }
            else {
                body.style.removeProperty("direction");
            }
        }
        if (hadRtlClass) {
            contentRoot.classList.add(HtmlSettings.RtlProgressionClassName);
        }
        if (parent) {
            if (originParentWidth) {
                parent.style.width = originParentWidth;
            }
            else {
                parent.style.removeProperty("width");
            }
            if (originParentMinWidth) {
                parent.style.minWidth = originParentMinWidth;
            }
            else {
                parent.style.removeProperty("min-width");
            }
        }
    }
};

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
    compensationAnchorEdge: "start",
    compensationAnchorMode: "first-visible",
    preloadRangeMode: "page-fill",
    rewritesWrapperVisibility: false,
    holdsAbsoluteLocate: false,
    skipsRestoreWhileSettling: true,
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
    restorePageTransform: restorePageTransformAlongEnd,
    restoreScroll: passthroughRestoreScroll,
    getCompensationRect: compensationRectAlongX,
    getScrollLocateDelta: getScrollLocateDeltaAlongStart,
    alignWrapperToViewport: alignWrapperPassthrough,
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
    sizeIframe: sizePageHorizontalTbRtlIframe,
    shouldSkipSizeRestore: ({ userScrollSettling }) => userScrollSettling,
    restoresScrollAfterResize: false,
};
