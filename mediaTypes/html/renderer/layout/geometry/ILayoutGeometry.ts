import type { Direction, FlipMode, WritingMode } from "../../../../../kernal";
import type {
    ContentLayoutClass,
    LayoutRouteId,
    RendererLayoutClass,
    RootDirectionClass,
} from "../layoutRouteIds";

export type LayoutAxis = "x" | "y";
/** `1` follows the physical axis (x right, y down); `-1` reverses it (RTL / vertical-rl). */
export type LayoutSign = 1 | -1;
export type IframeGrow = "width" | "height" | "none";
export type OverflowMode = "hidden" | "auto";
export type InitialScroll = "start" | "end";

export type PageBox = {
    offsetLeft: number;
    contentWidth: number;
    containerWidth: number;
};

export type ViewportProfile = {
    zeroWrapperMargins: boolean;
    contentsContainerWidthMode: "max-content" | "measured";
    forceSingleColumn: boolean;
    contentWrapperWidthMode: "auto" | "shadow";
    contentWrapperMinWidthMode: "0" | "shadow" | "column" | "viewport";
    contentWrapperHeightMode: "auto" | "viewport" | "host";
    contentWrapperMaxHeightMode: "none" | "viewport";
    contentContainerWidthMode: "auto" | "column" | "full";
    contentContainerHeightMode: "page" | "wrapper";
};

export type RestorePageTransformInput = {
    currentTransform: number;
    sizeDelta: number;
    offsetDelta: number;
    isFirstVisible: boolean;
    foundElement: boolean;
};

export type RestoreScrollInput = {
    liveScroll: number;
    capturedScroll: number;
    sizeDelta: number;
    offsetDelta: number;
    foundElement: boolean;
    currentIndex: number;
    anchorIndex: number;
};

export type CompensationAnchorEdge = "start" | "end";
export type PreloadRangeMode = "visible-span" | "visual-edge" | "page-fill";
export type CompensationAnchorMode = "first-visible" | "visual-edge";

export type CompensationRect = {
    start: number;
    end: number;
};

export type CompensationRectSource = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

export type ScrollLocateDeltaInput = {
    targetStart: number;
    viewportStart: number;
    targetEnd: number;
    viewportEnd: number;
};

export type AlignWrapperInput = {
    wrapper: HTMLElement;
    scrollElement: HTMLElement;
    rootDocument?: Document;
};

export type PageNumberFromPointInput = {
    axisOffset: number;
    pageMoveLength: number;
    pageLength: number;
    numberOfPages: number;
};

/** One of the 12 flipMode × writingMode × direction routes. */
export type ILayoutGeometry = {
    readonly id: LayoutRouteId;
    readonly writingMode: WritingMode;
    readonly direction: Direction;
    readonly flipMode: FlipMode;
    /** Root dir class (`dir-ltr` / `dir-rtl`). */
    readonly rootClass: RootDirectionClass;
    /** Host renderer class for this route. */
    readonly rendererClass: RendererLayoutClass;
    /** Document/content class for this route. */
    readonly contentClass: ContentLayoutClass;
    /** Axis of block / reading flow. */
    readonly blockAxis: LayoutAxis;
    /** Reading-order sign along `blockAxis`. */
    readonly blockSign: LayoutSign;
    /** Axis used to turn or scroll pages. */
    readonly pageAxis: LayoutAxis;
    /** Page-forward sign along `pageAxis` (swipe / translate). */
    readonly pageSign: LayoutSign;
    /** Which iframe box grows to fit overflowing content. */
    readonly iframeGrow: IframeGrow;
    readonly overflowX: OverflowMode;
    readonly overflowY: OverflowMode;
    /** First-paint scroll; `end` for vertical-rl continuous scroll. */
    readonly initialScroll: InitialScroll;
    /** Paginated CSS columns vs continuous document flow. */
    readonly useColumnLayout: boolean;
    readonly isVerticalWriting: boolean;
    /** Measure column boxes as LTR even when the book is RTL. */
    readonly measureColumnsAsLtr: boolean;
    /** Page 1 starts from the inline-end / right edge. */
    readonly usesRtlPageStart: boolean;
    /** Which visible document is the size-compensation anchor. */
    readonly compensationAnchorEdge: CompensationAnchorEdge;
    /** `first-visible` uses getFirstVisibleDocument(); `visual-edge` uses live rects. */
    readonly compensationAnchorMode: CompensationAnchorMode;
    /** How far around the visible chapter(s) to keep loaded. */
    readonly preloadRangeMode: PreloadRangeMode;
    /** Rewrite wrapper `isVisible` from live rects (0-size placeholders are not visible). */
    readonly rewritesWrapperVisibility: boolean;
    /** Pin the TOC / absolute-locate chapter as the compensation anchor. */
    readonly holdsAbsoluteLocate: boolean;
    /**
     * Skip writing restore while the user scroll settle window is open.
     * horizontal-tb must stay false: upward scroll has to add preceding sizeDelta immediately.
     */
    readonly skipsRestoreWhileSettling: boolean;
    /** Viewport CSS sizing profile for this route. */
    readonly viewport: ViewportProfile;

    /** Reading-order start of a document in the page strip. */
    getPageStartOffset: (box: PageBox) => number;
    /** Translate length that brings `pageNumber` into view. */
    getPageTransformOffset: (box: PageBox, pageNumber: number, pageMoveLength: number) => number;
    /** `translate3d(...)` for a page-axis length. */
    getPageTranslateCss: (length: number) => string;
    /** Signed page-axis length (`-pageSign * length` on x). */
    getSignedTranslateLength: (length: number) => number;
    /** Far edge of the last document, in page-axis space. */
    getLastContentExtent: (lastWrapper: HTMLElement, transformContainer: HTMLElement) => number;
    /** Document start along the strip (layout offset, not a live rect). */
    getDocumentPageStartOffset: (
        wrapper: HTMLElement | undefined,
        pageBox: PageBox & { startOffset: number }
    ) => number;
    /** One page step: column/page box plus gap. */
    getPageMoveLength: (pageBoxWidth: number, pageHeight: number, columnGap: number) => number;
    /** CSS `column-width`; vertical writing uses page height. */
    getColumnWidthForCss: (columnWidth: number, pageHeight: number) => number;
    /** Wrapper extent snapshot used when restoring location. */
    getCaptureExtent: (wrapper: HTMLElement) => { width: number; height: number };
    /** Adjust the current transform after a resize / relayout. */
    restorePageTransform: (input: RestorePageTransformInput) => number;
    /** Adjust live scroll after a document wrapper grows or shrinks. */
    restoreScroll: (input: RestoreScrollInput) => number;
    /** Map a wrapper rect onto the compensation axis for this route. */
    getCompensationRect: (rect: CompensationRectSource) => CompensationRect;
    /** Locate delta that aligns a target to the reading-start or reading-end edge. */
    getScrollLocateDelta: (input: ScrollLocateDeltaInput) => number;
    /** Bring a document wrapper to this route's reading-start edge. */
    alignWrapperToViewport: (input: AlignWrapperInput) => void;
    /** Whether the restored scroll value may be written back. */
    shouldApplyRestoredScroll: (nextScroll: number, liveScroll: number) => boolean;
    /** Target point on the page axis, including the current translate. */
    getLocateAxisOffset: (
        rect: { left: number; top: number },
        translateX: number,
        translateY: number
    ) => number;
    /** Page box length along `pageAxis`. */
    getPageBoxLength: (metrics: { pageWidth: number; pageHeight: number }) => number;
    /** Occupied content length used to count pages. */
    getOccupiedLength: (iframe: HTMLElement | undefined, documentElement: HTMLElement) => number;
    /** Page number for an axis offset; RTL routes count from the end. */
    getPageNumberFromPoint: (input: PageNumberFromPointInput) => number;
};
