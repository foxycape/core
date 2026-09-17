import type { Direction, FlipMode, WritingMode } from "../../../../kernal";
import { resolveTextDirectionFromLanguage } from "../../../../kernal/i18n/textDirection";
import type { HtmlOptions } from "../../HtmlOptions";
import { layoutGeometryById } from "./geometry";
import type { ILayoutGeometry } from "./geometry/ILayoutGeometry";
import type { LayoutRouteId } from "./layoutRouteIds";

export type LayoutOptions = Pick<
    HtmlOptions,
    "writingMode" | "direction" | "flipMode" | "forceScroll" | "documentLanguage" | "rtlLanguages"
>;

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

export const resolveLayoutRouteId = (htmlOptions: LayoutOptions): LayoutRouteId => {
    const writingMode = htmlOptions.writingMode ?? "horizontal-tb";
    const direction = resolveHtmlTextDirection(htmlOptions);
    const flipMode: FlipMode = htmlOptions.forceScroll ? "scroll" : (htmlOptions.flipMode ?? "scroll");
    return `${flipMode}-${writingMode}-${direction}`;
};

export const getLayoutGeometry = (htmlOptions: LayoutOptions): ILayoutGeometry =>
    layoutGeometryById[resolveLayoutRouteId(htmlOptions)];

export const resolveLayoutRoute = getLayoutGeometry;
