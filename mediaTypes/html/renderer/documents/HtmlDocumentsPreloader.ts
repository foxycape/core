import { EventNames } from "../../../../kernal/EventNames";
import { HtmlOptions } from "../../HtmlOptions";
import { asyncDebounce, IDocument, IDocumentsProvider, IEventEmitter, yieldToMain } from "../../../../kernal";
import { IHtmlDocumentsPreloader } from "./IHtmlDocumentsPreloader";

type EdgeRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

const isDocumentScroller = (scrollElement: HTMLElement, doc: Document) =>
    scrollElement === doc.scrollingElement
    || scrollElement === doc.documentElement
    || scrollElement === doc.body;

const rectsIntersect = (a: EdgeRect, b: EdgeRect) =>
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;

/**
 * HTML document preloading and unnecessary document release.
 */
export class HtmlDocumentsPreloader implements IHtmlDocumentsPreloader {
    private preloadToken = 0;

    constructor(
        private readonly events: IEventEmitter,
        private readonly documentsProvider: IDocumentsProvider,
        private readonly getLoadingDocument: () => IDocument,
        private readonly htmlOptions: HtmlOptions
    ) {
        this.bindEvents();
    }

    private bindEvents() {
        this.events.on(EventNames.DocumentVisibleChange, this.onDocumentVisibleChange);
        this.events.on(EventNames.ReaderDebounceScroll, this.onReaderScroll);
    }

    private unbindEvents() {
        this.events.off(EventNames.DocumentVisibleChange, this.onDocumentVisibleChange);
        this.events.off(EventNames.ReaderDebounceScroll, this.onReaderScroll);
    }

    private onDocumentVisibleChange = () => {
        void this.delayPreloadDocuments();
    }

    private onReaderScroll = () => {
        void this.delayPreloadDocuments();
    }

    async dispose(): Promise<void> {
        this.preloadToken++;
        this.unbindEvents();
    }

    preloadDocuments = async (): Promise<void> => {
        const token = ++this.preloadToken;
        try {
            const visibleDocuments = this.resolveVisibleDocuments();
            if (!visibleDocuments || visibleDocuments.length == 0) {
                return;
            }
            for (const doc of visibleDocuments) {
                if (token !== this.preloadToken) {
                    return;
                }
                await doc.load();
            }
            if (token !== this.preloadToken) {
                return;
            }
            await this.preloadRelatedDocuments(
                visibleDocuments[0],
                visibleDocuments[visibleDocuments.length - 1],
                token
            );
        }
        catch (e) { /* empty */ }
    }

    private delayPreloadDocuments = asyncDebounce(() => this.preloadDocuments(), 500)

    private resolveVisibleDocuments(): IDocument[] {
        const viewport = this.getViewportRect();
        if (!viewport) {
            return this.documentsProvider.getVisibleDocuments();
        }
        const visibleDocuments: IDocument[] = [];
        for (const doc of this.documentsProvider.getDocuments()) {
            const wrapper = doc.getWrapperContainer();
            if (!wrapper) {
                continue;
            }
            const isVisible = rectsIntersect(wrapper.getBoundingClientRect(), viewport);
            wrapper.isVisible = isVisible;
            if (isVisible) {
                visibleDocuments.push(doc);
            }
        }
        return visibleDocuments;
    }

    private getViewportRect(): EdgeRect | undefined {
        const scrollElement = this.documentsProvider.getScrollElement();
        const renderer = this.documentsProvider.getRendererContainer();
        const doc = (scrollElement ?? renderer)?.ownerDocument;
        if (scrollElement && doc && isDocumentScroller(scrollElement, doc)) {
            const view = doc.defaultView;
            if (!view) {
                return undefined;
            }
            return {
                left: 0,
                top: 0,
                right: view.innerWidth,
                bottom: view.innerHeight,
            };
        }
        return (scrollElement ?? renderer)?.getBoundingClientRect();
    }

    private async preloadRelatedDocuments(startDocument: IDocument, endDocument: IDocument, token: number): Promise<void> {
        const documents = this.documentsProvider.getDocuments();
        const startIndex = documents.indexOf(startDocument);
        const endIndex = documents.indexOf(endDocument);
        const total = documents.length;
        const reservedDocuments: IDocument[] = [];
        for (let i = startIndex; i <= endIndex; i++) {
            const doc = documents[i];
            if (doc && !reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
        }
        const prepareDocuments: IDocument[] = [];
        let preloadFileCount = this.htmlOptions.preloadFileCount;
        if (preloadFileCount > 10)
            preloadFileCount = 10;
        if (preloadFileCount < 1) {
            preloadFileCount = 1;
        }

        for (let i = 1; i <= preloadFileCount; i++) {
            const nextIndex = endIndex + i;
            if (nextIndex > 0 && nextIndex <= total - 1) {
                prepareDocuments.push(documents[nextIndex]);
            }

            const previousIndex = startIndex - i;
            if (previousIndex >= 0) {
                prepareDocuments.push(documents[previousIndex]);
            }
        }

        for (let i = 0; i < prepareDocuments.length; i++) {
            if (token !== this.preloadToken) {
                return;
            }
            const doc = prepareDocuments[i];
            await doc.load();
            if (doc && !reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
            await yieldToMain();
        }
        const rendererContainerClientWidth = this.documentsProvider.getRendererContainer().clientWidth;
        // if the flip mode is page, continue to check the previous screen and the next screen for content
        if (this.htmlOptions.flipMode == 'page') {
            let previousDocumentsLength = 0;
            for (let i = startIndex - 1; i >= 0; i--) {
                if (token !== this.preloadToken) {
                    return;
                }
                const doc = documents[i];
                await doc.load();
                if (doc && !reservedDocuments.includes(doc)) {
                    reservedDocuments.push(doc);
                }
                previousDocumentsLength += doc.getWrapperContainer().clientWidth;
                if (previousDocumentsLength >= rendererContainerClientWidth) {
                    break;
                }
                await yieldToMain();
            }
            let nextDocumentsLength = 0;
            for (let i = endIndex + 1; i < total - 1; i++) {
                if (token !== this.preloadToken) {
                    return;
                }
                const doc = documents[i];
                await doc.load();
                if (doc && !reservedDocuments.includes(doc)) {
                    reservedDocuments.push(doc);
                }
                nextDocumentsLength += doc.getWrapperContainer().clientWidth;
                if (nextDocumentsLength >= rendererContainerClientWidth) {
                    break;
                }
                await yieldToMain();
            }
        }

        const loadingDoc = this.getLoadingDocument();
        if (loadingDoc && !reservedDocuments.includes(loadingDoc)) {
            reservedDocuments.push(loadingDoc);
        }
        const visibleDocuments = this.documentsProvider.getVisibleDocuments();
        for (const doc of visibleDocuments) {
            if (!reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
        }
        if (token !== this.preloadToken) {
            return;
        }
        await this.removeUnnecessaryDocuments(reservedDocuments, token);
        reservedDocuments.splice(0);
    }

    private async removeUnnecessaryDocuments(reservedDocuments: IDocument[], token: number) {
        if (!reservedDocuments) {
            return;
        }
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            if (token !== this.preloadToken) {
                return;
            }
            if (!reservedDocuments.includes(doc)) {
                await this.disposeDocument(doc);
                await yieldToMain();
            }
        }
    }

    private checkContainFullscreenElement = (doc: IDocument) => {
        return !!(doc?.getContentContainer()?.ownerDocument?.fullscreenElement);
    }

    private async disposeDocument(doc: IDocument) {
        if (this.checkContainFullscreenElement(doc)) {
            // cannot release documents with fullscreen elements
            return;
        }
        await doc.dispose();
    }
}
