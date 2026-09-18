import type { ViewportProfile } from "./geometry/ILayoutGeometry";

export type ContentWrapperMinWidthSizes = {
    shadowWidth: number;
    columnWidth: number;
    columnGap: number;
    viewportWidth: number;
};

export const resolveContentWrapperMinWidth = (
    mode: ViewportProfile["contentWrapperMinWidthMode"],
    sizes: ContentWrapperMinWidthSizes,
): string => {
    if (mode == "0") {
        return "0";
    }
    if (mode == "shadow") {
        return sizes.shadowWidth + "px";
    }
    if (mode == "viewport") {
        return sizes.viewportWidth + "px";
    }
    return (sizes.columnWidth + sizes.columnGap / 2) + "px";
};
