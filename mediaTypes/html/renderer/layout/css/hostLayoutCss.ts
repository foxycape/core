import documentDefaultCss from "./document-default.css?raw";
import documentPageHorizontalTbLtrCss from "./document-content-page-horizontal-tb-ltr.css?raw";
import documentPageHorizontalTbRtlCss from "./document-content-page-horizontal-tb-rtl.css?raw";
import documentPageVerticalLrLtrCss from "./document-content-page-vertical-lr-ltr.css?raw";
import documentPageVerticalLrRtlCss from "./document-content-page-vertical-lr-rtl.css?raw";
import documentPageVerticalRlLtrCss from "./document-content-page-vertical-rl-ltr.css?raw";
import documentPageVerticalRlRtlCss from "./document-content-page-vertical-rl-rtl.css?raw";
import documentScrollHorizontalTbRtlCss from "./document-content-scroll-horizontal-tb-rtl.css?raw";
import documentScrollVerticalLrLtrCss from "./document-content-scroll-vertical-lr-ltr.css?raw";
import documentScrollVerticalLrRtlCss from "./document-content-scroll-vertical-lr-rtl.css?raw";
import documentScrollVerticalRlLtrCss from "./document-content-scroll-vertical-rl-ltr.css?raw";
import documentScrollVerticalRlRtlCss from "./document-content-scroll-vertical-rl-rtl.css?raw";
import rendererDefaultCss from "./renderer-default.css?raw";
import rendererPageHorizontalTbLtrCss from "./renderer-layout-page-horizontal-tb-ltr.css?raw";
import rendererPageHorizontalTbRtlCss from "./renderer-layout-page-horizontal-tb-rtl.css?raw";
import rendererPageVerticalLrLtrCss from "./renderer-layout-page-vertical-lr-ltr.css?raw";
import rendererPageVerticalLrRtlCss from "./renderer-layout-page-vertical-lr-rtl.css?raw";
import rendererPageVerticalRlLtrCss from "./renderer-layout-page-vertical-rl-ltr.css?raw";
import rendererPageVerticalRlRtlCss from "./renderer-layout-page-vertical-rl-rtl.css?raw";
import rendererScrollHorizontalTbRtlCss from "./renderer-layout-scroll-horizontal-tb-rtl.css?raw";
import rendererScrollVerticalLrLtrCss from "./renderer-layout-scroll-vertical-lr-ltr.css?raw";
import rendererScrollVerticalLrRtlCss from "./renderer-layout-scroll-vertical-lr-rtl.css?raw";
import rendererScrollVerticalRlLtrCss from "./renderer-layout-scroll-vertical-rl-ltr.css?raw";
import rendererScrollVerticalRlRtlCss from "./renderer-layout-scroll-vertical-rl-rtl.css?raw";
import rootDirectionCss from "./root-direction.css?raw";

export const HOST_LAYOUT_CSS = [
    rootDirectionCss,
    rendererDefaultCss,
    rendererScrollHorizontalTbRtlCss,
    rendererScrollVerticalRlLtrCss,
    rendererScrollVerticalRlRtlCss,
    rendererScrollVerticalLrLtrCss,
    rendererScrollVerticalLrRtlCss,
    rendererPageHorizontalTbLtrCss,
    rendererPageHorizontalTbRtlCss,
    rendererPageVerticalRlLtrCss,
    rendererPageVerticalRlRtlCss,
    rendererPageVerticalLrLtrCss,
    rendererPageVerticalLrRtlCss,
].join("\n");

export const DOCUMENT_LAYOUT_CSS = [
    documentDefaultCss,
    documentScrollHorizontalTbRtlCss,
    documentScrollVerticalRlLtrCss,
    documentScrollVerticalRlRtlCss,
    documentScrollVerticalLrLtrCss,
    documentScrollVerticalLrRtlCss,
    documentPageHorizontalTbLtrCss,
    documentPageHorizontalTbRtlCss,
    documentPageVerticalRlLtrCss,
    documentPageVerticalRlRtlCss,
    documentPageVerticalLrLtrCss,
    documentPageVerticalLrRtlCss,
].join("\n");
