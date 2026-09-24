import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { parseNumber } from "../../../../kernal/common/number";
import { compareTagName } from "../../../../kernal/html/finder";
import { emptyElement } from "../../../../kernal/html/dom";
import { createRange } from "../../../../kernal/html/selection";
import { getLocateClientRect, getLocateElement, isDomRange, type LocateTarget } from "../../../../kernal/html/geometry";
import { scrollElementIntoView, getTransformLength } from "../../../../kernal/html/style";
import { FileLocation, IFileParser, ILogger, SpineFile, STTAG, asyncDebounce, BrowserCapabilities, yieldToMain } from "../../../../kernal";
import type { Reader } from "../../../../kernal/Reader";
import { HtmlSettings } from "../../HtmlSettings";
import { BaseDocumentsProvider } from "../../../base/renderer/BaseDocumentsProvider";
import { HtmlDocument } from "../document/HtmlDocument";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlDocumentsPreloader } from "./HtmlDocumentsPreloader";
import { HtmlDocumentsIntersectionObserver } from "./HtmlDocumentsIntersectionObserver";
import { HtmlElementLocator } from "../location/HtmlElementLocator";
import { IHtmlDocumentsProvider } from "../IHtmlDocumentsProvider";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { HtmlRendererViewport } from "../layout/HtmlRendererViewport";
import { IHtmlDocumentsPreloader } from "./IHtmlDocumentsPreloader";
import { IHtmlElementLocator } from "../location/IHtmlElementLocator";
import { getLayoutGeometry } from "../layout/resolveLayoutRoute";
import { getLayoutOffsetLeft } from "../layout/geometry/getLayoutOffsetLeft";
import { remapStoredPageNumber } from "../location/remapStoredPageNumber";
import { beginAbsoluteLocate, shouldBeginAbsoluteLocate } from "../location/scrollActivity";

/**
 * HTML documents provider.
 */
export class HtmlDocumentsProvider extends BaseDocumentsProvider<IHtmlDocument> implements IHtmlDocumentsProvider {
    protected logger: ILogger;
    private isInit: boolean = false;
    private isFirstLoad: boolean = true;
    private loadingDoc: IHtmlDocument;
    private readonly documentsIntersectionObserver: HtmlDocumentsIntersectionObserver;
    private readonly documentPreloader: IHtmlDocumentsPreloader;
    protected readonly rendererViewport: IRendererViewport<HtmlLayoutMetrics>;
    private readonly elementLocator: IHtmlElementLocator;
    private hangTasks: (() => Promise<void>)[] = [];
    constructor(
        owner: Reader,
        fileParser: IFileParser,
        protected readonly readerContainer: HTMLElement,
        public readonly htmlOptions: HtmlOptions
    ) {
        super(owner, fileParser);
        htmlOptions.documentLanguage = owner.context?.metadata?.language;
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);
        this.elementLocator = new HtmlElementLocator(this);
        this.rendererViewport = new HtmlRendererViewport(owner, this.readerContainer, this.owner.optionsProvider, htmlOptions);
        this.documentsIntersectionObserver = new HtmlDocumentsIntersectionObserver(this);
        this.documentPreloader = new HtmlDocumentsPreloader(this.owner.events, this, () => this.loadingDoc, htmlOptions);
    }

    private getTransformContainer(): HTMLElement {
        return this.getRendererContainer().querySelector('.' + HtmlSettings.TransformContainerCssName) as HTMLElement;
    }

    override getRendererContainer(): HTMLElement {
        return this.rendererViewport.getRendererContainer();
    }

    override getScrollElement(): HTMLElement {
        return this.rendererViewport.getScrollElement();
    }

    getLoadingDocument(): IHtmlDocument {
        return this.loadingDoc;
    }

    override getLoadedDocuments(): IHtmlDocument[] {
        return this.getDocuments().filter(doc => doc.getLoadStatus() == "success");
    }

    override getVisibleDocuments(): IHtmlDocument[] {
        return this.getDocuments().filter(doc => doc.getWrapperContainer()?.isVisible);
    }

    override getFirstVisibleDocument(containVisibleElements?: boolean): IHtmlDocument {
        const visible = this.getVisibleDocuments();
        if (containVisibleElements) {
            const withElements = visible.find(doc => doc.getVisibleElements(true).length > 0);
            if (withElements) {
                return withElements;
            }
        }
        if (visible[0]) {
            return visible[0];
        }
        const currentUrl = this.owner.context.currentLocation?.url;
        return (currentUrl && this.getDocument(currentUrl)) || this.getDocuments()[0] || null;
    }

    override getLastVisibleDocument(containVisibleElements?: boolean): IHtmlDocument {
        const visible = this.getVisibleDocuments();
        if (containVisibleElements) {
            const withElements = [...visible].reverse().find(doc => doc.getVisibleElements().length > 0);
            if (withElements) {
                return withElements;
            }
        }
        if (visible.length > 0) {
            return visible[visible.length - 1];
        }
        const currentUrl = this.owner.context.currentLocation?.url;
        const documents = this.getDocuments();
        return (currentUrl && this.getDocument(currentUrl)) || documents[documents.length - 1] || null;
    }

    override async createDocument(documentContainer: HTMLElement, spineFile: SpineFile, fileIndex: number): Promise<IHtmlDocument> {
        return new HtmlDocument(this.owner, this.rendererViewport, this.fileParser, documentContainer, spineFile, this.htmlOptions);
    }

    /**
     * Initialize each document container.
     */
    protected override async initialize(documentsWrapper: HTMLElement) {
        this.rendererViewport.applyCssVariables();
        await super.initialize(documentsWrapper);
        const documents = this.getDocuments();
        for (const doc of documents) {
            doc.getWrapperContainer().classList.add(HtmlSettings.FileContentContainerClassName, HtmlSettings.FileContentContainerHeightClassName);
        }
    }

    override async load(location?: FileLocation, isReload?: boolean): Promise<void> {
        this.htmlOptions.documentLanguage = this.owner.context?.metadata?.language;
        if (!this.isInit) {
            await this.initialize(this.getTransformContainer());
            this.documentsIntersectionObserver.register();
            this.isInit = true;
        }
        if (location?.storeCurrent) {
            await this.owner.onBeforeRedirect?.(this);
        }
        isReload = isReload ?? false;
        const url = location?.url;
        let doc = this.getDocument(url);
        if (!doc) {
            const documents = this.getDocuments();
            doc = documents[0];
            if (documents.length > 1 || !location) {
                location = new FileLocation(doc.url, 1, 'ratio');
                location.current = 0;
            }
        }

        if (getLayoutGeometry(this.htmlOptions).flipMode == "page") {
            this.appendPageStyles();
        }
        else {
            this.removePageStyles();
        }
        this.loadingDoc = doc;
        this.owner.context.redirectingDocUrl = doc.url;
        if (shouldBeginAbsoluteLocate(location?.direction, getLayoutGeometry(this.htmlOptions).holdsAbsoluteLocate)) {
            beginAbsoluteLocate();
        }
        try {
            this.owner.context.setUserChangedProgress(!isReload, location?.from);
            if (!isReload && location?.url) {
                this.owner.context.currentLocation = location;
            }

            await this.gotoDoc(doc, location, isReload);

            if (this.isFirstLoad && !isReload) {
                await this.owner.loading?.hide();
                this.isFirstLoad = false;
            }

            await this.documentPreloader.preloadDocuments();
            if (this.shouldRealignAfterPreload(location, isReload)) {
                await this.gotoDoc(doc, location, true);
            }
        } finally {
            setTimeout(() => {
                this.loadingDoc = null;
                this.owner.context.redirectingDocUrl = undefined;
            }, 166);
        }
    }

    private async gotoDoc(doc: IHtmlDocument, location: FileLocation, isReload?: boolean): Promise<void> {
        if (!location)
            return;
        isReload = isReload ?? false;
        const flipMode = getLayoutGeometry(this.htmlOptions).flipMode;
        const htmlDoc = doc instanceof HtmlDocument ? doc : null;
        const retainLoadingLayer = !!htmlDoc
            && flipMode == "scroll"
            && !isReload
            && !location.suppressScroll
            && doc.getLoadStatus() != "success";
        if (retainLoadingLayer && htmlDoc) {
            htmlDoc.prepareCoveredLoad();
            this.scrollWrapperIntoView(doc, true);
            await yieldToMain();
        }
        try {
            await doc.load();
            const contentContainer = doc.getContentContainer();
            if (!contentContainer)
                return;
            const findTargetResult = await this.findTarget(doc, location);
            const target = findTargetResult?.target;
            let pageNumber = findTargetResult?.pageNumber;
            const isDocumentStart = findTargetResult?.isDocumentStart;
            if (!target && !pageNumber) {
                return;
            }
            const redirectTarget = this.resolveRedirectTarget(target, location);
            if (flipMode == "scroll") {
                if (location.suppressScroll) {
                    this.setDocumentVisible(doc.getWrapperContainer(), true);
                } else if (redirectTarget) {
                    await this.gotoScroll(doc, location, redirectTarget, isDocumentStart);
                }
            }
            else {
                pageNumber = await this.resolvePageNumber(doc, location, redirectTarget, pageNumber);
                await this.transformPage(doc, pageNumber, isReload ? undefined : location.direction);
            }
        }
        finally {
            if (retainLoadingLayer && htmlDoc) {
                await htmlDoc.revealCoveredLoad();
            }
        }
    }

    /**
     * Same layout (page count unchanged) restores the screen the reader left.
     * A reflow changes the page count, so fall through to the visible character
     * instead of the leading edge of an element that spans two columns.
     */
    private async resolvePageNumber(
        doc: IHtmlDocument,
        location: FileLocation,
        redirectTarget: LocateTarget | undefined,
        locatedPageNumber: number | undefined,
    ): Promise<number | undefined> {
        const numberOfPages = await doc.getNumberOfPages();
        const hasStoredPage = location.unit === "page" && location.current != null && location.current > 0;
        if (hasStoredPage && location.total === numberOfPages) {
            return remapStoredPageNumber(location, numberOfPages);
        }
        if (isDomRange(redirectTarget)) {
            return doc.getPageNumber(redirectTarget);
        }
        if (hasStoredPage) {
            return remapStoredPageNumber(location, numberOfPages);
        }
        if (redirectTarget) {
            return doc.getPageNumber(redirectTarget);
        }
        return locatedPageNumber;
    }

    /**
     * Map location.textOffset to a live Range so scroll / page calc can use
     * character geometry without wrapping each glyph into a DOM node.
     */
    private resolveRedirectTarget(target: Element | undefined, location: FileLocation): LocateTarget | undefined {
        if (!target || !(location?.textOffset >= 0)) {
            return target;
        }
        const textContent = target.textContent ?? "";
        if (location.textOffset >= textContent.length) {
            return target;
        }
        let offset = location.textOffset;
        const firstChild = target.firstElementChild;
        if (firstChild && compareTagName(firstChild.tagName, STTAG) && firstChild.getBoundingClientRect().width == 0) {
            offset = firstChild.textContent?.length ?? 0;
        }
        if (offset >= textContent.length) {
            return target;
        }
        return createRange(target, target, offset, Math.min(offset + 1, textContent.length)) ?? target;
    }

    /**
     * Scroll mode positioning
     */
    private async gotoScroll(doc: IHtmlDocument, location: FileLocation, redirectTarget: LocateTarget, isDocumentStart: boolean): Promise<void> {
        const geometry = getLayoutGeometry(this.htmlOptions);
        if (geometry.blockAxis == "x") {
            await this.gotoScrollX(doc, location, redirectTarget, isDocumentStart);
            return;
        }
        const redirectElement = getLocateElement(redirectTarget);
        const redirectElementRect = getLocateClientRect(redirectTarget);
        let scrollTopOffset = 0;
        if (!location?.ignoreOverlayHeader) {
            scrollTopOffset = this.owner.options.redirectPositionOffset;

            if (redirectElementRect.height == 0 && (!redirectElement || redirectElement.clientHeight == 0)) {
                scrollTopOffset += 50;
            }
        }

        if (location.offsetTop) {
            scrollTopOffset += location.offsetTop;
        }

        const scrollElement = this.getScrollElement();
        const redirectElementY = redirectElementRect.y;
        const iframe = doc.getContentContainer().ownerDocument.defaultView?.frameElement as HTMLElement;
        let iframeY = iframe?.getBoundingClientRect()?.y ?? 0;
        let distance = redirectElementY + iframeY;
        let scrollElementScrollTop = scrollElement.scrollTop;

        if (location.useAbsoluteScrollTop) {
            const newScrollTop = scrollElementScrollTop + distance - scrollTopOffset;
            scrollElement.scrollTo(0, newScrollTop);
        }
        else {
            if (!isDocumentStart) {
                if (BrowserCapabilities.isSafari()) {
                    scrollElementIntoView(doc.getWrapperContainer(), undefined, undefined, this.owner.getRootContainer()?.ownerDocument);
                    scrollElementScrollTop = scrollElement.scrollTop;
                    const iframeOffsetTop = (iframe as HTMLElement)?.offsetTop ?? 0;
                    if (Math.abs(iframeOffsetTop + redirectElementY - scrollElementScrollTop) > 5) {
                        const safariScrollTop = scrollElementScrollTop + doc.getWrapperContainer().getBoundingClientRect().y + redirectElementY;
                        scrollElement.scrollTo(0, safariScrollTop);
                    }
                    iframeY = iframe?.getBoundingClientRect()?.y ?? 0;
                    distance = redirectElementY + iframeY;
                }
                else {
                    scrollTopOffset = distance - scrollTopOffset - scrollElement.getBoundingClientRect().top;
                }
                if (scrollTopOffset > 0) {
                    const toBottomDistance = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
                    if (toBottomDistance > 0) {
                        scrollElement.scrollBy(0, scrollTopOffset);
                    }
                    else if (redirectElement) {
                        scrollElementIntoView(redirectElement, undefined, location?.scrollIntoViewIfNeeded, this.owner.getRootContainer()?.ownerDocument);
                    }
                }
                else {
                    scrollElement.scrollBy(0, scrollTopOffset);
                }
                this.setDocumentVisible(doc.getWrapperContainer(), true);
            }
            else {
                this.scrollWrapperIntoView(doc, true);
            }
        }
    }

    private async gotoScrollX(doc: IHtmlDocument, location: FileLocation, redirectTarget: LocateTarget, isDocumentStart: boolean): Promise<void> {
        const scrollElement = this.getScrollElement();
        if (isDocumentStart) {
            this.scrollWrapperIntoView(doc, true);
            return;
        }

        const redirectElementRect = getLocateClientRect(redirectTarget);
        const iframe = doc.getContentContainer().ownerDocument.defaultView?.frameElement as HTMLElement;
        const iframeX = iframe?.getBoundingClientRect()?.x ?? 0;
        const scrollRect = scrollElement.getBoundingClientRect();
        const scrollLeftOffset = location.offsetLeft ?? 0;
        const targetStart = redirectElementRect.x + iframeX - scrollLeftOffset;
        const targetEnd = redirectElementRect.right + iframeX - scrollLeftOffset;
        const delta = getLayoutGeometry(this.htmlOptions).getScrollLocateDelta({
            targetStart,
            viewportStart: scrollRect.left,
            targetEnd,
            viewportEnd: scrollRect.right,
        });

        if (location.useAbsoluteScrollTop) {
            scrollElement.scrollTo(scrollElement.scrollLeft + delta, scrollElement.scrollTop);
            this.setDocumentVisible(doc.getWrapperContainer(), true);
            return;
        }

        scrollElement.scrollBy(delta, 0);
        this.setDocumentVisible(doc.getWrapperContainer(), true);
    }

    private async findTarget(doc: IHtmlDocument, location: FileLocation) {
        return this.elementLocator.locateElement(doc, location, this.htmlOptions);
    }

    private async transformPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        this.setCurrentVisibleDocument(doc);
        const geometry = getLayoutGeometry(this.htmlOptions);
        if (geometry.pageAxis == "y") {
            this.transformVerticalPage(doc, pageNumber, direction);
            return;
        }
        this.transformHorizontalPage(doc, pageNumber, direction);
    }

    private transformHorizontalPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        const resolved = this.resolveRelativePageTransform(doc, pageNumber, direction, "x");
        if (!resolved) {
            this.syncPageNumberWhenTransformBlocked(doc, direction);
            return;
        }
        this.applyPageTransform(resolved.transformContainer, resolved.newTransformLength, direction, "x");
        this.setCurrentPageNumber(doc, pageNumber);
    }

    private transformVerticalPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        const resolved = this.resolveRelativePageTransform(doc, pageNumber, direction, "y");
        if (!resolved) {
            this.syncPageNumberWhenTransformBlocked(doc, direction);
            return;
        }
        this.applyPageTransform(resolved.transformContainer, resolved.newTransformLength, direction, "y");
        this.setCurrentPageNumber(doc, pageNumber);
    }

    /**
     * Packed columns are a continuous strip. Next/previous only slide the
     * viewport by one screen. Document offset / pageNumber must not phase-correct
     * those turns — leftover columns of the previous chapter are not drift.
     * Absolute goto (TOC / search / font remap) still uses offset + pageNumber.
     */
    private resolveRelativePageTransform(
        doc: IHtmlDocument,
        pageNumber: number,
        direction: 'next' | 'previous' | undefined,
        axis: 'x' | 'y'
    ) {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return null;
        }
        const styleTransformedLength = getTransformLength(transformContainer, axis);
        const targetTransform = transformContainer.getAttribute("data-target-transform");
        let currentTransformedLength = 0;
        if (targetTransform) {
            currentTransformedLength = parseNumber(targetTransform, 0, 'parseFloat');
        }
        else {
            currentTransformedLength = styleTransformedLength;
        }
        const documentViewport = this.rendererViewport.getLayoutMetrics();
        const pageStep = Math.max(1, documentViewport.pageMoveLength);

        if (direction == 'previous') {
            return {
                transformContainer,
                newTransformLength: Math.max(0, currentTransformedLength - pageStep),
            };
        }
        if (direction == 'next') {
            const newTransformLength = currentTransformedLength + pageStep;
            if (this.wouldExceedLastContent(newTransformLength, axis, transformContainer)) {
                return null;
            }
            return { transformContainer, newTransformLength };
        }

        const offset = this.getDocumentPageStartOffset(doc, axis);
        let newTransformLength = offset + (pageNumber - 1) * documentViewport.pageMoveLength;
        const contentLength = axis == "y"
            ? (doc.getWrapperContainer()?.scrollHeight ?? 0)
            : this.getDocumentPageBox(doc).contentWidth;
        // Columns have no trailing gap, so contentWidth is n * step - gap.
        // Clipping by pageMoveLength (page + gap) undershoots the last page by
        // one gap — e.g. 315px page / 355px step lands 40px short of alignment.
        const viewportLength = axis == "y"
            ? documentViewport.pageHeight
            : documentViewport.pageWidth;
        const clipLength = Number.isFinite(viewportLength) && viewportLength > 0
            ? viewportLength
            : documentViewport.pageMoveLength;
        const maxTransform = Math.max(0, offset + contentLength - clipLength);
        if (newTransformLength > maxTransform) {
            newTransformLength = maxTransform;
        }
        if (newTransformLength < 0) {
            newTransformLength = 0;
        }

        return { transformContainer, newTransformLength };
    }

    canAdvancePageTransform(doc: IHtmlDocument): boolean {
        const geometry = getLayoutGeometry(this.htmlOptions);
        const nextPageNumber = this.getCurrentPageNumber(doc) + 1;
        return this.resolveRelativePageTransform(doc, nextPageNumber, "next", geometry.pageAxis) != null;
    }

    /**
     * Last document may end mid-page (leftover columns). A further next step
     * has nowhere to move, even when counted pageNumber is still within numberOfPages.
     */
    private wouldExceedLastContent(newTransformLength: number, axis: 'x' | 'y', transformContainer: HTMLElement): boolean {
        return this.getLastContentExtent(axis, transformContainer) - newTransformLength <= 0;
    }

    private getLastContentExtent(axis: 'x' | 'y', transformContainer: HTMLElement): number {
        const documents = this.getDocuments();
        const lastWrapper = documents[documents.length - 1]?.getWrapperContainer();
        if (!lastWrapper) {
            return 0;
        }
        return getLayoutGeometry(this.htmlOptions).getLastContentExtent(lastWrapper, transformContainer);
    }

    private syncPageNumberWhenTransformBlocked(doc: IHtmlDocument, direction?: 'next' | 'previous') {
        if (direction != "next") {
            return;
        }
        const contentRootElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        const numberOfPages = parseNumber(
            contentRootElement?.getAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName),
            this.getCurrentPageNumber(doc),
            "parseInt"
        );
        this.setCurrentPageNumber(doc, numberOfPages);
    }

    /**
     * Distance from the transform row's inline-start to this page's start.
     * Whole-area RTL places the first document on the right; offsetLeft is still
     * physical-left, so the start offset is measured from the container's right.
     */
    private getDocumentPageStartOffset(doc: IHtmlDocument, _axis: 'x' | 'y'): number {
        const wrapperContainer = doc.getWrapperContainer();
        const pageBox = this.getDocumentPageBox(doc);
        return getLayoutGeometry(this.htmlOptions).getDocumentPageStartOffset(wrapperContainer, pageBox);
    }

    /**
     * Page origin is the iframe, not the wrapper. Inter-document gap lives on
     * the wrapper's inline-end, so iframe left/right match the column box.
     * Use layout offsets (not getBoundingClientRect) so a live translate cannot
     * collapse every document's origin to the visible edge.
     */
    private getDocumentPageBox(doc: IHtmlDocument): { offsetLeft: number, contentWidth: number, startOffset: number, containerWidth: number } {
        const wrapperContainer = doc.getWrapperContainer();
        const documentElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        const iframe = documentElement?.ownerDocument?.defaultView?.frameElement as HTMLElement | undefined;
        const contentWidth = iframe?.offsetWidth
            || (wrapperContainer?.clientWidth ?? 0);
        const transformContainer = this.getTransformContainer();
        const offsetLeft = iframe && transformContainer
            ? getLayoutOffsetLeft(iframe, transformContainer)
            : (wrapperContainer?.offsetLeft ?? 0);
        const containerWidth = transformContainer?.offsetWidth ?? 0;
        const geometry = getLayoutGeometry(this.htmlOptions);
        const startOffset = geometry.getPageStartOffset({
            offsetLeft,
            contentWidth,
            containerWidth,
        });
        return { offsetLeft, contentWidth, startOffset, containerWidth };
    }

    private applyPageTransform(
        transformContainer: HTMLElement,
        newTransformLegnth: number,
        direction?: 'next' | 'previous',
        axis: 'x' | 'y' = "x"
    ) {
        const geometry = getLayoutGeometry(this.htmlOptions);
        const length = parseFloat(newTransformLegnth.toFixed(10));
        const nextTransformCss = geometry.getPageTranslateCss(length);
        const expectedSignedLength = geometry.getSignedTranslateLength(length);
        const currentSignedLength = getTransformLength(transformContainer, axis, true);
        transformContainer.setAttribute('data-target-transform', `${length}`);
        // Relative turns skip a no-op write. Absolute goto (font / layout remap)
        // must always write — a stale translate past shrunken content is blank.
        if (direction && Math.abs(expectedSignedLength - currentSignedLength) <= 0.5) {
            return;
        }
        if (!transformContainer.style.transition && this.htmlOptions.flipPageStyle == 'slide' && (direction == 'next' || direction == 'previous')) {
            transformContainer.style.transition = 'transform 0.2s ease';
        }
        if (transformContainer.style.transition) {
            transformContainer.addEventListener('transitionend', this.removeElementTransitionEvent);
        }
        transformContainer.style.transform = nextTransformCss;
    }

    private resetTransformContainer = () => {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        transformContainer.style.removeProperty('transition');
        transformContainer.style.transform = "translate3d(0px,0,0)";
        transformContainer.setAttribute('data-target-transform', '0');
        // Force layout so subsequent getBoundingClientRect reflects the reset.
        void transformContainer.offsetWidth;
    }

    private removeElementTransitionEvent = async (e: TransitionEvent) => {
        const element = e.target as HTMLElement;
        element.style.removeProperty('transition');
        element.style.removeProperty('will-change');
        element.removeAttribute(HtmlSettings.PageMovingAttributeName);
        element.removeEventListener('transitionend', this.removeElementTransitionEvent);
        while (this.hangTasks.length > 0) {
            const task = this.hangTasks.shift();
            await task();
        }
    };

    private setCurrentPageNumber(doc: IHtmlDocument, pageNumber: number) {
        const contentRootElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        if (!contentRootElement)
            return;
        contentRootElement.setAttribute(HtmlSettings.HtmlDocumentCurrentPagePropertyName, pageNumber.toFixed(0));
    }

    private scrollWrapperIntoView = (doc: IHtmlDocument, forceScroll?: boolean) => {
        const wrapperContainer = doc.getWrapperContainer();
        const geometry = getLayoutGeometry(this.htmlOptions);
        if (geometry.flipMode == 'page') {
            const metrics = this.rendererViewport.getLayoutMetrics();
            const transformContainer = this.getTransformContainer();
            if (geometry.pageAxis == "y") {
                const transform = Math.max(0, wrapperContainer.offsetTop);
                transformContainer.style.transform = geometry.getPageTranslateCss(transform);
                transformContainer.setAttribute("data-target-transform", `${transform}`);
            }
            else {
                const pageBox = this.getDocumentPageBox(doc);
                const transform = geometry.getPageTransformOffset(pageBox, 1, metrics.pageMoveLength);
                transformContainer.style.transform = geometry.getPageTranslateCss(transform);
                transformContainer.setAttribute("data-target-transform", `${transform}`);
            }
        }
        else if (!wrapperContainer.isVisible || forceScroll) {
            geometry.alignWrapperToViewport({
                wrapper: wrapperContainer,
                scrollElement: this.getScrollElement(),
                rootDocument: this.owner.getRootContainer()?.ownerDocument,
            });
        }
        this.setCurrentVisibleDocument(doc);
    }

    getCurrentPageNumber(doc: IHtmlDocument): number {
        const contentRootElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        if (!contentRootElement)
            return 1;
        const pageNumber = contentRootElement.getAttribute(HtmlSettings.HtmlDocumentCurrentPagePropertyName);
        return parseNumber(pageNumber, 1, 'parseInt');
    }

    /**
     * Map the live transform to a document-local page for progress UI.
     * Left/right turns must not use this to snap the viewport.
     */
    async syncPageState(doc: IHtmlDocument): Promise<{ current: number; total: number }> {
        const contentRoot = doc.getContentContainer()?.ownerDocument?.documentElement;
        contentRoot?.removeAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName);
        const total = Math.max(1, await doc.getNumberOfPages());
        const geometry = getLayoutGeometry(this.htmlOptions);
        const metrics = this.rendererViewport.getLayoutMetrics();
        const step = Math.max(1, metrics.pageMoveLength);
        const transformContainer = this.getTransformContainer();
        const currentTransform = parseNumber(
            transformContainer?.getAttribute('data-target-transform'),
            0,
            'parseFloat',
        );
        const offset = this.getDocumentPageStartOffset(doc, geometry.pageAxis);
        const current = Math.min(
            total,
            Math.max(1, Math.round(Math.abs(currentTransform - offset) / step) + 1),
        );
        this.setCurrentPageNumber(doc, current);
        return { current, total };
    }

    private setDocumentVisible = (wrapperContainer: Element, isVisible: boolean) => {
        wrapperContainer.isVisible = isVisible;
    }

    private setCurrentVisibleDocument(doc: IHtmlDocument) {
        for (const item of this.getDocuments()) {
            this.setDocumentVisible(item.getWrapperContainer(), item === doc);
        }
    }

    reload = async (): Promise<void> => {
        const location = this.owner.context.currentLocation;
        if (isNullOrWhiteSpace(location?.url))
            return;
        await this.load(location, true);
    }

    /**
     * TOC / search jumps size the target before preceding chapters finish
     * loading. Those chapters then expand and push the target off-screen.
     * Re-apply the absolute transform after preload. Relative page turns keep
     * their packed column phase and must not snap.
     */
    private shouldRealignAfterPreload(location: FileLocation | undefined, isReload?: boolean) {
        if (isReload || location?.direction == "next" || location?.direction == "previous") {
            return false;
        }
        return getLayoutGeometry(this.htmlOptions).flipMode == "page";
    }

    /**
     * Content reflow (font, translation, images): reposition to currentLocation
     * without a viewport reload.
     */
    restoreReadingPosition = async (): Promise<void> => {
        const location = this.owner.context.currentLocation;
        if (isNullOrWhiteSpace(location?.url)) {
            return;
        }
        const doc = this.getDocument(location.url) ?? this.getFirstVisibleDocument();
        if (!doc) {
            return;
        }
        await this.gotoDoc(doc, location, true);
    }

    delayRestoreReadingPosition = asyncDebounce(this.restoreReadingPosition, 100);

    protected readonly delayReloadTime = 300;
    protected delayReload = asyncDebounce(this.reload, this.delayReloadTime);

    private appendPageStyles() {
        // Page-strip CSS lives on the exclusive renderer layout class.
    }

    private clearPageTransform() {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        transformContainer.style.removeProperty('transition');
        transformContainer.style.removeProperty('transform');
        transformContainer.removeAttribute('data-target-transform');
        void transformContainer.offsetWidth;
    }

    private removePageStyles() {
        this.getRendererContainer().classList.remove(HtmlSettings.TransformPagesClassName);
        this.clearPageTransform();
    }

    async dispose(): Promise<void> {
        await this.documentsIntersectionObserver.dispose();
        await this.documentPreloader.dispose();
        await super.dispose();
        if (this.readerContainer) {
            emptyElement(this.readerContainer);
        }
        this.isInit = false;
    }
}
