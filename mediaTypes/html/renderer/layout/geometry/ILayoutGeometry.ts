import type { Direction, FlipMode, WritingMode } from "../../../../../kernal";
import type {
    ContentLayoutClass,
    LayoutRouteId,
    RendererLayoutClass,
    RootDirectionClass,
} from "../layoutRouteIds";

export type LayoutAxis = "x" | "y";
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
    contentWrapperMinWidthMode: "0" | "shadow" | "column";
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

export type PageNumberFromPointInput = {
    axisOffset: number;
    pageMoveLength: number;
    pageLength: number;
    numberOfPages: number;
};

export type ILayoutGeometry = {
    readonly id: LayoutRouteId;
    readonly writingMode: WritingMode;
    readonly direction: Direction;
    readonly flipMode: FlipMode;
    readonly rootClass: RootDirectionClass;
    readonly rendererClass: RendererLayoutClass;
    readonly contentClass: ContentLayoutClass;
    readonly blockAxis: LayoutAxis;
    readonly blockSign: LayoutSign;
    readonly pageAxis: LayoutAxis;
    readonly pageSign: LayoutSign;
    readonly iframeGrow: IframeGrow;
    readonly overflowX: OverflowMode;
    readonly overflowY: OverflowMode;
    readonly initialScroll: InitialScroll;
    readonly useColumnLayout: boolean;
    readonly isVerticalWriting: boolean;
    readonly measureColumnsAsLtr: boolean;
    readonly usesRtlPageStart: boolean;
    readonly viewport: ViewportProfile;

    getPageStartOffset: (box: PageBox) => number;
    getPageTransformOffset: (box: PageBox, pageNumber: number, pageMoveLength: number) => number;
    getPageTranslateCss: (length: number) => string;
    getSignedTranslateLength: (length: number) => number;
    getLastContentExtent: (lastWrapper: HTMLElement, transformContainer: HTMLElement) => number;
    getDocumentPageStartOffset: (
        wrapper: HTMLElement | undefined,
        pageBox: PageBox & { startOffset: number }
    ) => number;
    getPageMoveLength: (pageBoxWidth: number, pageHeight: number, columnGap: number) => number;
    getColumnWidthForCss: (columnWidth: number, pageHeight: number) => number;
    getCaptureExtent: (wrapper: HTMLElement) => { width: number; height: number };
    restorePageTransform: (input: RestorePageTransformInput) => number;
    getLocateAxisOffset: (
        rect: { left: number; top: number },
        translateX: number,
        translateY: number
    ) => number;
    getPageBoxLength: (metrics: { pageWidth: number; pageHeight: number }) => number;
    getOccupiedLength: (iframe: HTMLElement | undefined, documentElement: HTMLElement) => number;
    getPageNumberFromPoint: (input: PageNumberFromPointInput) => number;
};
