import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { parseNumber } from "../../../../kernal/common/number";
import { compareTagName } from "../../../../kernal/html/finder";
import { emptyElement } from "../../../../kernal/html/dom";
import { wrapperCharacters, recoverWrapperCharacters } from "../../../../kernal/html/manipulator";
import { scrollElementIntoView, getTransformLength } from "../../../../kernal/html/style";
import { FileLocation, IFileParser, ILogger, SpineFile, STTAG, asyncDebounce, BrowserCapabilities } from "../../../../kernal";
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
import { getPageTransformOffset, resolveLayoutFlow } from "../layout/resolveLayoutFlow";

/**
 * HTML documents provider.
 */
export class HtmlDocumentsProvider extends BaseDocumentsProvider<IHtmlDocument> implements IHtmlDocumentsProvider {
    protected logger: ILogger;
    private isInit: boolean = false;
    private isFirstLoad: boolean = true;
    private delayHideLoadingLayerTimer: any;
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
        protected readonly htmlOptions: HtmlOptions
    ) {
        super(owner, fileParser);
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

        if (resolveLayoutFlow(this.htmlOptions).flipMode == "page") {
            this.appendPageStyles();
        }
        else {
            this.removePageStyles();
        }
        this.loadingDoc = doc;
        this.owner.context.redirectingDocUrl = doc.url;
        try {
            this.delayHideLoadingLayerTimer = setTimeout(async () => {
                await this.owner.loading?.hide();
            }, 2000);

            this.owner.context.setUserChangedProgress(!isReload, location?.from);

            await this.gotoDoc(doc, location, isReload);

            if (this.isFirstLoad && !isReload) {
                this.isFirstLoad = false;
            }

            await this.documentPreloader.preloadDocuments();
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
        await doc.load();
        const contentContainer = doc.getContentContainer();
        if (!contentContainer)
            return;
        isReload = isReload ?? false;
        const flipMode = resolveLayoutFlow(this.htmlOptions).flipMode;

        let redirectElement: Element = undefined, target: Element;
        try {
            const findTargetResult = await this.findTarget(doc, location);
            target = findTargetResult?.target;
            let pageNumber = findTargetResult?.pageNumber;
            const isDocumentStart = findTargetResult?.isDocumentStart;
            if (!target && !pageNumber) {
                return;
            }
            if (target && location?.textOffset >= 0) {
                const textContent = target.textContent;
                if (location?.textOffset < textContent.length && textContent.length < 3000) {
                    wrapperCharacters(target, "m");
                    const elements = target.querySelectorAll("m");
                    if (compareTagName(target.firstElementChild?.tagName, STTAG) && target.firstElementChild.getBoundingClientRect().width == 0) {
                        redirectElement = elements.item(target.firstElementChild.textContent.length);
                    }
                    else {
                        redirectElement = elements.item(location.textOffset);
                    }
                }
            }

            redirectElement = redirectElement ?? target;
            if (flipMode == "scroll") {
                await this.gotoScroll(doc, location, redirectElement, isDocumentStart);
            }
            else {
                if (isReload && redirectElement && !isNullOrWhiteSpace(location.tagName)) {
                    // Layout metrics changed: resolve page from element under a zeroed transform,
                    // otherwise getBoundingClientRect is skewed by the previous page offset.
                    this.resetTransformContainer();
                    pageNumber = await doc.getPageNumber(redirectElement);
                }
                else if (location.unit === "page" && location.current != null && location.current > 0) {
                    pageNumber = location.current;
                    const numberOfPages = await doc.getNumberOfPages();
                    if (location.total > 1 && location.total != numberOfPages) {
                        pageNumber = Math.ceil(numberOfPages * (location.current / location.total));
                    }
                }
                else if (!pageNumber) {
                    pageNumber = await doc.getPageNumber(redirectElement);
                }
                await this.transformPage(doc, pageNumber, isReload ? undefined : location.direction);
            }
        } finally {
            if (target) {
                recoverWrapperCharacters(target);
            }
        }
    }

    /**
     * Scroll mode positioning
     */
    private async gotoScroll(doc: IHtmlDocument, location: FileLocation, redirectElement: Element, isDocumentStart: boolean): Promise<void> {
        const flow = resolveLayoutFlow(this.htmlOptions);
        if (flow.blockAxis == "x") {
            await this.gotoScrollX(doc, location, redirectElement, isDocumentStart);
            return;
        }
        const redirectElementRect = redirectElement.getBoundingClientRect();
        let scrollTopOffset = 0;
        if (!location?.ignoreOverlayHeader) {
            scrollTopOffset = this.owner.optionsProvider.getHeaderHeight() + this.owner.options.redirectPositionOffset;

            if (redirectElement.clientHeight == 0 && redirectElementRect.height == 0) {
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
                    else {
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

    private async gotoScrollX(doc: IHtmlDocument, location: FileLocation, redirectElement: Element, isDocumentStart: boolean): Promise<void> {
        const scrollElement = this.getScrollElement();
        if (isDocumentStart) {
            this.scrollWrapperIntoView(doc, true);
            return;
        }

        const redirectElementRect = redirectElement.getBoundingClientRect();
        const iframe = doc.getContentContainer().ownerDocument.defaultView?.frameElement as HTMLElement;
        const iframeX = iframe?.getBoundingClientRect()?.x ?? 0;
        const distance = redirectElementRect.x + iframeX;
        const scrollLeftOffset = location.offsetLeft ?? 0;

        if (location.useAbsoluteScrollTop) {
            scrollElement.scrollTo(scrollElement.scrollLeft + distance - scrollLeftOffset, scrollElement.scrollTop);
            this.setDocumentVisible(doc.getWrapperContainer(), true);
            return;
        }

        const delta = distance - scrollLeftOffset - scrollElement.getBoundingClientRect().left;
        const toEndDistance = scrollElement.scrollWidth - scrollElement.scrollLeft - scrollElement.clientWidth;
        if (delta > 0 && toEndDistance <= 0) {
            scrollElementIntoView(redirectElement, undefined, location?.scrollIntoViewIfNeeded, this.owner.getRootContainer()?.ownerDocument);
        }
        else {
            scrollElement.scrollBy(delta, 0);
        }
        this.setDocumentVisible(doc.getWrapperContainer(), true);
    }

    private async findTarget(doc: IHtmlDocument, location: FileLocation) {
        return this.elementLocator.locateElement(doc, location, this.htmlOptions);
    }

    private async transformPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        this.setCurrentVisibleDocument(doc);
        const flow = resolveLayoutFlow(this.htmlOptions);
        if (flow.pageAxis == "y") {
            this.transformVerticalPage(doc, pageNumber, direction);
            return;
        }
        if (flow.isRtlProgression) {
            this.transformColumnPage(doc, pageNumber, direction, true);
            return;
        }
        this.transformHorizontalPage(doc, pageNumber, direction);
    }

    private transformHorizontalPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        const transformContainer = this.getTransformContainer();
        const targetTransform = transformContainer.getAttribute("data-target-transform");
        let currentTransformedLength = 0;
        if (targetTransform) {
            currentTransformedLength = parseNumber(targetTransform, 0, 'parseFloat');
        }
        else {
            currentTransformedLength = getTransformLength(transformContainer, "x");
        }
        const documentViewport = this.rendererViewport.getLayoutMetrics();
        const columnTransformLength = documentViewport.columnWidth + documentViewport.columnGap;

        const wrapperContainer = doc.getWrapperContainer();
        const offsetLeft = wrapperContainer.offsetLeft;

        const currentDocumentTransformedLength = Math.abs(offsetLeft - currentTransformedLength);
        const diff = currentDocumentTransformedLength == 0 ? 0 : currentDocumentTransformedLength % columnTransformLength;

        let fixedCurrentTransformedLength = currentTransformedLength;
        if (diff > 0) {
            if (direction == 'previous') {
                fixedCurrentTransformedLength = currentTransformedLength - diff;
            } else {
                fixedCurrentTransformedLength = currentTransformedLength + columnTransformLength - diff;
            }
        }
        let newTransformLegnth = fixedCurrentTransformedLength;

        if (direction == 'previous') {
            const previousSpaceIsEnough = fixedCurrentTransformedLength - documentViewport.pageMoveLength >= 0;
            const readyToTransformLegnth = offsetLeft + (pageNumber - 1) * documentViewport.pageMoveLength;
            if (previousSpaceIsEnough) {
                newTransformLegnth = fixedCurrentTransformedLength - documentViewport.pageMoveLength;
            }
            else if (fixedCurrentTransformedLength <= documentViewport.pageMoveLength) {
                newTransformLegnth = 0;
            }
            else {
                newTransformLegnth = readyToTransformLegnth;
            }
        }
        else if (direction == 'next') {
            newTransformLegnth = fixedCurrentTransformedLength + documentViewport.pageMoveLength;
            const documents = this.getDocuments();
            const lastDocument = documents[documents.length - 1];
            if (lastDocument.getWrapperContainer().offsetLeft + lastDocument.getWrapperContainer().scrollWidth - newTransformLegnth <= 0) {
                return;
            }
        }
        else {
            newTransformLegnth = offsetLeft + (pageNumber - 1) * documentViewport.pageMoveLength;
        }

        if (newTransformLegnth < 0) {
            newTransformLegnth = 0;
        }

        this.applyPageTransform(transformContainer, newTransformLegnth, direction, "x");
        this.setCurrentPageNumber(doc, pageNumber);
    }

    private transformVerticalPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        const transformContainer = this.getTransformContainer();
        const targetTransform = transformContainer.getAttribute("data-target-transform");
        let currentTransformedLength = 0;
        if (targetTransform) {
            currentTransformedLength = parseNumber(targetTransform, 0, 'parseFloat');
        }
        else {
            currentTransformedLength = getTransformLength(transformContainer, "y");
        }
        const documentViewport = this.rendererViewport.getLayoutMetrics();
        const wrapperContainer = doc.getWrapperContainer();
        const offsetTop = wrapperContainer.offsetTop;
        const columnTransformLength = documentViewport.pageMoveLength;

        const currentDocumentTransformedLength = Math.abs(offsetTop - currentTransformedLength);
        const diff = currentDocumentTransformedLength == 0 ? 0 : currentDocumentTransformedLength % columnTransformLength;

        let fixedCurrentTransformedLength = currentTransformedLength;
        if (diff > 0) {
            if (direction == 'previous') {
                fixedCurrentTransformedLength = currentTransformedLength - diff;
            } else {
                fixedCurrentTransformedLength = currentTransformedLength + columnTransformLength - diff;
            }
        }
        let newTransformLegnth = fixedCurrentTransformedLength;

        if (direction == 'previous') {
            const previousSpaceIsEnough = fixedCurrentTransformedLength - documentViewport.pageMoveLength >= 0;
            const readyToTransformLegnth = offsetTop + (pageNumber - 1) * documentViewport.pageMoveLength;
            if (previousSpaceIsEnough) {
                newTransformLegnth = fixedCurrentTransformedLength - documentViewport.pageMoveLength;
            }
            else if (fixedCurrentTransformedLength <= documentViewport.pageMoveLength) {
                newTransformLegnth = 0;
            }
            else {
                newTransformLegnth = readyToTransformLegnth;
            }
        }
        else if (direction == 'next') {
            newTransformLegnth = fixedCurrentTransformedLength + documentViewport.pageMoveLength;
            const documents = this.getDocuments();
            const lastDocument = documents[documents.length - 1];
            if (lastDocument.getWrapperContainer().offsetTop + lastDocument.getWrapperContainer().scrollHeight - newTransformLegnth <= 0) {
                return;
            }
        }
        else {
            newTransformLegnth = offsetTop + (pageNumber - 1) * documentViewport.pageMoveLength;
        }

        if (newTransformLegnth < 0) {
            newTransformLegnth = 0;
        }

        this.applyPageTransform(transformContainer, newTransformLegnth, direction, "y");
        this.setCurrentPageNumber(doc, pageNumber);
    }

    private transformColumnPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous', isRtlProgression?: boolean) {
        const transformContainer = this.getTransformContainer();
        const documentViewport = this.rendererViewport.getLayoutMetrics();
        const wrapperContainer = doc.getWrapperContainer();
        const documentElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        const contentWidth = Math.max(
            wrapperContainer.scrollWidth,
            documentElement?.scrollWidth ?? 0
        );
        const newTransformLegnth = getPageTransformOffset(
            wrapperContainer.offsetLeft,
            contentWidth,
            pageNumber,
            documentViewport.pageMoveLength,
            isRtlProgression
        );
        this.applyPageTransform(transformContainer, newTransformLegnth, direction, "x");
        this.setCurrentPageNumber(doc, pageNumber);
    }

    private applyPageTransform(transformContainer: HTMLElement, newTransformLegnth: number, direction?: 'next' | 'previous', axis: 'x' | 'y' = "x") {
        if (!transformContainer.style.transition && this.htmlOptions.flipPageStyle == 'slide' && (direction == 'next' || direction == 'previous')) {
            transformContainer.style.transition = 'transform 0.2s ease';
        }
        if (transformContainer.style.transition) {
            transformContainer.addEventListener('transitionend', this.removeElementTransitionEvent);
        }
        transformContainer.setAttribute('data-target-transform', `${newTransformLegnth}`);
        const length = parseFloat(newTransformLegnth.toFixed(10));
        transformContainer.style.transform = axis == "y"
            ? `translate3d(0,-${length}px,0)`
            : `translate3d(-${length}px,0,0)`;
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
        const flow = resolveLayoutFlow(this.htmlOptions);
        if (flow.flipMode == 'page') {
            const metrics = this.rendererViewport.getLayoutMetrics();
            const transformContainer = this.getTransformContainer();
            if (flow.pageAxis == "y") {
                const transform = Math.max(0, wrapperContainer.offsetTop);
                transformContainer.style.transform = `translate3d(0,-${transform}px,0)`;
                transformContainer.setAttribute("data-target-transform", `${transform}`);
            }
            else {
                const transform = getPageTransformOffset(
                    wrapperContainer.offsetLeft,
                    wrapperContainer.scrollWidth,
                    1,
                    metrics.pageMoveLength,
                    flow.isRtlProgression
                );
                transformContainer.style.transform = "translateX(" + (-transform) + "px)";
                transformContainer.setAttribute("data-target-transform", `${transform}`);
            }
        }
        else if (!wrapperContainer.isVisible || forceScroll) {
            if (flow.blockAxis == "x" && flow.initialScroll == "end") {
                const scrollElement = this.getScrollElement();
                const wrapperRect = wrapperContainer.getBoundingClientRect();
                const scrollRect = scrollElement.getBoundingClientRect();
                scrollElement.scrollBy(wrapperRect.right - scrollRect.right, 0);
            }
            else {
                scrollElementIntoView(wrapperContainer, undefined, undefined, this.owner.getRootContainer()?.ownerDocument);
            }
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
        location.scrollBehavior = 'smooth';
        await this.load(location, true);
        location.scrollBehavior = undefined;
    }

    protected readonly delayReloadTime = 300;
    protected delayReload = asyncDebounce(this.reload, this.delayReloadTime);

    private appendPageStyles() {
        this.getRendererContainer().classList.add(HtmlSettings.TransformPagesClassName);
    }

    private removePageStyles() {
        this.getRendererContainer().classList.remove(HtmlSettings.TransformPagesClassName);
        const transformContainer = this.getTransformContainer();
        if (transformContainer) {
            transformContainer.style.removeProperty('transform');
        }
    }

    async dispose(): Promise<void> {
        if (this.delayHideLoadingLayerTimer) {
            clearTimeout(this.delayHideLoadingLayerTimer);
            this.delayHideLoadingLayerTimer = null;
        }
        await this.documentsIntersectionObserver.dispose();
        await this.documentPreloader.dispose();
        await super.dispose();
        if (this.readerContainer) {
            emptyElement(this.readerContainer);
        }
        this.isInit = false;
    }
}
