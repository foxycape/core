import type { Direction, FlipMode, WritingMode } from "../../../../kernal";
import { resolveTextDirectionFromLanguage } from "../../../../kernal/i18n/textDirection";
import type { HtmlOptions } from "../../HtmlOptions";

export type LayoutAxis = "x" | "y";
export type LayoutSign = 1 | -1;
export type IframeGrow = "width" | "height" | "none";
export type OverflowMode = "hidden" | "auto";
export type InitialScroll = "start" | "end";

export type LayoutFlow = {
    writingMode: WritingMode;
    direction: Direction;
    flipMode: FlipMode;
    isVerticalWriting: boolean;
    /** vertical-rl, or horizontal-tb + rtl. Vertical writing ignores direction. */
    isRtlProgression: boolean;
    blockAxis: LayoutAxis;
    blockSign: LayoutSign;
    pageAxis: LayoutAxis;
    /**
     * CSS translate sign along pageAxis.
     * +1 → translateX(-length) (LTR, start on the left);
     * -1 → translateX(+length) (RTL whole-area, start on the right).
     */
    pageSign: LayoutSign;
    iframeGrow: IframeGrow;
    overflowX: OverflowMode;
    overflowY: OverflowMode;
    initialScroll: InitialScroll;
    useColumnLayout: boolean;
};

export const isVerticalWritingMode = (writingMode?: WritingMode) =>
    writingMode == "vertical-lr" || writingMode == "vertical-rl";

export const resolveHtmlTextDirection = (
    htmlOptions: Pick<HtmlOptions, "direction" | "documentLanguage" | "rtlLanguages">
): Direction => {
    if (htmlOptions.direction == "ltr" || htmlOptions.direction == "rtl") {
        return htmlOptions.direction;
    }
    return resolveTextDirectionFromLanguage(htmlOptions.documentLanguage, htmlOptions.rtlLanguages);
};

export const resolveLayoutFlow = (
    htmlOptions: Pick<HtmlOptions, "writingMode" | "direction" | "flipMode" | "forceScroll" | "documentLanguage" | "rtlLanguages">
): LayoutFlow => {
    const writingMode = htmlOptions.writingMode ?? "horizontal-tb";
    const direction = resolveHtmlTextDirection(htmlOptions);
    const flipMode: FlipMode = htmlOptions.forceScroll ? "scroll" : (htmlOptions.flipMode ?? "scroll");
    const isVerticalWriting = isVerticalWritingMode(writingMode);
    const isRtlProgression = writingMode == "vertical-rl" || (!isVerticalWriting && direction == "rtl");
    const isPage = flipMode == "page";

    return {
        writingMode,
        direction,
        flipMode,
        isVerticalWriting,
        isRtlProgression,
        blockAxis: isVerticalWriting ? "x" : "y",
        blockSign: isRtlProgression ? -1 : 1,
        pageAxis: isPage && isVerticalWriting ? "y" : "x",
        pageSign: isRtlProgression && !(isPage && isVerticalWriting) ? -1 : 1,
        iframeGrow: isPage
            ? (isVerticalWriting ? "height" : "width")
            : (isVerticalWriting ? "width" : "height"),
        overflowX: isPage ? "hidden" : (isVerticalWriting ? "auto" : "hidden"),
        overflowY: isPage ? "hidden" : (isVerticalWriting ? "hidden" : "auto"),
        initialScroll: !isPage && isRtlProgression ? "end" : "start",
        useColumnLayout: isPage,
    };
};

/**
 * Distance from the flex row's inline-start to this document's inline-start.
 * Whole-area RTL anchors the row on the right, so start is
 * `containerWidth - offsetLeft - contentWidth`, not `offsetLeft`.
 */
export const getPageStartOffset = (
    offsetLeft: number,
    contentWidth: number,
    isRtlProgression: boolean,
    containerWidth: number = 0
) => {
    if (!isRtlProgression) {
        return Math.max(0, offsetLeft);
    }
    const totalWidth = containerWidth > 0 ? containerWidth : offsetLeft + contentWidth;
    return Math.max(0, totalWidth - offsetLeft - contentWidth);
};

export const getPageTransformOffset = (
    offsetLeft: number,
    contentWidth: number,
    pageNumber: number,
    pageMoveLength: number,
    isRtlProgression: boolean,
    containerWidth: number = 0
) => {
    const page = Math.max(1, pageNumber);
    const startOffset = getPageStartOffset(offsetLeft, contentWidth, isRtlProgression, containerWidth);
    return Math.max(0, startOffset + (page - 1) * pageMoveLength);
};

export const getPageTranslateCss = (
    length: number,
    axis: LayoutAxis,
    pageSign: LayoutSign = 1
) => {
    const value = parseFloat(length.toFixed(10));
    if (axis == "y") {
        return `translate3d(0,-${value}px,0)`;
    }
    return `translate3d(${-pageSign * value}px,0,0)`;
};
