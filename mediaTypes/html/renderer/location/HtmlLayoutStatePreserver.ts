import { LocationState } from "../../../../kernal";
import { getElementByNameAndIndex } from "../../../../kernal/html/finder";
import { isHtmlElement } from "../../../../kernal/html/realm";
import { resolveVisibleTranslationAnchor } from "../../../../kernal/html/translationAnchor";
import { getTransformLength } from "../../../../kernal/html/style";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { getLayoutGeometry } from "../layout/resolveLayoutRoute";
import { isAtReadingStartScroll } from "../layout/geometry/restoreLayoutState";
import { beginProgrammaticScroll, endProgrammaticScroll, isHoldingAbsoluteAnchor, isUserScrollSettling } from "./scrollActivity";

const SCROLL_WRITE_THRESHOLD = 1;

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
        const geometry = getLayoutGeometry(this.options);
        const anchor = this.findLocationAnchor();
        const extent = wrapper ? geometry.getCaptureExtent(wrapper) : { width: 0, height: 0 };
        const state= {
            scrollLeft: scrollElement?.scrollLeft ?? 0,
            scrollTop: scrollElement?.scrollTop ?? 0,
            width: extent.width,
            height: extent.height,
            transformLeft: transformContainer ? getTransformLength(transformContainer, "x") : 0,
            transformTop: transformContainer ? getTransformLength(transformContainer, "y") : 0,
            firstVisibleDocument: geometry.documentOrderAnchor == "last"
                ? renderer?.getLastVisibleDocument()
                : renderer?.getFirstVisibleDocument(),
            offsetLeft: anchor?.offsetLeft ?? 0,
            offsetTop: anchor?.offsetTop ?? 0,
            foundElement: !!anchor
        };
        // const visibleDocuments = renderer?.getVisibleDocuments();
        // console.log('visible documents', visibleDocuments?.map(doc => doc.url))
        // console.log('capture location state', state.firstVisibleDocument?.url,"current url",this.doc.url)
        return state
    }

 async restore(locationState: LocationState): Promise<void> {
        const renderer = this.doc.owner.getRenderer();
        if (!renderer || !locationState) {
            return;
        }

        const documents = renderer.getDocuments();
        const currentIndex = documents.indexOf(this.doc);
        if (currentIndex < 0) {
            return;
        }

        const geometry = getLayoutGeometry(this.options);
        const anchorIndex = documents.indexOf(locationState.firstVisibleDocument);
        if (anchorIndex < 0) {
            return;
        }
        if (geometry.flipMode == "page") {
            if (currentIndex > anchorIndex) {
                return;
            }
            await this.waitUntilPageTransformStable();
            this.restorePageTransform(locationState, currentIndex === anchorIndex);
            return;
        }
        this.clearPageTransformIfNeeded();
        this.restoreScroll(locationState, currentIndex, anchorIndex);
        // console.log('restore scroll', locationState.firstVisibleDocument?.url,"current url",this.doc.url, locationState.scrollLeft)
        
    }

    /**
     * Wait until an in-flight page-transform CSS transition finishes,
     * so subsequent size / column measurements are not taken mid-animation.
     */
    async waitUntilPageTransformStable(): Promise<void> {
        if (getLayoutGeometry(this.options).flipMode != "page") {
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

    private restorePageTransform(locationState: LocationState, isFirstVisible: boolean) {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        const geometry = getLayoutGeometry(this.options);
        const currentTransform = geometry.readPageTransform(transformContainer);
        const wrapper = this.doc.getWrapperContainer();
        const sizeDelta = geometry.measurePageSizeDelta(wrapper, locationState);
        let offsetDelta = 0;
        const anchor = isFirstVisible ? this.findLocationAnchor() : null;
        if (anchor && locationState.foundElement) {
            offsetDelta = geometry.measurePageOffsetDelta(anchor, locationState);
        }
        const newTransform = geometry.restorePageTransform({
            currentTransform,
            sizeDelta,
            offsetDelta,
            isFirstVisible,
            foundElement: !!(anchor && locationState.foundElement),
        });

        transformContainer.style.removeProperty("transition");
        transformContainer.setAttribute("data-target-transform", `${newTransform}`);
        transformContainer.style.transform = geometry.getPageTranslateCss(newTransform);
    }

    private restoreScroll(
        locationState: LocationState,
        currentIndex: number,
        anchorIndex: number,
    ) {
        const renderer = this.doc.owner.getRenderer();
        const scrollElement = this.viewport.getScrollElement() ?? renderer?.getScrollElement();
        if (!scrollElement) {
            return;
        }

        const wrapper = this.doc.getWrapperContainer();
        const geometry = getLayoutGeometry(this.options);
        if (geometry.shouldSkipSizeRestore({
            userScrollSettling: isUserScrollSettling(),
            holdingAbsoluteLocate: isHoldingAbsoluteAnchor(),
        })) {
            return;
        }
        const liveScroll = geometry.readLogicalScroll(scrollElement);
        const capturedScroll = geometry.readCapturedLogicalScroll(scrollElement, locationState);
        const scrollExtent = geometry.blockAxis == "x" ? scrollElement.scrollWidth : scrollElement.scrollHeight;
        const clientLength = geometry.blockAxis == "x" ? scrollElement.clientWidth : scrollElement.clientHeight;
        const sizeDelta = geometry.measureBlockSizeDelta(wrapper, locationState);
        let offsetDelta = 0;
        const locationAnchor = currentIndex === anchorIndex ? this.findLocationAnchor() : null;
        const foundElement = !!(locationAnchor && locationState.foundElement);
        if (foundElement && locationAnchor) {
            offsetDelta = geometry.measureBlockOffsetDelta(locationAnchor, locationState);
        }
        const nextLogical = geometry.restoreScroll({
            liveScroll,
            capturedScroll,
            sizeDelta,
            offsetDelta,
            foundElement,
            currentIndex,
            anchorIndex,
            atReadingStart: isAtReadingStartScroll({
                liveScroll,
                scrollExtent,
                clientLength,
                initialScroll: geometry.initialScroll,
            }),
        });

        if (Math.abs(nextLogical - liveScroll) <= SCROLL_WRITE_THRESHOLD) {
            return;
        }
        if (!geometry.shouldApplyRestoredScroll(nextLogical, liveScroll)) {
            return;
        }

        beginProgrammaticScroll();
        try {
            geometry.writeLogicalScroll(scrollElement, nextLogical);
        }
        finally {
            endProgrammaticScroll();
        }
    }

    private findLocationAnchor(): HTMLElement | null {
        const currentLocation = this.doc.owner.context.currentLocation;
        const contentContainer = this.doc.getContentContainer();
        if (!contentContainer || !currentLocation?.precise || !currentLocation.tagName || currentLocation.tagIndex == null) {
            return null;
        }
        const target = getElementByNameAndIndex(contentContainer, currentLocation.tagName, currentLocation.tagIndex);
        return resolveVisibleTranslationAnchor(target);
    }

    private clearPageTransformIfNeeded() {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        transformContainer.style.removeProperty("transition");
        transformContainer.style.removeProperty("transform");
        transformContainer.removeAttribute("data-target-transform");
    }

    private getTransformContainer(): HTMLElement | null {
        try {
            const el = this.viewport.getRendererContainer()?.querySelector("." + HtmlSettings.TransformContainerCssName);
            return isHtmlElement(el) ? el : null;
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
