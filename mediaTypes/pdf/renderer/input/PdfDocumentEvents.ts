import { EventNames, Reader } from "../../../../kernal";
import { compareTagName } from "../../../../kernal/html/finder";
import { checkHasValidRange, getRange } from "../../../../kernal/html/selection";
import { getEventKeyMap } from "../../../base/renderer/eventKeys";
import type { IPdfDocument } from "../IPdfDocument";
import type { MultiPDFViewer } from "../MultiPdfViewer";
import { IPdfDocumentsProvider } from "../documents/IPdfDocumentsProvider";

/**
 * Bridges DOM selection / pointer events to reader document events.
 */
export class PdfDocumentEvents {
    private readonly eventKeyMap = getEventKeyMap(false);
    private readonly owner: Reader;
    private readonly rendererContainer: HTMLElement;
    private selectingPointer = false;
    private lockedScroll: { top: number; left: number } | null = null;

    constructor(
        private readonly pdfViewer: MultiPDFViewer,
        private readonly documentsProvider: IPdfDocumentsProvider,
    ) {
        this.owner = this.documentsProvider.owner;
        this.rendererContainer = this.documentsProvider.getRendererContainer();
    }

    bind() {
        this.rendererContainer.ownerDocument.addEventListener(
            "selectionchange",
            this.onSelectionChange,
        );
        for (const key of this.eventKeyMap.keys()) {
            this.rendererContainer.addEventListener(key, this.eventListener, true);
        }
        this.documentsProvider.getScrollElement()?.addEventListener("scroll", this.onScroll, {
            passive: true,
        });
        this.owner.events.on(EventNames.PdfPageRendered, this.onPageRendered);
    }

    unbind() {
        this.rendererContainer.ownerDocument.removeEventListener(
            "selectionchange",
            this.onSelectionChange,
        );
        for (const key of this.eventKeyMap.keys()) {
            this.rendererContainer.removeEventListener(key, this.eventListener, true);
        }
        this.documentsProvider.getScrollElement()?.removeEventListener("scroll", this.onScroll);
        this.owner.events.off(EventNames.PdfPageRendered, this.onPageRendered);
        this.selectingPointer = false;
        this.lockedScroll = null;
    }

    private onPageRendered = async ({ pageNumber }) => {
        if (pageNumber != this.pdfViewer.currentPageNumber) {
            return;
        }
        const ownerDocument = this.rendererContainer.ownerDocument;
        if (checkHasValidRange(ownerDocument)) {
            return;
        }
        ownerDocument.getSelection()?.removeAllRanges();
    };

    private beginSelectionScrollLock = () => {
        if (this.lockedScroll) {
            return;
        }
        const scrollElement = this.documentsProvider.getScrollElement();
        if (!scrollElement) {
            return;
        }
        this.lockedScroll = {
            top: scrollElement.scrollTop,
            left: scrollElement.scrollLeft,
        };
    };

    private endSelectionScrollLock = () => {
        this.selectingPointer = false;
        this.lockedScroll = null;
    };

    private onScroll = () => {
        const locked = this.lockedScroll;
        if (!locked) {
            return;
        }
        const scrollElement = this.documentsProvider.getScrollElement();
        if (!scrollElement) {
            return;
        }
        if (scrollElement.scrollTop === locked.top && scrollElement.scrollLeft === locked.left) {
            return;
        }
        scrollElement.scrollTo(locked.left, locked.top);
    };

    private onSelectionChange = async (e) => {
        if (this.selectingPointer && checkHasValidRange(this.rendererContainer.ownerDocument)) {
            this.beginSelectionScrollLock();
        }
        if (!checkHasValidRange(this.rendererContainer.ownerDocument, false)) {
            this.owner.events.emit(
                EventNames.DocumentSelectionChange,
                e,
                this.documentsProvider.getDocuments()[0],
            );
            return;
        }
        const range = getRange(this.rendererContainer.ownerDocument, false);
        const startContentContainer =
            range.startContainer.nodeType === Node.ELEMENT_NODE
                ? (range.startContainer as HTMLElement)
                : range.startContainer.parentElement;
        const doc =
            (await this.findPageDocument(startContentContainer)) ??
            this.documentsProvider.getDocuments()[0];
        // Always emit when selection is valid; toolbar must not depend on page-doc lookup.
        this.owner.events.emit(EventNames.DocumentSelectionChange, e, doc);
    };

    private eventListener = async (e: Event) => {
        if (e.type === "touchstart" || e.type === "pointerdown") {
            this.selectingPointer = true;
            if (checkHasValidRange(this.rendererContainer.ownerDocument)) {
                this.beginSelectionScrollLock();
            }
        } else if (
            e.type === "touchend" ||
            e.type === "touchcancel" ||
            e.type === "pointerup" ||
            e.type === "pointercancel"
        ) {
            this.endSelectionScrollLock();
        }
        const customEventKey = this.eventKeyMap.get(e.type as any);
        if (customEventKey) {
            const doc =
                (await this.findPageDocument(e.target as HTMLElement)) ??
                this.documentsProvider.getDocuments()[0];
            // Emit even when page lookup fails (e.g. release outside .page);
            // selection toolbar depends on pointerup.
            this.owner.events.emit(customEventKey, e, doc);
        }
    };

    private findPageDocument = async (trigger: HTMLElement) => {
        let target = trigger;
        if (
            !target ||
            target.nodeType != Node.ELEMENT_NODE ||
            compareTagName(target.tagName, "HTML") ||
            compareTagName(target.tagName, "BODY")
        ) {
            return null;
        }

        while (
            !target.classList?.contains("page") &&
            !compareTagName(target?.tagName, "BODY") &&
            target.parentElement
        ) {
            target = target.parentElement;
        }
        if (!target || compareTagName(target.tagName, "BODY")) {
            return null;
        }

        const startPageNumber = parseInt(target.getAttribute("data-page-number"));
        if (isNaN(startPageNumber) || startPageNumber <= 0) {
            return null;
        }
        return this.documentsProvider.getDocument((startPageNumber - 1).toString()) as IPdfDocument;
    };
}
