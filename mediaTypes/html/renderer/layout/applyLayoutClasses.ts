import { HtmlSettings } from "../../HtmlSettings";
import type { ILayoutGeometry } from "./geometry/ILayoutGeometry";
import {
    CONTENT_LAYOUT_CLASSES,
    RENDERER_LAYOUT_CLASSES,
    ROOT_DIRECTION_CLASSES,
} from "./layoutRouteIds";

const LEGACY_RENDERER_LAYOUT_CLASSES = [
    HtmlSettings.WritingVerticalClassName,
    HtmlSettings.WritingVerticalRlClassName,
    HtmlSettings.WritingVerticalLrClassName,
    HtmlSettings.FlipScrollClassName,
    HtmlSettings.FlipPageClassName,
    HtmlSettings.RtlProgressionClassName,
    HtmlSettings.TransformPagesClassName,
] as const;

const LEGACY_CONTENT_LAYOUT_CLASSES = [
    HtmlSettings.DocumentPageModeCssName,
    HtmlSettings.DocumentVerticalPageModeCssName,
    HtmlSettings.RtlProgressionClassName,
    HtmlSettings.WritingVerticalScrollDocumentLayoutCssName,
] as const;

const replaceExclusiveClasses = (
    element: HTMLElement,
    nextClass: string,
    exclusiveClasses: readonly string[]
) => {
    for (const name of exclusiveClasses) {
        if (name != nextClass && element.classList.contains(name)) {
            element.classList.remove(name);
        }
    }
    element.classList.add(nextClass);
};

export const applyRootDirectionClass = (element: HTMLElement, geometry: ILayoutGeometry) => {
    replaceExclusiveClasses(element, geometry.rootClass, ROOT_DIRECTION_CLASSES);
};

export const applyRendererLayoutClass = (element: HTMLElement, geometry: ILayoutGeometry) => {
    replaceExclusiveClasses(element, geometry.rendererClass, [
        ...RENDERER_LAYOUT_CLASSES,
        ...LEGACY_RENDERER_LAYOUT_CLASSES,
    ]);
    element.style.setProperty("direction", geometry.direction);
};

export const applyContentLayoutClass = (element: HTMLElement, geometry: ILayoutGeometry) => {
    element.classList.add(HtmlSettings.DocumentLayoutCssName);
    replaceExclusiveClasses(element, geometry.contentClass, [
        ...CONTENT_LAYOUT_CLASSES,
        ...LEGACY_CONTENT_LAYOUT_CLASSES,
    ]);
};

export const rendererHasPageLayout = (element?: Element | null) =>
    !!element && Array.from(element.classList).some((name) => name.startsWith("layout-page-"));

export const rendererHasVerticalLayout = (element?: Element | null) =>
    !!element && Array.from(element.classList).some((name) => name.includes("-vertical-"));

export const resolveRendererFlipMode = (element?: Element | null) =>
    rendererHasPageLayout(element) ? "page" as const : "scroll" as const;
