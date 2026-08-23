import { EventNames, IDisposable, IDocument, IDocumentsProvider, IEventEmitter } from "../../../../kernal";
import { isHostContainerCollapsed } from "./documentHiddenState";

/**
 * HTML intersection observer。
 */
export class HtmlDocumentsIntersectionObserver implements IDisposable {
    private contentContainerIntersectionObserver: IntersectionObserver;
    private readonly documentMap: Map<Element, IDocument> = new Map();
    private readonly events: IEventEmitter;

    constructor(
        private readonly documentsProvider: IDocumentsProvider
    ) {
        this.events = this.documentsProvider.owner.events;
    }

    register() {
        const hostViewport = this.documentsProvider.owner.getHostViewport();
        const root = hostViewport.mode == "host"
            ? this.documentsProvider.getRendererContainer()
            : hostViewport.observerRoot;
        this.contentContainerIntersectionObserver = new IntersectionObserver(entries => {
            if (this.isRendererCollapsed()) {
                return;
            }
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const isVisible = entry.isIntersecting || entry.intersectionRatio > 0;
                this.setDocumentVisible(entry.target, isVisible);
                const doc = this.documentMap.get(entry.target);
                if (doc) {
                    this.events.emit(EventNames.DocumentVisibleChange, doc, isVisible);
                }
            }
        }, { root, rootMargin: "-2px" });

        this.observeContainers();
    }

    unregister() {
        this.contentContainerIntersectionObserver?.disconnect();
        this.contentContainerIntersectionObserver = undefined;
        this.documentMap.clear();
    }

    private observeContainers() {
        for (const doc of this.documentsProvider.getDocuments()) {
            this.documentMap.set(doc.getWrapperContainer(), doc);
            this.contentContainerIntersectionObserver.observe(doc.getWrapperContainer());
        }
    }

    private isRendererCollapsed() {
        const renderer = this.documentsProvider.getRendererContainer();
        const treatZeroHeight = this.documentsProvider.owner.getHostViewport().mode != "window";
        return isHostContainerCollapsed(renderer, treatZeroHeight);
    }

    private setDocumentVisible = (wrapperContainer: Element, isVisible: boolean) => {
        wrapperContainer.isVisible = isVisible;
    }

    async dispose(): Promise<void> {
        this.unregister();
    }
}
