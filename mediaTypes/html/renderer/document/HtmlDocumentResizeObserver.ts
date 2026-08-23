import { EventNames, IEventEmitter } from "../../../../kernal";
import { isHostContainerCollapsed } from "../documents/documentHiddenState";
import { IHtmlDocument } from "../IHtmlDocument";

export class HtmlDocumentResizeObserver {
    private resizeObserver: ResizeObserver | null = null;
    private lastContentWidth = Number.NaN;
    private lastContentHeight = Number.NaN;
    private isHidden = false;

    constructor(private readonly doc: IHtmlDocument,
        private readonly events: IEventEmitter
    ) {
    }

    observeIframeSize(callback?: () => Promise<void>) {
        this.resizeObserver = new ResizeObserver(async (entries) => {
            if (this.shouldIgnoreResize(entries)) {
                return;
            }
            await callback?.();
            this.events.emit(EventNames.DocumentSizeChange, this.doc);
        });
        const rootContainer = this.getContentRootElement();
        if (rootContainer) {
            this.resizeObserver.observe(rootContainer);
        }
        const contentContainer = this.doc.getContentContainer();
        if (contentContainer && contentContainer != rootContainer) {
            this.resizeObserver.observe(contentContainer);
        }
    }

    unobserveIframeSize() {
        if (this.resizeObserver) {
            const rootContainer = this.getContentRootElement();
            if (rootContainer) {
                this.resizeObserver.unobserve(rootContainer);
            }
            const contentContainer = this.doc.getContentContainer();
            if (contentContainer && contentContainer != rootContainer) {
                this.resizeObserver.unobserve(contentContainer);
            }
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.isHidden = false;
        this.lastContentWidth = Number.NaN;
        this.lastContentHeight = Number.NaN;
    }

    private shouldIgnoreResize(entries: ResizeObserverEntry[]): boolean {
        if (this.isHostCollapsed()) {
            this.isHidden = true;
            return true;
        }

        const size = this.getObservedSize(entries);
        if (this.isHidden) {
            if (size.width == 0 && size.height == 0) {
                return true;
            }
            this.isHidden = false;
            const unchanged = this.isSameSize(size.width, size.height);
            this.rememberSize(size.width, size.height);
            return unchanged;
        }

        this.rememberSize(size.width, size.height);
        return false;
    }

    private isHostCollapsed(): boolean {
        const wrapper = this.doc.getWrapperContainer();
        if (wrapper && wrapper.clientWidth == 0 && wrapper.clientHeight == 0) {
            return true;
        }
        const renderer = this.doc.owner.getRenderer()?.getRendererContainer();
        const treatZeroHeight = this.doc.owner.getHostViewport().mode != "window";
        return isHostContainerCollapsed(renderer, treatZeroHeight);
    }

    private getObservedSize(entries: ResizeObserverEntry[]) {
        let width = 0;
        let height = 0;
        for (const entry of entries) {
            const nextWidth = entry.contentRect?.width ?? 0;
            const nextHeight = entry.contentRect?.height ?? 0;
            if (nextWidth > width) {
                width = nextWidth;
            }
            if (nextHeight > height) {
                height = nextHeight;
            }
        }
        return { width, height };
    }

    private isSameSize(width: number, height: number) {
        return Number.isFinite(this.lastContentWidth)
            && Math.abs(width - this.lastContentWidth) < 1
            && Math.abs(height - this.lastContentHeight) < 1;
    }

    private rememberSize(width: number, height: number) {
        this.lastContentWidth = width;
        this.lastContentHeight = height;
    }

    private getContentRootElement(): HTMLElement {
        if (this.doc.inIframe) {
            return this.doc?.getContentContainer()?.ownerDocument?.documentElement;
        }
        return this.doc.getWrapperContainer();
    }
}
