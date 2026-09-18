import { EventNames } from "../../../../kernal/EventNames";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { asyncDebounce, IDocument, IDocumentsProvider, IEventEmitter, yieldToMain } from "../../../../kernal";
import { pickVisibleCompensationDocument } from "../layout/geometry/restoreLayoutState";
import { getLayoutGeometry } from "../layout/resolveLayoutRoute";
import { IHtmlDocumentsPreloader } from "./IHtmlDocumentsPreloader";
import { isProgrammaticScroll, isUserScrollSettling, markUserScroll, releaseAbsoluteLocate, USER_SCROLL_SETTLE_MS } from "../location/scrollActivity";
import { collectPreloadNeighbors } from "./preloadNeighbors";
import { isSubstantialWrapperRect, rectsIntersect, type EdgeRect } from "./wrapperVisibility";

export const SCROLL_PRELOAD_SETTLE_MS = USER_SCROLL_SETTLE_MS;

const isDocumentScroller = (scrollElement: HTMLElement, doc: Document) =>
    scrollElement === doc.scrollingElement
    || scrollElement === doc.documentElement
    || scrollElement === doc.body;

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
        this.events.on(EventNames.PageChange, this.onPageChange);
    }

    private unbindEvents() {
        this.events.off(EventNames.DocumentVisibleChange, this.onDocumentVisibleChange);
        this.events.off(EventNames.ReaderDebounceScroll, this.onReaderScroll);
        this.events.off(EventNames.PageChange, this.onPageChange);
    }

    private onDocumentVisibleChange = () => {
        if (isProgrammaticScroll()) {
            return;
        }
        this.schedulePreload();
    }

    private onReaderScroll = (_state?: unknown, e?: Event) => {
        if (isProgrammaticScroll() || (e && !e.isTrusted)) {
            return;
        }
        markUserScroll();
        releaseAbsoluteLocate();
        this.schedulePreload();
    }

    private onPageChange = () => {
        this.schedulePreload();
    }

    async dispose(): Promise<void> {
        this.preloadToken++;
        this.unbindEvents();
    }

    preloadDocuments = async (): Promise<void> => {
        if (this.isPageMoving()) {
            this.preloadToken++;
            this.delayPreloadAfterMove();
            return;
        }
        const token = ++this.preloadToken;
        try {
            const visibleDocuments = this.resolveVisibleDocuments();
            const geometry = getLayoutGeometry(this.htmlOptions);
            const useVisualEdge = geometry.preloadRangeMode == "visual-edge";
            const startDocument = useVisualEdge
                ? this.resolvePreloadAnchor(visibleDocuments)
                : visibleDocuments[0];
            const endDocument = useVisualEdge
                ? startDocument
                : visibleDocuments[visibleDocuments.length - 1];
            if (!startDocument || !endDocument) {
                return;
            }
            const loadDocuments = visibleDocuments.length > 0 ? visibleDocuments : [startDocument];
            for (const doc of loadDocuments) {
                if (this.shouldAbortPreload(token)) {
                    return;
                }
                await doc.load();
            }
            if (this.shouldAbortPreload(token)) {
                return;
            }
            await this.preloadRelatedDocuments(startDocument, endDocument, token);
        }
        catch (e) { /* empty */ }
    }

    private delayPreloadDocuments = asyncDebounce(() => this.preloadDocuments(), 500)
    private delayPreloadAfterMove = asyncDebounce(() => this.preloadDocuments(), 80)

    private schedulePreload = () => {
        this.abortPreloadIfPageMoving();
        if (this.isPageMoving()) {
            this.delayPreloadAfterMove();
            return;
        }
        this.delayPreloadDocuments();
    }

    private resolveVisibleDocuments(): IDocument[] {
        const geometry = getLayoutGeometry(this.htmlOptions);
        if (geometry.preloadRangeMode == "visible-span") {
            return this.resolveIntersectingDocuments(false);
        }
        if (!geometry.rewritesWrapperVisibility) {
            return this.documentsProvider.getVisibleDocuments();
        }
        return this.resolveIntersectingDocuments(true);
    }

    private resolveIntersectingDocuments(requireSubstantial: boolean): IDocument[] {
        const viewport = this.getViewportRect();
        if (!viewport) {
            const visible = this.documentsProvider.getVisibleDocuments();
            return requireSubstantial
                ? visible.filter((doc) =>
                    isSubstantialWrapperRect(doc.getWrapperContainer()?.getBoundingClientRect())
                )
                : visible;
        }
        const visibleDocuments: IDocument[] = [];
        for (const doc of this.documentsProvider.getDocuments()) {
            const wrapper = doc.getWrapperContainer();
            if (!wrapper) {
                continue;
            }
            const rect = wrapper.getBoundingClientRect();
            const isVisible = rectsIntersect(rect, viewport)
                && (!requireSubstantial || isSubstantialWrapperRect(rect));
            wrapper.isVisible = isVisible;
            if (isVisible) {
                visibleDocuments.push(doc);
            }
        }
        return visibleDocuments;
    }

    private resolvePreloadAnchor(visibleDocuments: IDocument[]): IDocument | undefined {
        const geometry = getLayoutGeometry(this.htmlOptions);
        const picked = pickVisibleCompensationDocument(
            visibleDocuments,
            geometry.compensationAnchorEdge,
            (doc) => {
                const rect = doc.getWrapperContainer()?.getBoundingClientRect();
                if (!rect || !isSubstantialWrapperRect(rect)) {
                    return undefined;
                }
                return geometry.getCompensationRect(rect);
            },
        );
        return picked ?? this.documentsProvider.getDocuments()[0];
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
        const prepareDocuments = collectPreloadNeighbors(
            documents,
            startIndex,
            endIndex,
            this.htmlOptions.preloadFileCount,
            this.shouldPreloadPreviousFirst(),
        );

        for (let i = 0; i < prepareDocuments.length; i++) {
            if (this.shouldAbortPreload(token)) {
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
        if (getLayoutGeometry(this.htmlOptions).preloadRangeMode == "page-fill") {
            let previousDocumentsLength = 0;
            for (let i = startIndex - 1; i >= 0; i--) {
                if (this.shouldAbortPreload(token)) {
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
            for (let i = endIndex + 1; i < total; i++) {
                if (this.shouldAbortPreload(token)) {
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
        if (!reservedDocuments.includes(startDocument)) {
            reservedDocuments.push(startDocument);
        }
        const geometry = getLayoutGeometry(this.htmlOptions);
        const visibleDocuments = geometry.preloadRangeMode == "visual-edge"
            ? this.documentsProvider.getVisibleDocuments().filter((doc) =>
                isSubstantialWrapperRect(doc.getWrapperContainer()?.getBoundingClientRect())
            )
            : this.documentsProvider.getVisibleDocuments();
        for (const doc of visibleDocuments) {
            if (!reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
        }
        if (this.shouldAbortPreload(token)) {
            return;
        }
        if (this.isScrollSettling()) {
            this.delayPreloadAfterMove();
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
            if (this.shouldAbortPreload(token)) {
                return;
            }
            if (!reservedDocuments.includes(doc)) {
                await this.disposeDocument(doc);
                await yieldToMain();
            }
        }
    }

    private shouldPreloadPreviousFirst = () => {
        const direction = this.documentsProvider.owner?.context?.currentLocation?.direction;
        if (getLayoutGeometry(this.htmlOptions).preloadRangeMode == "page-fill") {
            return direction != "next";
        }
        return direction == "previous";
    }

    private isPageMoving = () => {
        const renderer = this.documentsProvider.getRendererContainer();
        const transform = renderer?.querySelector?.(`.${HtmlSettings.TransformContainerCssName}`);
        return !!transform?.hasAttribute(HtmlSettings.PageMovingAttributeName);
    }

    private isScrollSettling = () => {
        if (getLayoutGeometry(this.htmlOptions).flipMode != "scroll") {
            return false;
        }
        return isUserScrollSettling();
    }

    private abortPreloadIfPageMoving = () => {
        if (!this.isPageMoving()) {
            return;
        }
        this.preloadToken++;
    }

    private shouldAbortPreload = (token: number) => {
        if (token !== this.preloadToken) {
            return true;
        }
        if (!this.isPageMoving()) {
            return false;
        }
        this.preloadToken++;
        return true;
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
