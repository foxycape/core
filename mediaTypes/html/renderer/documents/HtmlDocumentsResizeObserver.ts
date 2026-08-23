import { asyncDebounce, Context, EventNames, IDisposable, IDocumentsProvider, IEventEmitter, IProgressTracker, yieldToMain } from "../../../../kernal";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlRendererLayout } from "../layout/IHtmlRendererLayout";
import { HtmlSettings } from "../../HtmlSettings";
import { consumeDocumentHiddenRestore, isCollapsedSize, markDocumentHidden } from "./documentHiddenState";

export class HtmlDocumentsResizeObserver implements IDisposable {
    private rendererContainerResizeObserver: ResizeObserver;
    private readonly rendererContainer: HTMLElement;
    private readonly context: Context;
    private readonly events: IEventEmitter;
    private visualViewport: VisualViewport | null = null;
    constructor(
        private readonly documentsProvider: IDocumentsProvider,
        private readonly rendererViewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly progressTracker: IProgressTracker,
        private readonly rendererLayout: IHtmlRendererLayout
    ) {
        this.rendererContainer = this.documentsProvider.getRendererContainer();
        this.context = this.documentsProvider.owner.context;
        this.events = this.documentsProvider.owner.events;
    }

    register() {
        this.rendererContainerResizeObserver = new ResizeObserver(async entries => {
            // this.logger.debug("rendererContainerResizeObserver...", 'entries', entries);
            const entry = entries[0]
            const target = entry.target as HTMLElement;
            const originWidth = parseFloat(target.getAttribute("data-client-width"));
            const originHeight = parseFloat(target.getAttribute("data-client-height"));
            const currentWidth = entry.contentRect?.width ?? entry.borderBoxSize[0].inlineSize ?? 0;
            const currentHeight = entry.contentRect?.height ?? entry.borderBoxSize[0].blockSize ?? 0;
            const hostViewport = this.documentsProvider.owner.getHostViewport();
            const treatZeroHeight = hostViewport.mode != "window";
            if (isCollapsedSize(currentWidth, currentHeight, treatZeroHeight)) {
                markDocumentHidden(this.rendererContainer);
                return;
            }
            if (consumeDocumentHiddenRestore(this.rendererContainer)) {
                return;
            }
            if (hostViewport.mode == "window") {
                if (originWidth == currentWidth) {
                    this.rendererContainer.setAttribute("data-client-height", `${currentHeight}`);
                    return;
                }
            }
            else if (originWidth == currentWidth && originHeight == currentHeight) {
                return;
            }
            this.rendererContainer.setAttribute("data-client-width", `${currentWidth}`)
            this.rendererContainer.setAttribute("data-client-height", `${currentHeight}`)
            // this.logger.debug("onWindowResize", 'currentLocation', this.runtime.context.resource.currentLocation, 'json', JSON.stringify(this.runtime.context.resource.currentLocation));

            if (!this.context?.currentLocation?.precise) {
                const progress = await this.progressTracker.getProgress(true)
                if (progress) {
                    this.context.currentLocation = progress.location;
                }
            }
            this.context.setUserChangedProgress(false)
            await this.delayResizeRendererContainer();
        });

        this.rendererContainerResizeObserver.observe(this.rendererContainer);
        const view = this.rendererContainer.ownerDocument.defaultView;
        this.visualViewport = view?.visualViewport ?? null;
        this.visualViewport?.addEventListener("resize", this.onVisualViewportResize);
    }

    private onVisualViewportResize = () => {
        const owner = this.documentsProvider.owner;
        if (owner.getHostViewport().mode != "window") {
            return;
        }
        const viewport = owner.refreshHostViewport();
        const readerContainer = owner.getReaderContainer();
        if (readerContainer) {
            readerContainer.style.minHeight = viewport.height + "px";
        }
        void this.delayResizeRendererContainer();
    };

    protected resizeRendererContainer = async () => {
        if (!this.context) {
            return;
        }
        // The container is hidden, for example, using display:none
        const treatZeroHeight = this.documentsProvider.owner.getHostViewport().mode != "window";
        if (isCollapsedSize(this.rendererContainer.clientWidth, this.rendererContainer.clientHeight, treatZeroHeight)) {
            markDocumentHidden(this.rendererContainer);
            return;
        }

        // The container is hidden and then restored for the first time
        if (consumeDocumentHiddenRestore(this.rendererContainer)) {
            return;
        }
        this.rendererViewport.applyCssVariables();
        await this.rendererLayout.applyStyles();
        await yieldToMain();
        // Column metrics changed: drop cached page counts so reload remaps against the new layout.
        for (const doc of this.documentsProvider.getLoadedDocuments()) {
            doc.getContentContainer()?.ownerDocument?.documentElement
                ?.removeAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName);
        }
        await this.documentsProvider.reload();
        this.events.emit(EventNames.RendererContainerSizeChange, this.rendererContainer, this.context.userChangedProgress);
    }

    protected delayResizeRendererContainer = asyncDebounce(this.resizeRendererContainer, 100)

    async dispose(): Promise<void> {
        this.visualViewport?.removeEventListener("resize", this.onVisualViewportResize);
        this.visualViewport = null;
        this.rendererContainerResizeObserver?.disconnect();
    }
}   