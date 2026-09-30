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
    /** Logical scroll is already at this route's reading-start edge. */
    atReadingStart: boolean;
};

export type CompensationAnchorEdge = "start" | "end";
/** Visible document used as the size-compensation anchor, in `getDocuments()` order. */
export type DocumentOrderAnchor = "first" | "last";
export type PreloadRangeMode = "visible-span" | "visual-edge" | "page-fill";

export type CapturedBlockScroll = {
    scrollLeft: number;
    scrollTop: number;
};

export type CapturedExtent = {
    width: number;
    height: number;
};

export type CapturedAnchorOffset = {
    offsetLeft: number;
    offsetTop: number;
};

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

export type IframeSizeInput = {
    iframe: HTMLIFrameElement;
    contentRoot: HTMLElement;
    body: HTMLElement | null;
    forceScroll: boolean;
    columnWidth: number;
    pageHeight: number;
    columnGap: number;
    parentContentHeight: number;
};

export type SizeRestoreSkipInput = {
    userScrollSettling: boolean;
    holdingAbsoluteLocate: boolean;
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
    /** Which visible document is the preload anchor. */
    readonly compensationAnchorEdge: CompensationAnchorEdge;
    /** Size-compensation anchor in document order. Page routes stay `first`. */
    readonly documentOrderAnchor: DocumentOrderAnchor;
    /** How far around the visible chapter(s) to keep loaded. */
    readonly preloadRangeMode: PreloadRangeMode;
    /** Rewrite wrapper `isVisible` from live rects (0-size placeholders are not visible). */
    readonly rewritesWrapperVisibility: boolean;
    /** Absolute locate still writes size compensation while user scroll is settling. */
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
    /** Logical block-axis scroll. X uses the scrollLeft sign; Y is scrollTop. */
    readLogicalScroll: (scrollElement: HTMLElement) => number;
    /** Captured block-axis scroll in the same logical space as `readLogicalScroll`. */
    readCapturedLogicalScroll: (scrollElement: HTMLElement, captured: CapturedBlockScroll) => number;
    /** Write a logical block-axis scroll back onto the element. */
    writeLogicalScroll: (scrollElement: HTMLElement, logical: number) => void;
    /** Wrapper growth along the scroll compensation axis. */
    measureBlockSizeDelta: (wrapper: HTMLElement | null | undefined, captured: CapturedExtent) => number;
    /** Anchor movement along the scroll compensation axis. */
    measureBlockOffsetDelta: (anchor: HTMLElement, captured: CapturedAnchorOffset) => number;
    /** Current page-axis translate, preferring `data-target-transform`. */
    readPageTransform: (transformContainer: HTMLElement) => number;
    /** Wrapper growth along the page-transform axis. */
    measurePageSizeDelta: (wrapper: HTMLElement | null | undefined, captured: CapturedExtent) => number;
    /** Anchor movement along the page-transform axis. */
    measurePageOffsetDelta: (anchor: HTMLElement, captured: CapturedAnchorOffset) => number;
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
    /** Initial iframe box. Each route owns this; do not branch on iframeGrow. */
    applyIframeFrame: (iframe: HTMLIFrameElement, forceScroll: boolean) => void;
    /** Grow the iframe to this route's content size. */
    sizeIframe: (input: IframeSizeInput) => void;
    /** Drop a size-compensation write. Absolute locate must still apply on scroll routes that opt in. */
    shouldSkipSizeRestore: (input: SizeRestoreSkipInput) => boolean;
    /** After a later content resize, capture-then-restore scroll with this route's restoreScroll. */
    readonly restoresScrollAfterResize: boolean;
};
