import { LocationState } from "../../../../kernal";
import { parseNumber } from "../../../../kernal/common/number";
import { getElementByNameAndIndex } from "../../../../kernal/html/finder";
import { isHtmlElement } from "../../../../kernal/html/realm";
import { resolveVisibleTranslationAnchor } from "../../../../kernal/html/translationAnchor";
import { getTransformLength } from "../../../../kernal/html/style";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import {
    excludeResizingCompensationDocument,
    pickAbsoluteCompensationUrl,
    pickVisibleCompensationDocument,
    resolveRestoreCompensationAnchor,
} from "../layout/geometry/restoreLayoutState";
import { getLayoutGeometry } from "../layout/resolveLayoutRoute";
import { fromLogicalScrollLeft, resolveScrollLeftSign, toLogicalScrollLeft } from "../layout/geometry/scrollLeftAxis";
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
        return {
            scrollLeft: scrollElement?.scrollLeft ?? 0,
            scrollTop: scrollElement?.scrollTop ?? 0,
            width: extent.width,
            height: extent.height,
            transformLeft: transformContainer ? getTransformLength(transformContainer, "x") : 0,
            transformTop: transformContainer ? getTransformLength(transformContainer, "y") : 0,
            firstVisibleDocument: this.resolveCompensationAnchor() ?? renderer?.getFirstVisibleDocument(),
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
        const currentIndex = documents.indexOf(this.doc);
        if (currentIndex < 0) {
            return;
        }

        const geometry = getLayoutGeometry(this.options);
        if (geometry.flipMode == "page") {
            const firstVisibleDocumentIndex = documents.indexOf(locationState.firstVisibleDocument);
            if (firstVisibleDocumentIndex < 0 || currentIndex > firstVisibleDocumentIndex) {
                return;
            }
            await this.waitUntilPageTransformStable();
            this.restorePageTransform(locationState, currentIndex === firstVisibleDocumentIndex, geometry.pageAxis);
            return;
        }
        const liveHold = geometry.holdsAbsoluteLocate && isHoldingAbsoluteAnchor()
            ? this.resolveCompensationAnchor()
            : undefined;
        const anchorDoc = resolveRestoreCompensationAnchor(
            locationState.firstVisibleDocument,
            liveHold,
            !!(geometry.holdsAbsoluteLocate && isHoldingAbsoluteAnchor()),
        );
        const anchorIndex = documents.indexOf(anchorDoc);
        if (anchorIndex < 0) {
            return;
        }
        this.clearPageTransformIfNeeded();
        this.restoreScroll(locationState, currentIndex, anchorIndex, geometry.blockAxis);
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
        const geometry = getLayoutGeometry(this.options);
        const sizeDelta = pageAxis == "y"
            ? (wrapper?.scrollHeight ?? 0) - locationState.height
            : (wrapper?.scrollWidth ?? 0) - locationState.width;
        let offsetDelta = 0;
        const anchor = isFirstVisible ? this.findLocationAnchor() : null;
        if (anchor && locationState.foundElement) {
            offsetDelta = pageAxis == "y"
                ? anchor.offsetTop - locationState.offsetTop
                : anchor.offsetLeft - locationState.offsetLeft;
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
        blockAxis: "x" | "y"
    ) {
        const renderer = this.doc.owner.getRenderer();
        const scrollElement = this.viewport.getScrollElement() ?? renderer?.getScrollElement();
        if (!scrollElement) {
            return;
        }

        const wrapper = this.doc.getWrapperContainer();
        const geometry = getLayoutGeometry(this.options);
        if (geometry.skipsRestoreWhileSettling && isUserScrollSettling()) {
            return;
        }
        const liveScrollRaw = blockAxis == "x" ? scrollElement.scrollLeft : scrollElement.scrollTop;
        const capturedScrollRaw = blockAxis == "x" ? locationState.scrollLeft : locationState.scrollTop;
        const scrollSign = blockAxis == "x" ? resolveScrollLeftSign(scrollElement) : 1;
        const liveScroll = toLogicalScrollLeft(liveScrollRaw, scrollSign);
        const capturedScroll = toLogicalScrollLeft(capturedScrollRaw, scrollSign);
        const sizeDelta = blockAxis == "x"
            ? (wrapper?.scrollWidth ?? 0) - locationState.width
            : (wrapper?.offsetHeight ?? 0) - locationState.height;
        let offsetDelta = 0;
        const locationAnchor = currentIndex === anchorIndex ? this.findLocationAnchor() : null;
        const foundElement = !!(locationAnchor && locationState.foundElement);
        if (foundElement && locationAnchor) {
            offsetDelta = blockAxis == "x"
                ? locationAnchor.offsetLeft - locationState.offsetLeft
                : locationAnchor.offsetTop - locationState.offsetTop;
        }
        const nextLogical = geometry.restoreScroll({
            liveScroll,
            capturedScroll,
            sizeDelta,
            offsetDelta,
            foundElement,
            currentIndex,
            anchorIndex,
        });
        const nextScroll = fromLogicalScrollLeft(nextLogical, scrollSign);

        if (Math.abs(nextScroll - liveScrollRaw) <= SCROLL_WRITE_THRESHOLD) {
            return;
        }
        if (!geometry.shouldApplyRestoredScroll(nextLogical, liveScroll)) {
            return;
        }

        beginProgrammaticScroll();
        try {
            if (blockAxis == "x") {
                scrollElement.scrollTo({ left: nextScroll, top: scrollElement.scrollTop });
            }
            else {
                scrollElement.scrollTo({ left: scrollElement.scrollLeft, top: nextScroll });
            }
        }
        finally {
            endProgrammaticScroll();
        }
    }

    /**
     * Absolute jumps (TOC) hold currentLocation.url as the size-compensation
     * anchor until the user scrolls, so later neighbor load/dispose cannot
     * retarget the visually first/last chapter.
     */
    private resolveCompensationAnchor() {
        const renderer = this.doc.owner.getRenderer();
        if (!renderer) {
            return undefined;
        }
        const geometry = getLayoutGeometry(this.options);
        if (geometry.compensationAnchorMode == "first-visible") {
            const location = this.doc.owner.context.currentLocation;
            if (location?.direction == "next" || location?.direction == "previous") {
                return renderer.getFirstVisibleDocument();
            }
            const redirectUrl = this.doc.owner.context.redirectingDocUrl;
            if (redirectUrl) {
                return renderer.getDocument(redirectUrl) ?? renderer.getFirstVisibleDocument();
            }
            return renderer.getFirstVisibleDocument();
        }
        const location = this.doc.owner.context.currentLocation;
        const absoluteUrl = pickAbsoluteCompensationUrl({
            direction: location?.direction,
            currentLocationUrl: location?.url,
            redirectingDocUrl: this.doc.owner.context.redirectingDocUrl,
            holdAbsoluteAnchor: isHoldingAbsoluteAnchor(),
        });
        if (absoluteUrl) {
            return renderer.getDocument(absoluteUrl) ?? this.pickVisibleCompensation();
        }
        return this.pickVisibleCompensation();
    }

    private pickVisibleCompensation() {
        const renderer = this.doc.owner.getRenderer();
        if (!renderer) {
            return undefined;
        }
        const geometry = getLayoutGeometry(this.options);
        const visible = excludeResizingCompensationDocument(renderer.getVisibleDocuments(), this.doc);
        return pickVisibleCompensationDocument(visible, geometry.compensationAnchorEdge, (doc) => {
            const rect = doc.getWrapperContainer()?.getBoundingClientRect();
            if (!rect) {
                return undefined;
            }
            return geometry.getCompensationRect(rect);
        }) ?? renderer.getFirstVisibleDocument();
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
