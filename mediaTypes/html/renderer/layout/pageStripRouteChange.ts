import { isHtmlElement } from "../../../../kernal/html/realm";
import { HtmlSettings } from "../../HtmlSettings";

export const LAYOUT_ROUTE_RESIZE_QUIET_MS = 500;
const QUIET_UNTIL_ATTRIBUTE = "data-layout-route-quiet-until";

const getTransformContainer = (rendererContainer: HTMLElement) => {
    const element = rendererContainer.querySelector("." + HtmlSettings.TransformContainerCssName);
    return isHtmlElement(element) ? element : null;
};

export const markLayoutRouteChangeQuiet = (
    rendererContainer: HTMLElement,
    quietMs = LAYOUT_ROUTE_RESIZE_QUIET_MS
) => {
    rendererContainer.setAttribute(QUIET_UNTIL_ATTRIBUTE, `${Date.now() + quietMs}`);
};

export const shouldIgnoreResizeAfterRouteChange = (rendererContainer: HTMLElement) => {
    const until = Number.parseInt(rendererContainer.getAttribute(QUIET_UNTIL_ATTRIBUTE) ?? "", 10);
    return Number.isFinite(until) && Date.now() < until;
};

export const waitForPageStripPaint = () => {
    if (typeof requestAnimationFrame != "function") {
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
};

/**
 * Direction / writing-mode swaps reverse the page strip and flip translate sign.
 * Measuring after the class change forces a reflow with the old signed transform
 * still applied, which paints one wrong frame and leaves a stale compositor layer.
 */
export const freezePageStripForRouteChange = (rendererContainer: HTMLElement) => {
    const transformContainer = getTransformContainer(rendererContainer);
    if (!transformContainer) {
        return;
    }
    markLayoutRouteChangeQuiet(rendererContainer);
    transformContainer.style.transition = "none";
    transformContainer.style.removeProperty("will-change");
    transformContainer.removeAttribute(HtmlSettings.PageMovingAttributeName);
    transformContainer.setAttribute(HtmlSettings.LayoutSwitchingAttributeName, "true");
    transformContainer.style.transform = "translate3d(0px,0,0)";
    transformContainer.setAttribute("data-target-transform", "0");
};

export const unfreezePageStripForRouteChange = (rendererContainer: HTMLElement) => {
    const transformContainer = getTransformContainer(rendererContainer);
    if (!transformContainer) {
        return;
    }
    transformContainer.removeAttribute(HtmlSettings.LayoutSwitchingAttributeName);
    transformContainer.style.removeProperty("transition");
    markLayoutRouteChangeQuiet(rendererContainer);
};
