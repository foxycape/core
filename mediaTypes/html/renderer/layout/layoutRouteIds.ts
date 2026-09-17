export const LAYOUT_ROUTE_IDS = [
    "scroll-horizontal-tb-ltr",
    "scroll-horizontal-tb-rtl",
    "scroll-vertical-rl-ltr",
    "scroll-vertical-rl-rtl",
    "scroll-vertical-lr-ltr",
    "scroll-vertical-lr-rtl",
    "page-horizontal-tb-ltr",
    "page-horizontal-tb-rtl",
    "page-vertical-rl-ltr",
    "page-vertical-rl-rtl",
    "page-vertical-lr-ltr",
    "page-vertical-lr-rtl",
] as const;

export type LayoutRouteId = typeof LAYOUT_ROUTE_IDS[number];

export type RootDirectionClass = "dir-ltr" | "dir-rtl";
export type RendererLayoutClass = `layout-${LayoutRouteId}`;
export type ContentLayoutClass = `content-${LayoutRouteId}`;

export const ROOT_DIRECTION_CLASSES = ["dir-ltr", "dir-rtl"] as const;

export const RENDERER_LAYOUT_CLASSES = LAYOUT_ROUTE_IDS.map(
    (id) => `layout-${id}` as RendererLayoutClass
);

export const CONTENT_LAYOUT_CLASSES = LAYOUT_ROUTE_IDS.map(
    (id) => `content-${id}` as ContentLayoutClass
);

export const toRendererLayoutClass = (id: LayoutRouteId): RendererLayoutClass =>
    `layout-${id}`;

export const toContentLayoutClass = (id: LayoutRouteId): ContentLayoutClass =>
    `content-${id}`;
