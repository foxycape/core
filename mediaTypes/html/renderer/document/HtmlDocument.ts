import { getDocumentBody } from "../../../../kernal/html/finder";
import { getOrderedElementsIntersectingRect, resolveVisibleViewportInContentWindow } from "../../../../kernal/html/geometry";
import { emptyElement, setElementHtml } from "../../../../kernal/html/dom";
import { getUuid } from "../../../../kernal/common/uuid";
import { EventNames, FlipMode, IFileParser, ILogger, LocationState, TextFormatOptions, SpineFile, readerPrefixName, yieldToMain } from "../../../../kernal";
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
import { HtmlSymbolCalclator } from "./HtmlSymbolCalclator";
import { HtmlDocumentResizeObserver } from "./HtmlDocumentResizeObserver";
import { collectContentUnitElements } from "../visibilityCandidates";
import { resolveLayoutFlow } from "../layout/resolveLayoutFlow";
import { ViewportCssVariableNames } from "../layout/ViewportCssVariableNames";
import { HtmlLayoutStatePreserver } from "../location/HtmlLayoutStatePreserver";

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
        this.symbolCalclator = new HtmlSymbolCalclator(this, options);
        this.layoutStatePreserver = new HtmlLayoutStatePreserver(this, viewport, options);
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);
        this.resizeObserver = new HtmlDocumentResizeObserver(this, this.owner.events);
    }

    override get inIframe(): boolean {
        return true;
    }

    private callbacks: { resolve: any; reject: any; }[] = [];
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

            try {
                if (this.inIframe) {
                    if (!this.iframe) {
                        const iframeId = readerPrefixName + getUuid(true);
                        this.iframe = createIframe(this.wrapperContainer.ownerDocument, iframeId, this.options.forceScroll, resolveLayoutFlow(this.options));
                        if (this.options.forceScroll) {
                            this.iframe.removeAttribute("scrolling");
                        }
                        else {
                            this.iframe.setAttribute("scrolling", "no");
                        }
                        const loadingContent = await this.buildLoadingContent();
                        await yieldToMain();
                        this.wrapperContainer.appendChild(this.iframe);

                        await yieldToMain();
                        this.iframe.addEventListener("load", async () => {
                            await this.processAfterLoaded();
                        }, false);
                        this.iframe.addEventListener("error", (err) => {
                            this.loadingLayer?.removeLoadingLayer();
                            this.loadStatus = "fail";
                            this.iframe = undefined;
                            this.loadingLayer?.setReloadButton();
                            this.logger.error(err);
                            this.owner.events.emit(EventNames.DocumentLoadFailed, this, err);
                            this.loadCompleted(true);
                        }, false);
                        const iframeDocument = this.iframe.contentDocument;
                        if ((this.options.preferSrcdoc && "srcdoc" in this.iframe) || !("write" in iframeDocument)) {
                            this.iframe.srcdoc = loadingContent;
                        }
                        else {
                            iframeDocument.open();
                            iframeDocument.write(loadingContent);
                            iframeDocument.close();
                            await yieldToMain();
                        }
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
                this.logger.error(error);
                if (!this.owner?.context) {
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
            finally {
                await this.loadingLayer?.dispose();
                this.loadingLayer = undefined;
            }
        });
    }
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

        let loadingContent = virtualDocument.documentElement.outerHTML;
        if (this.owner.onRenderingFileInject) {
            loadingContent = await this.owner.onRenderingFileInject(this.extension, loadingContent, this.url);
        }
        loadingContent = loadingContent.replace(/<([^<]*)\?xml([^>]*)\?.*?>/i, "");
        const existDocType = loadingContent.match(/<!DOCTYPE[^>]*>/i);
        if (!existDocType) {
            loadingContent = "<!DOCTYPE html>" + loadingContent;
        }
        return loadingContent;
    };

    private processAfterLoaded = async () => {
        const contentContainer = this.getContentContainer();
        if (!contentContainer) {
            return;
        }
        contentContainer.setAttribute("data-url", this.url);
        const layoutState = this.captureLayoutState();
        this.wrapperContainer.classList.remove(HtmlSettings.FileContentContainerHeightClassName);
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
        await this.restoreLayoutState(layoutState);
        this.loadingLayer?.removeLoadingLayer();
        this.loadStatus = "success";
        this.visibilityCandidates = null;
        this.bindDocumentEvents();
        this.owner.events.emit(EventNames.DocumentLoad, this);
        this.resizeObserver.observeIframeSize(async () => {
            const resizeState = this.captureLayoutState();
            this.resetLayoutSizes();
            if (this.getFlipMode() == "page") {
                this.pageCalculator.calcNumberOfPages(true);
            }
            await this.restoreLayoutState(resizeState);
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
        await this.layoutStatePreserver.restore(locationState);
    }
    private resetIframeMinSize() {
        const contentRootElement = this.getContentRootElement();
        if (!contentRootElement || !this.iframe) {
            return;
        }

        const flow = resolveLayoutFlow(this.options);
        const body = getDocumentBody(contentRootElement.ownerDocument);
        this.iframe.style.removeProperty("transform");
        this.iframe.style.removeProperty("will-change");
        if (flow.useColumnLayout) {
            this.growIframeToColumnOverflow(contentRootElement, body, flow.pageAxis);
            this.pageCalculator.calcNumberOfPages(true);
            return;
        }
        if (flow.iframeGrow == "width") {
            this.iframe.style.removeProperty("min-height");
            this.iframe.style.removeProperty("min-width");
            const lockedHeight = this.getParentContentHeight(this.iframe.parentElement) || this.iframe.clientHeight;
            this.iframe.style.height = lockedHeight
                ? lockedHeight + "px"
                : `var(${ViewportCssVariableNames.ContentContainerHeight})`;
            this.iframe.style.width = "auto";
            if (lockedHeight) {
                contentRootElement.style.height = lockedHeight + "px";
                contentRootElement.style.maxHeight = lockedHeight + "px";
                if (body) {
                    body.style.height = lockedHeight + "px";
                    body.style.maxHeight = lockedHeight + "px";
                }
            }
            void this.iframe.offsetWidth;
            this.iframe.style.minWidth = Math.max(1, contentRootElement.scrollWidth) + "px";
            return;
        }
        this.clearInlineContentBox(contentRootElement, body);
        this.iframe.style.removeProperty("min-width");
        this.iframe.style.setProperty(
            "width",
            this.options.forceScroll
                ? "100%"
                : `var(${ViewportCssVariableNames.ContentContainerWidth})`
        );
        this.iframe.style.setProperty("height", `var(${ViewportCssVariableNames.ContentContainerHeight})`);
        const iframeMinHeight = contentRootElement.getBoundingClientRect().height;
        this.iframe.style.minHeight = Math.round(iframeMinHeight) + "px";
    }

    /**
     * Grow the iframe to the columned content size.
     * Old min-width/min-height must be cleared and the iframe locked to the
     * current page box first; otherwise scrollWidth/Height stays at the previous
     * iframe size and later documents get the wrong offset for transformPage.
     */
    private growIframeToColumnOverflow(rootContent: HTMLElement, body: HTMLElement | null, axis: "x" | "y") {
        this.clearInlineContentBox(rootContent, body);
        this.iframe.style.removeProperty("min-width");
        this.iframe.style.removeProperty("min-height");
        this.iframe.style.setProperty("width", `var(${ViewportCssVariableNames.ContentContainerWidth})`);
        this.iframe.style.setProperty("height", `var(${ViewportCssVariableNames.ContentContainerHeight})`);
        const restoreMeasureStyles = this.beginColumnOverflowMeasure(rootContent, body, axis);
        try {
            if (axis == "y") {
                void this.iframe.offsetHeight;
                void rootContent.offsetHeight;
                const grownHeight = Math.max(1, rootContent.scrollHeight, body?.scrollHeight ?? 0);
                this.iframe.style.height = "auto";
                this.iframe.style.minHeight = grownHeight + "px";
                return;
            }
            void this.iframe.offsetWidth;
            void rootContent.offsetWidth;
            // const grownWidth = Math.max(1, rootContent.scrollWidth, body?.scrollWidth ?? 0);
            const iframeMinWidth = rootContent.scrollWidth
            const bodyWidth = getDocumentBody(rootContent.ownerDocument).getBoundingClientRect().width;
            const grownWidth = Math.min(iframeMinWidth, bodyWidth);
            // this.iframe.style.width = "auto";
            this.iframe.style.setProperty("width", `var(${ViewportCssVariableNames.ContentContainerWidth})`);
            this.iframe.style.minWidth = grownWidth + "px";
        }
        finally {
            restoreMeasureStyles();
        }
    }

    /**
     * RTL columns overflow to the left, so html.scrollWidth stays at one page.
     * Measure as LTR (and without min-width:100%) so extra columns extend to the right.
     */
    private beginColumnOverflowMeasure(rootContent: HTMLElement, body: HTMLElement | null, axis: "x" | "y"): () => void {
        const originMinWidth = rootContent.style.minWidth;
        const originDirection = rootContent.style.direction;
        const originBodyDirection = body?.style.direction ?? "";
        const hadRtlClass = rootContent.classList.contains(HtmlSettings.RtlProgressionClassName);
        const shouldMeasureAsLtr = axis == "x" && resolveLayoutFlow(this.options).isRtlProgression;
        rootContent.style.setProperty("min-width", "0", "important");
        if (shouldMeasureAsLtr) {
            rootContent.style.setProperty("direction", "ltr", "important");
            body?.style.setProperty("direction", "ltr", "important");
            rootContent.classList.remove(HtmlSettings.RtlProgressionClassName);
        }
        return () => {
            if (originMinWidth) {
                rootContent.style.minWidth = originMinWidth;
            }
            else {
                rootContent.style.removeProperty("min-width");
            }
            if (!shouldMeasureAsLtr) {
                return;
            }
            if (originDirection) {
                rootContent.style.direction = originDirection;
            }
            else {
                rootContent.style.removeProperty("direction");
            }
            if (body) {
                if (originBodyDirection) {
                    body.style.direction = originBodyDirection;
                }
                else {
                    body.style.removeProperty("direction");
                }
            }
            if (hadRtlClass) {
                rootContent.classList.add(HtmlSettings.RtlProgressionClassName);
            }
        };
    }

    private clearInlineContentBox(rootContent: HTMLElement, body: HTMLElement | null) {
        rootContent.style.removeProperty("height");
        rootContent.style.removeProperty("max-height");
        rootContent.style.removeProperty("width");
        if (!body) {
            return;
        }
        body.style.removeProperty("height");
        body.style.removeProperty("max-height");
        body.style.removeProperty("width");
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
    async getPageNumber(element: Element) {
        return this.pageCalculator.getPageNumber(element);
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

        const topInset = this.getFlipMode() == "scroll"
            ? this.owner.optionsProvider.getHeaderHeight()
            : 0;
        const viewport = resolveVisibleViewportInContentWindow(contentWindow, { topInset });
        if (!viewport) {
            return [];
        }

        return getOrderedElementsIntersectingRect(this.visibilityCandidates, viewport, {
            writingMode: resolveLayoutFlow(this.options).writingMode,
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
        const wrapperContainer = this.getWrapperContainer();
        wrapperContainer.classList.add(HtmlSettings.FileContentContainerHeightClassName);
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
        const rootContainer = this.inIframe ? this.getContentContainer().ownerDocument : this.getContentRootElement();
        for (const key of this.eventKeyMap.keys()) {
            rootContainer.removeEventListener(key, this.eventListener, this.capture);
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
