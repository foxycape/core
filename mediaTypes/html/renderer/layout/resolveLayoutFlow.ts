import type { Direction, FlipMode, WritingMode } from "../../../../kernal";
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
    /** +1 next increases translate offset (LTR); -1 next decreases it (RTL). */
    pageSign: LayoutSign;
    iframeGrow: IframeGrow;
    overflowX: OverflowMode;
    overflowY: OverflowMode;
    initialScroll: InitialScroll;
    useColumnLayout: boolean;
};

export const isVerticalWritingMode = (writingMode?: WritingMode) =>
    writingMode == "vertical-lr" || writingMode == "vertical-rl";

export const resolveLayoutFlow = (
    htmlOptions: Pick<HtmlOptions, "writingMode" | "direction" | "flipMode" | "forceScroll">
): LayoutFlow => {
    const writingMode = htmlOptions.writingMode ?? "horizontal-tb";
    const direction = htmlOptions.direction ?? "ltr";
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

export const getPageTransformOffset = (
    offsetLeft: number,
    contentWidth: number,
    pageNumber: number,
    pageMoveLength: number,
    isRtlProgression: boolean,
    pageWidth: number = pageMoveLength
) => {
    const page = Math.max(1, pageNumber);
    if (isRtlProgression) {
        // LTR page 1 starts at 0 and shows `pageWidth`; the extra `columnGap` sits
        // past the viewport. RTL page 1 is the mirrored slice at the content end:
        // contentWidth - pageWidth, then each next page subtracts pageMoveLength.
        // Using `page * pageMoveLength` would eat the gap and look like a partial page.
        const visibleWidth = pageWidth > 0 ? pageWidth : pageMoveLength;
        return Math.max(0, offsetLeft + contentWidth - visibleWidth - (page - 1) * pageMoveLength);
    }
    return Math.max(0, offsetLeft + (page - 1) * pageMoveLength);
};
