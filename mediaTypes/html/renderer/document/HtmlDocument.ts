import { getDocumentBody } from "../../../../kernal/html/finder";
import { getOrderedElementsIntersectingRect, resolveVisibleViewportInContentWindow } from "../../../../kernal/html/geometry";
import { emptyElement, setElementHtml } from "../../../../kernal/html/dom";
import { getUuid } from "../../../../kernal/common/uuid";
import { EventNames, FlipMode, IFileParser, ILogger, LocationState, TextFormatOptions, SpineFile, readerPrefixName, yieldToMain, BrowserCapabilities } from "../../../../kernal";
import type { Reader } from "../../../../kernal/Reader";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlTextDocument } from "../IHtmlTextDocument";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { BaseDocument } from "../../../base/renderer/BaseDocument";
import { getEventKeyMap } from "../../../base/renderer/eventKeys";
import { HtmlOptions } from "../../HtmlOptions";
import { IHtmlLoadLayer } from "../../../../kernal/services/docLoadLayer/IHtmlLoadLayer";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { createIframe, getTooBigHtmlTemplate } from "../html/template";
import { HtmlPageCalculator } from "./HtmlPageCalculator";
import { asHtmlFileParser } from "../../fileParser/IHtmlFileParser";
import { HtmlSymbolCalclator } from "./HtmlSymbolCalclator";
import { HtmlDocumentResizeObserver } from "./HtmlDocumentResizeObserver";
import { collectContentUnitElements } from "../visibilityCandidates";
import { getLayoutGeometry } from "../layout/resolveLayoutRoute";
import { HtmlLayoutStatePreserver } from "../location/HtmlLayoutStatePreserver";
import { shouldKeepPageEndOnContentGrow } from "../location/remapStoredPageNumber";

export class HtmlDocument extends BaseDocument implements IHtmlDocument {
    private docContent: string;
    private logger: ILogger;
    private iframe: HTMLIFrameElement;
    private loadingLayer: IHtmlLoadLayer;
    private readonly pageCalculator: HtmlPageCalculator;
    readonly symbolCalclator: HtmlSymbolCalclator;
    private readonly eventKeyMap = getEventKeyMap();
    private readonly resizeObserver: HtmlDocumentResizeObserver;
    private readonly layoutStatePreserver: HtmlLayoutStatePreserver;
    private visibilityCandidates: Element[] | null = null;
    constructor(owner: Reader, viewport: IRendererViewport<HtmlLayoutMetrics>, fileParser: IFileParser, wrapperContainer: HTMLElement, spineFile: SpineFile, private readonly options: HtmlOptions) {
        super(owner, fileParser, wrapperContainer, spineFile);

        this.pageCalculator = new HtmlPageCalculator(this, viewport, options);
        this.symbolCalclator = new HtmlSymbolCalclator(this, asHtmlFileParser(fileParser).symbolMeasure);
        this.layoutStatePreserver = new HtmlLayoutStatePreserver(this, viewport, options);
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);
        this.resizeObserver = new HtmlDocumentResizeObserver(this, this.owner.events);
    }

    override get inIframe(): boolean {
        return true;
    }

    private callbacks: { resolve: any; reject: any; }[] = [];
    private retainLoadingLayer = false;
    private pendingPageLayoutState: LocationState | null = null;
    private pageStripConcealed = false;
    override async load(): Promise<void> {
        await new Promise<void>(async (resolve, reject) => {
            if (this.loadStatus == "success") {
                resolve();
                return;
            }
            this.callbacks.push({ resolve, reject });
            if (this.loadStatus == 'loading') {
                return;
            }
            this.loadStatus = "loading";
            this.loadingLayer = await this.owner.services.get('loadLayer');
            this.loadingLayer?.setDoc(this);
            emptyElement(this.wrapperContainer);
            this.loadingLayer.removeLoadingLayer();
            this.loadingLayer.loadLoadingLayer();
            await yieldToMain();

            try {
                if (this.inIframe) {
                    if (!this.iframe) {
                        const iframeId = readerPrefixName + getUuid(true);
                        this.iframe = createIframe(this.wrapperContainer.ownerDocument, iframeId, this.options.forceScroll, getLayoutGeometry(this.options));
                        if (this.options.forceScroll) {
                            this.iframe.removeAttribute("scrolling");
                        }
                        else {
                            this.iframe.setAttribute("scrolling", "no");
                        }
                        const loadingContent = await this.buildLoadingContent();
                        await yieldToMain();
                        this.wrapperContainer.appendChild(this.iframe);
                        this.bringLoadingLayerToFront();

                        await yieldToMain();
                        this.iframe.addEventListener("load", async () => {
                            await this.processAfterLoaded();
                        }, false);
                        this.iframe.addEventListener("error", (err) => {
                            this.revealPendingPageStrip();
                            this.retainLoadingLayer = false;
                            this.loadingLayer?.removeLoadingLayer();
                            this.loadStatus = "fail";
                            this.iframe = undefined;
                            this.loadingLayer?.setReloadButton();
                            this.logger.error(err);
                            this.owner.events.emit(EventNames.DocumentLoadFailed, this, err);
                            this.loadCompleted(true);
                        }, false);
                       
                        const iframeDocument = this.iframe.contentDocument;
                        const layoutState = this.captureLayoutState();
                        const deferPageRestore = getLayoutGeometry(this.options).flipMode == "page";
                        if (deferPageRestore) {
                            this.pendingPageLayoutState = layoutState;
                            this.concealPageStrip();
                        }
                        if ((this.options.preferSrcdoc && "srcdoc" in this.iframe) || !("write" in iframeDocument)) {
                            this.iframe.srcdoc = loadingContent;
                        }
                        else {
                            iframeDocument.open();
                            iframeDocument.write(loadingContent);
                            iframeDocument.close();
                        }
                        if (!deferPageRestore) {
                            await this.restoreLayoutState(layoutState);
                        }
                        await yieldToMain();
                    }
                }
                else {
                    const loadingContent = await this.buildLoadingContent();
                    setElementHtml(this.wrapperContainer, loadingContent);
                    await this.processAfterLoaded();
                    await yieldToMain();
                }
            }
            catch (error) {
                this.revealPendingPageStrip();
                this.logger.error(error);
                this.retainLoadingLayer = false;
                if (!this.owner?.context) {
                    await this.releaseLoadingLayer();
                    this.loadCompleted(true);
                }
                else {
                    this.loadingLayer?.removeLoadingLayer();
                    this.loadStatus = "fail";
                    this.iframe = undefined;
                    this.loadingLayer?.setReloadButton();
                    this.owner.events.emit(EventNames.DocumentLoadFailed, this, error?.toString());
                    this.loadCompleted(true);
                }
            }
        });
    }
    prepareCoveredLoad(): void {
        this.retainLoadingLayer = true;
    }

    async revealCoveredLoad(): Promise<void> {
        this.retainLoadingLayer = false;
        try {
            await this.waitForRevealPaint();
            await this.fadeOutCover();
        }
        finally {
            await this.releaseLoadingLayer();
        }
    }
    private waitForRevealPaint = async () => {
        await yieldToMain();
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
        await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 120);
        });
        await this.waitForVisibleImagesReady();
    };
    private waitForVisibleImagesReady = async () => {
        const contentContainer = this.getContentContainer();
        const view = contentContainer?.ownerDocument?.defaultView;
        if (!contentContainer || !view) {
            return;
        }
        const images = [
            ...contentContainer.querySelectorAll("img"),
            ...contentContainer.getElementsByTagName("image"),
        ] as (HTMLImageElement | SVGImageElement)[];
        if (images.length == 0) {
            return;
        }
        const viewportHeight = view.innerHeight || contentContainer.clientHeight;
        const visible = images.filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.bottom > -200 && rect.top < viewportHeight + 200;
        });
        if (visible.length == 0) {
            return;
        }
        const waitMs = 800;
        await Promise.race([
            Promise.all(visible.map((image) => this.waitForImageReady(image))),
            new Promise<void>((resolve) => {
                window.setTimeout(resolve, waitMs);
            }),
        ]);
    };
    private waitForImageReady = (image: HTMLImageElement | SVGImageElement) => {
        if (this.isImageReady(image)) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                image.removeEventListener("load", finish);
                image.removeEventListener("error", finish);
                observer.disconnect();
                resolve();
            };
            const observer = new MutationObserver(() => {
                if (this.isImageReady(image)) {
                    finish();
                }
            });
            observer.observe(image, { attributes: true, attributeFilter: ["src", "href", "data-load-state"] });
            image.addEventListener("load", finish);
            image.addEventListener("error", finish);
            window.setTimeout(finish, 800);
        });
    };
    private isImageReady = (image: HTMLImageElement | SVGImageElement) => {
        const loadState = image.getAttribute("data-load-state");
        if (loadState == "loaded" || loadState == "fail") {
            return true;
        }
        const ImageCtor = image.ownerDocument.defaultView?.window.HTMLImageElement;
        if (!ImageCtor || !(image instanceof ImageCtor)) {
            return false;
        }
        const src = image.currentSrc || image.src;
        if (!src || src.startsWith("data:image/svg+xml")) {
            return false;
        }
        return image.complete && image.naturalWidth > 0;
    };
    private bringLoadingLayerToFront = () => {
        const layer = this.wrapperContainer.querySelector("div[data-type='loading-layer']");
        if (layer) {
            this.wrapperContainer.appendChild(layer);
        }
    };
    private fadeOutCover = async (durationMs = 200) => {
        const layer = this.wrapperContainer.querySelector("div[data-type='loading-layer']") as HTMLElement | null;
        if (!layer) {
            return;
        }
        const duration = Math.max(0, durationMs);
        layer.style.pointerEvents = "none";
        layer.style.transition = `opacity ${duration}ms ease`;
        layer.style.opacity = "0";
        await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                layer.removeEventListener("transitionend", finish);
                resolve();
            };
            layer.addEventListener("transitionend", finish);
            window.setTimeout(finish, duration + 50);
        });
    };
    private releaseLoadingLayer = async () => {
        this.loadingLayer?.removeLoadingLayer();
        await this.loadingLayer?.dispose();
        this.loadingLayer = undefined;
    };
    private buildLoadingContent = async () => {
        const virtualDocument = await this.getFormattedVirtualDocument();
        const preprocesses = this.owner.getRenderer()?.documentPreprocesses ?? [];
        for (const preprocess of preprocesses) {
            try {
                await preprocess(this);
            }
            catch (e) {
                this.logger.error('preprocess', 'function', preprocess?.name, e);
            }
        }

        let loadingContent = virtualDocument.documentElement.outerHTML.replace(/<([^<]*)\?xml([^>]*)\?.*?>/i, "");
        const existDocType = loadingContent.match(/<!DOCTYPE[^>]*>/i);
        if (!existDocType) {
            loadingContent = "<!DOCTYPE html>" + loadingContent;
        }
        return loadingContent;
    };

    private processAfterLoaded = async () => {
        const contentContainer = this.getContentContainer();
        if (!contentContainer) {
            this.revealPendingPageStrip();
            return;
        }
        contentContainer.setAttribute("data-url", this.url);
        const layoutState = this.pendingPageLayoutState ?? this.captureLayoutState();
        this.pendingPageLayoutState = null;
        const geometry = getLayoutGeometry(this.options);
        const deferPlaceholderRemoval = geometry.iframeGrow == "width";
        if (!deferPlaceholderRemoval) {
            this.wrapperContainer.classList.remove(HtmlSettings.FileContentContainerHeightClassName);
        }
        try {
            const postprocesses = this.owner.getRenderer()?.documentPostprocesses ?? [];
            for (const postprocess of postprocesses) {
                try {
                    await postprocess(this);
                    await yieldToMain();
                }
                catch (e) {
                    this.logger.error('postprocess', 'function', postprocess?.name, e);
                }
            }

            await this.layoutStatePreserver.waitUntilPageTransformStable();
            this.resetLayoutSizes();
            if (deferPlaceholderRemoval) {
                this.wrapperContainer.classList.remove(HtmlSettings.FileContentContainerHeightClassName);
            }
            this.layoutStatePreserver.restore(layoutState);
        }
        finally {
            this.revealPendingPageStrip();
        }
        if (!this.retainLoadingLayer) {
            await this.releaseLoadingLayer();
        }
        this.loadStatus = "success";
        this.visibilityCandidates = null;
        this.bindDocumentEvents();
        this.owner.events.emit(EventNames.DocumentLoad, this);
        this.resizeObserver.observeIframeSize(async () => {
            const geometry = getLayoutGeometry(this.options);
            const keepEnd = shouldKeepPageEndOnContentGrow(this.owner.context.currentLocation, this.url);
            const restoreScroll = geometry.restoresScrollAfterResize || keepEnd;
            const layoutState = restoreScroll ? this.captureLayoutState() : null;
            this.resetLayoutSizes();
            if (geometry.flipMode == "page") {
                this.pageCalculator.calcNumberOfPages(true);
            }
            if (restoreScroll && layoutState) {
                await this.restoreLayoutState(layoutState);
                if (keepEnd) {
                    const pages = this.internalGetNumberOfPages();
                    const location = this.owner.context.currentLocation;
                    if (location?.url == this.url) {
                        location.current = pages;
                        location.total = pages;
                    }
                }
            }
        });
        this.loadCompleted(true);
    };
    private loadCompleted = (success: boolean) => {
        for (let i = 0; i < this.callbacks.length; i++) {
            try {
                if (success) {
                    this.callbacks[i].resolve();
                }
                else {
                    this.callbacks[i].reject();
                }
            }
            catch (e) {
            }
        }
        this.callbacks = [];
    };

    resetLayoutSizes(): void {
        this.resetIframeMinSize();
    }
    captureLayoutState(): LocationState {
        return this.layoutStatePreserver.capture();
    }
    async restoreLayoutState(locationState: LocationState): Promise<void> {
        this.layoutStatePreserver.restore(locationState);
    }

    private concealPageStrip(): void {
        this.pageStripConcealed = true;
        this.layoutStatePreserver.concealPageStrip();
    }

    private revealPendingPageStrip(): void {
        this.pendingPageLayoutState = null;
        if (!this.pageStripConcealed) {
            return;
        }
        this.pageStripConcealed = false;
        this.layoutStatePreserver.revealPageStrip();
    }
    private resetIframeMinSize() {
        const contentRootElement = this.getContentRootElement();
        if (!contentRootElement || !this.iframe) {
            return;
        }

        const geometry = getLayoutGeometry(this.options);
        const body = getDocumentBody(contentRootElement.ownerDocument);
        this.iframe.style.removeProperty("transform");
        this.iframe.style.removeProperty("will-change");
        const renderer = this.owner.getRenderer()?.getRendererContainer();
        const columnWidth = parseFloat(renderer?.getAttribute("data-column-width") ?? "")
            || Math.round(this.iframe.getBoundingClientRect().width);
        const pageHeight = parseFloat(renderer?.getAttribute("data-page-height") ?? "")
            || Math.round(this.iframe.getBoundingClientRect().height);
        const columnGap = parseFloat(renderer?.getAttribute("data-column-gap") ?? "");
        geometry.sizeIframe({
            iframe: this.iframe,
            contentRoot: contentRootElement,
            body,
            forceScroll: !!this.options.forceScroll,
            columnWidth: Number.isFinite(columnWidth) ? Math.round(columnWidth) : 0,
            pageHeight: Number.isFinite(pageHeight) ? Math.round(pageHeight) : 0,
            columnGap: Number.isFinite(columnGap) && columnGap > 0 ? columnGap : 0,
            parentContentHeight: this.getParentContentHeight(this.iframe.parentElement),
        });
        if (geometry.useColumnLayout) {
            this.pageCalculator.calcNumberOfPages(true);
        }
    }

    private getParentContentHeight(parent: HTMLElement | null): number {
        if (!parent) {
            return 0;
        }
        const style = parent.ownerDocument.defaultView?.getComputedStyle(parent);
        const paddingTop = parseFloat(style?.paddingTop ?? "0") || 0;
        const paddingBottom = parseFloat(style?.paddingBottom ?? "0") || 0;
        return Math.max(0, Math.round(parent.clientHeight - paddingTop - paddingBottom));
    }
    async getContent(): Promise<string> {
        if (this.docContent) {
            return this.docContent;
        }
        this.docContent = await (await this.fileParser.getTextDocument(this.url)).getPlaintext();
        if (this.docContent.length > this.options.singleDocMaxSize) {
            return getTooBigHtmlTemplate(this.docContent.length);
        }
        return this.docContent;
    }
    private formattedVirtualDocument: Document;
    private async getFormattedVirtualDocument(): Promise<Document> {
        if (this.formattedVirtualDocument) {
            return this.formattedVirtualDocument;
        }
        const textDocument = await this.fileParser.getTextDocument(this.url) as IHtmlTextDocument;
        this.formattedVirtualDocument = await textDocument.getFormattedDocument();
        return this.formattedVirtualDocument;
    }

    override async getText(options?: TextFormatOptions): Promise<string> {
        const textDocument = await this.fileParser.getTextDocument(this.url) as IHtmlTextDocument;
        return await textDocument.getPlaintext(options);
    }

    private internalGetNumberOfPages(): number {
        let numberOfPages = 1;
        if (this.getFlipMode() == "page") {
            numberOfPages = this.pageCalculator.calcNumberOfPages();
        }
        return numberOfPages;
    }
    async getNumberOfPages(): Promise<number> {
        await this.load();
        return this.internalGetNumberOfPages();
    }
    async getPageNumber(target: Element | Range) {
        return this.pageCalculator.getPageNumber(target);
    }

    private getContentRootElement(): HTMLElement {
        if (this.inIframe) {
            return this.iframe?.contentDocument?.documentElement;
        }
        return this.wrapperContainer;
    }
    override getContentContainer(): HTMLElement {
        if (this.inIframe) {
            return getDocumentBody(this.iframe?.contentDocument);
        }
        return this.wrapperContainer;
    }
    async getVirtualContentContainer(raw?: boolean): Promise<HTMLElement> {
        if (raw) {
            const textDocument = await this.fileParser.getTextDocument(this.url) as IHtmlTextDocument;
            return getDocumentBody(await textDocument.getFormattedDocument());
        }
        const virtualDocument = await this.getFormattedVirtualDocument();
        return getDocumentBody(virtualDocument);
    }

    getVisibleElements(fullVisibleInWindow?: boolean): Element[] {
        if (this.loadStatus != "success") {
            return [];
        }
        const contentContainer = this.getContentContainer();
        const contentWindow = contentContainer?.ownerDocument?.defaultView;
        if (!contentContainer || !contentWindow) {
            return [];
        }

        if (!this.visibilityCandidates) {
            // Content units are shared anchors for visibility / progress / nav.
            this.visibilityCandidates = collectContentUnitElements(contentContainer, {
                htmlBlockTags: this.options.htmlBlockTags
            });
        }
        const rendererContainerTop = this.owner.getRenderer()?.getRendererContainer().getBoundingClientRect().top;
        // const topInset = this.getFlipMode() == "scroll"
        //     ? this.owner.optionsProvider.getHeaderHeight()
        //     : 0;
        const topInset = rendererContainerTop
        const viewport = resolveVisibleViewportInContentWindow(contentWindow, { topInset });
        if (!viewport) {
            return [];
        }

        return getOrderedElementsIntersectingRect(this.visibilityCandidates, viewport, {
            writingMode: getLayoutGeometry(this.options).writingMode,
            fullVisible: fullVisibleInWindow
        });
    }

    override async dispose(): Promise<void> {
        const layoutState = this.captureLayoutState();
        this.owner.events.emit(EventNames.DocumentDisposing, this);
        this.unbindDocumentEvents();
        this.resizeObserver.unobserveIframeSize();
        this.callbacks?.splice(0);
        this.visibilityCandidates = null;
        this.retainLoadingLayer = false;
        await this.releaseLoadingLayer();
        const wrapperContainer = this.getWrapperContainer();
        wrapperContainer.classList.add(HtmlSettings.FileContentContainerHeightClassName);
        // Vertical-scroll unloaded slots keep one viewport width via this class + --reader-viewport-width.
        if (this.iframe && wrapperContainer.contains(this.iframe)) {
            wrapperContainer.removeChild(this.iframe);
        }
        emptyElement(this.wrapperContainer);
        this.iframe = undefined;
        this.formattedVirtualDocument = null;
        await this.symbolCalclator.dispose();
        await this.restoreLayoutState(layoutState);
        await super.dispose();
    }

    private capture = true;
    private bindDocumentEvents(): void {
        const rootContainer = this.inIframe ? this.getContentContainer().ownerDocument : this.getContentRootElement();
        for (const key of this.eventKeyMap.keys()) {
            rootContainer.addEventListener(key, this.eventListener, this.capture);
        }
    }
    private unbindDocumentEvents() {
        const rootContainer = this.inIframe ? this.getContentContainer()?.ownerDocument : this.getContentRootElement();
        if (!rootContainer) {
            return;
        }
        for (const key of this.eventKeyMap.keys()) {
            rootContainer?.removeEventListener(key, this.eventListener, this.capture);
        }
    }
    private eventListener = (e: Event) => {
        const customEventKey = this.eventKeyMap.get(e.type as any);
        if (customEventKey) {
            this.owner.events.emit(customEventKey, e, this);
        }
    };
    private getFlipMode(): FlipMode {
        if (this.options.forceScroll) {
            return "scroll";
        }
        return this.options.flipMode;
    }
}
