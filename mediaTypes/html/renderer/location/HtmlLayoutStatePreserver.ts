import { LocationState } from "../../../../kernal";
import { parseNumber } from "../../../../kernal/common/number";
import { getElementByNameAndIndex } from "../../../../kernal/html/finder";
import { getTransformLength } from "../../../../kernal/html/style";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { getPageTranslateCss, resolveLayoutFlow } from "../layout/resolveLayoutFlow";

/**
 * Capture / restore viewport scroll and page-transform when a document's
 * wrapper size changes (load, unload, iframe min-size reset).
 */
export class HtmlLayoutStatePreserver {
    constructor(
        private readonly doc: IHtmlDocument,
        private readonly viewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly options: HtmlOptions
    ) {
    }

    capture(): LocationState {
        const renderer = this.doc.owner.getRenderer();
        const scrollElement = this.viewport.getScrollElement() ?? renderer?.getScrollElement();
        const transformContainer = this.getTransformContainer();
        const wrapper = this.doc.getWrapperContainer();
        const flow = resolveLayoutFlow(this.options);
        const anchor = this.findLocationAnchor();
        return {
            scrollLeft: scrollElement?.scrollLeft ?? 0,
            scrollTop: scrollElement?.scrollTop ?? 0,
            width: wrapper?.scrollWidth ?? 0,
            height: flow.flipMode == "page" && flow.pageAxis == "y"
                ? (wrapper?.scrollHeight ?? 0)
                : (wrapper?.offsetHeight ?? 0),
            transformLeft: transformContainer ? getTransformLength(transformContainer, "x") : 0,
            transformTop: transformContainer ? getTransformLength(transformContainer, "y") : 0,
            firstVisibleDocument: renderer?.getFirstVisibleDocument(),
            offsetLeft: anchor?.offsetLeft ?? 0,
            offsetTop: anchor?.offsetTop ?? 0,
            foundElement: !!anchor
        };
    }

    async restore(locationState: LocationState): Promise<void> {
        const renderer = this.doc.owner.getRenderer();
        if (!renderer || !locationState) {
            return;
        }

        const documents = renderer.getDocuments();
        const firstVisibleDocumentIndex = documents.indexOf(locationState.firstVisibleDocument);
        const currentIndex = documents.indexOf(this.doc);
        if (currentIndex < 0 || firstVisibleDocumentIndex < 0 || currentIndex > firstVisibleDocumentIndex) {
            return;
        }

        const flow = resolveLayoutFlow(this.options);
        if (flow.flipMode == "page") {
            await this.waitUntilPageTransformStable();
            this.restorePageTransform(locationState, currentIndex === firstVisibleDocumentIndex, flow.pageAxis);
            return;
        }
        this.restoreScroll(locationState, currentIndex === firstVisibleDocumentIndex, flow.blockAxis);
    }

    /**
     * Wait until an in-flight page-transform CSS transition finishes,
     * so subsequent size / column measurements are not taken mid-animation.
     */
    async waitUntilPageTransformStable(): Promise<void> {
        if (resolveLayoutFlow(this.options).flipMode != "page") {
            return;
        }
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        const deadline = Date.now() + 400;
        while (this.hasActiveTransformTransition(transformContainer)) {
            if (Date.now() >= deadline) {
                break;
            }
            await new Promise<void>((resolve) => {
                const cleanup = () => {
                    transformContainer.removeEventListener("transitionend", onTransitionEnd);
                    clearTimeout(tid);
                };
                const onTransitionEnd = (e: TransitionEvent) => {
                    if (e.target === transformContainer) {
                        cleanup();
                        resolve();
                    }
                };
                transformContainer.addEventListener("transitionend", onTransitionEnd);
                const tid = setTimeout(() => {
                    cleanup();
                    resolve();
                }, 120);
            });
        }
    }

    private restorePageTransform(locationState: LocationState, isFirstVisible: boolean, pageAxis: "x" | "y") {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        const targetTransform = transformContainer.getAttribute("data-target-transform");
        let currentTransform = 0;
        if (targetTransform) {
            currentTransform = parseNumber(targetTransform, 0, "parseFloat");
        }
        else {
            currentTransform = getTransformLength(transformContainer, pageAxis);
        }

        const wrapper = this.doc.getWrapperContainer();
        const flow = resolveLayoutFlow(this.options);
        const sizeDelta = pageAxis == "y"
            ? (wrapper?.scrollHeight ?? 0) - locationState.height
            : (wrapper?.scrollWidth ?? 0) - locationState.width;
        let newTransform = currentTransform + sizeDelta;

        if (isFirstVisible) {
            const anchor = this.findLocationAnchor();
            if (anchor && locationState.foundElement) {
                const offsetDelta = pageAxis == "y"
                    ? anchor.offsetTop - locationState.offsetTop
                    : anchor.offsetLeft - locationState.offsetLeft;
                newTransform = pageAxis == "x" && flow.isRtlProgression
                    ? currentTransform - offsetDelta
                    : currentTransform + offsetDelta;
            }
        }

        if (newTransform < 0) {
            newTransform = 0;
        }

        transformContainer.style.removeProperty("transition");
        transformContainer.setAttribute("data-target-transform", `${newTransform}`);
        const length = parseFloat(newTransform.toFixed(10));
        transformContainer.style.transform = getPageTranslateCss(length, pageAxis, flow.pageSign);
    }

    private restoreScroll(locationState: LocationState, isFirstVisible: boolean, blockAxis: "x" | "y") {
        const renderer = this.doc.owner.getRenderer();
        const scrollElement = this.viewport.getScrollElement() ?? renderer?.getScrollElement();
        if (!scrollElement) {
            return;
        }

        const wrapper = this.doc.getWrapperContainer();
        const sizeDelta = blockAxis == "x"
            ? (wrapper?.scrollWidth ?? 0) - locationState.width
            : (wrapper?.offsetHeight ?? 0) - locationState.height;
        let nextScroll = (blockAxis == "x" ? locationState.scrollLeft : locationState.scrollTop) + sizeDelta;

        if (isFirstVisible) {
            const anchor = this.findLocationAnchor();
            if (anchor && locationState.foundElement) {
                const offsetDelta = blockAxis == "x"
                    ? anchor.offsetLeft - locationState.offsetLeft
                    : anchor.offsetTop - locationState.offsetTop;
                nextScroll = (blockAxis == "x" ? locationState.scrollLeft : locationState.scrollTop) + offsetDelta;
            }
        }

        if (nextScroll < 0) {
            nextScroll = 0;
        }

        if (blockAxis == "x") {
            scrollElement.scrollTo({ left: nextScroll, top: scrollElement.scrollTop });
        }
        else {
            scrollElement.scrollTo({ left: scrollElement.scrollLeft, top: nextScroll });
        }
    }

    private findLocationAnchor(): HTMLElement | null {
        const currentLocation = this.doc.owner.context.currentLocation;
        const contentContainer = this.doc.getContentContainer();
        if (!contentContainer || !currentLocation?.precise || !currentLocation.tagName || currentLocation.tagIndex == null) {
            return null;
        }
        const target = getElementByNameAndIndex(contentContainer, currentLocation.tagName, currentLocation.tagIndex);
        return target instanceof HTMLElement ? target : null;
    }

    private getTransformContainer(): HTMLElement | null {
        try {
            const el = this.viewport.getRendererContainer()?.querySelector("." + HtmlSettings.TransformContainerCssName);
            return el instanceof HTMLElement ? el : null;
        }
        catch {
            return null;
        }
    }

    private hasActiveTransformTransition(transformContainer: HTMLElement): boolean {
        const getAnimations = (transformContainer as HTMLElement & {
            getAnimations?: (opts?: { subtree?: boolean }) => Animation[];
        }).getAnimations;
        if (typeof getAnimations !== "function") {
            return false;
        }
        for (const animation of getAnimations.call(transformContainer, { subtree: false })) {
            if (animation.playState === "running" || animation.playState === "pending") {
                return true;
            }
        }
        return false;
    }
}
