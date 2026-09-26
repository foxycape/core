import type { ILayoutGeometry } from "./ILayoutGeometry";
import type { LayoutRouteId } from "../layoutRouteIds";
import { scrollHorizontalTbLtr } from "./scrollHorizontalTbLtr";
import { scrollHorizontalTbRtl } from "./scrollHorizontalTbRtl";
import { scrollVerticalRlLtr } from "./scrollVerticalRlLtr";
import { scrollVerticalRlRtl } from "./scrollVerticalRlRtl";
import { scrollVerticalLrLtr } from "./scrollVerticalLrLtr";
import { scrollVerticalLrRtl } from "./scrollVerticalLrRtl";
import { pageHorizontalTbLtr } from "./pageHorizontalTbLtr";
import { pageHorizontalTbRtl } from "./pageHorizontalTbRtl";
import { pageVerticalRlLtr } from "./pageVerticalRlLtr";
import { pageVerticalRlRtl } from "./pageVerticalRlRtl";
import { pageVerticalLrLtr } from "./pageVerticalLrLtr";
import { pageVerticalLrRtl } from "./pageVerticalLrRtl";

export const layoutGeometryById: Record<LayoutRouteId, ILayoutGeometry> = {
    "scroll-horizontal-tb-ltr": scrollHorizontalTbLtr,
    "scroll-horizontal-tb-rtl": scrollHorizontalTbRtl,
    "scroll-vertical-rl-ltr": scrollVerticalRlLtr,
    "scroll-vertical-rl-rtl": scrollVerticalRlRtl,
    "scroll-vertical-lr-ltr": scrollVerticalLrLtr,
    "scroll-vertical-lr-rtl": scrollVerticalLrRtl,
    "page-horizontal-tb-ltr": pageHorizontalTbLtr,
    "page-horizontal-tb-rtl": pageHorizontalTbRtl,
    "page-vertical-rl-ltr": pageVerticalRlLtr,
    "page-vertical-rl-rtl": pageVerticalRlRtl,
    "page-vertical-lr-ltr": pageVerticalLrLtr,
    "page-vertical-lr-rtl": pageVerticalLrRtl,
};

export { scrollHorizontalTbLtr } from "./scrollHorizontalTbLtr";
export { scrollHorizontalTbRtl } from "./scrollHorizontalTbRtl";
export { scrollVerticalRlLtr } from "./scrollVerticalRlLtr";
export { scrollVerticalRlRtl } from "./scrollVerticalRlRtl";
export { scrollVerticalLrLtr } from "./scrollVerticalLrLtr";
export { scrollVerticalLrRtl } from "./scrollVerticalLrRtl";
export { pageHorizontalTbLtr } from "./pageHorizontalTbLtr";
export { pageHorizontalTbRtl } from "./pageHorizontalTbRtl";
export { pageVerticalRlLtr } from "./pageVerticalRlLtr";
export { pageVerticalRlRtl } from "./pageVerticalRlRtl";
export { pageVerticalLrLtr } from "./pageVerticalLrLtr";
export { pageVerticalLrRtl } from "./pageVerticalLrRtl";
export type {
    AlignWrapperInput,
    CompensationAnchorEdge,
    CompensationAnchorMode,
    CompensationRect,
    CompensationRectSource,
    ILayoutGeometry,
    InitialScroll,
    LayoutAxis,
    LayoutSign,
    PageBox,
    PreloadRangeMode,
    RestoreScrollInput,
    ScrollLocateDeltaInput,
} from "./ILayoutGeometry";
export {
    alignWrapperNative,
    alignWrapperPassthrough,
    alignWrapperToVisualEnd,
    alwaysApplyRestoredScroll,
    compensationRectAlongX,
    compensationRectAlongY,
    getScrollLocateDelta,
    getScrollLocateDeltaAlongEnd,
    getScrollLocateDeltaAlongStart,
    isAtReadingStartScroll,
    passthroughRestoreScroll,
    excludeResizingCompensationDocument,
    pickAbsoluteCompensationUrl,
    pickVisibleCompensationDocument,
    resolveRestoreCompensationAnchor,
    pinReadingStartScroll,
    rejectPinnedStartScroll,
    restorePageTransformAlongEnd,
    restorePageTransformAlongStart,
    restoreScrollAlongEnd,
    restoreScrollAlongLeftAnchoredReverse,
    restoreScrollAlongStart,
    restoreScrollCapturedPlusSize,
} from "./restoreLayoutState";
export {
    detectScrollLeftSign,
    fromLogicalScrollLeft,
    resolveScrollLeftSign,
    toLogicalScrollLeft,
} from "./scrollLeftAxis";
export type { ScrollLeftSign } from "./scrollLeftAxis";
