import * as pdfjsLib from "../../../../pdfjs/legacy/build/pdf.mjs";
import { ReaderHub } from "../../../../ReaderHub";
import type { Reader } from "../../../../kernal/Reader";
import { MultiPDFViewer } from "../MultiPdfViewer";

export type PdfFindRequestHandler = () => void;

type PdfZoomShortcut = "in" | "out" | "reset";

export class PdfKeyboardController {
    private findRequestHandler?: PdfFindRequestHandler;
    private zoomWindow: Window | null = null;

    constructor(
        private readonly pdfViewer: MultiPDFViewer,
        private readonly container: HTMLDivElement,
        private readonly reader: Reader,
    ) {}

    bind() {
        this.container.addEventListener("click", this.webViewerClick);
        this.container.addEventListener("keydown", this.webViewerKeyDown);
        const view = this.container.ownerDocument.defaultView;
        if (view) {
            this.zoomWindow = view;
            view.addEventListener("keydown", this.onZoomShortcut, true);
        }
    }

    unbind() {
        this.container.removeEventListener("click", this.webViewerClick);
        this.container.removeEventListener("keydown", this.webViewerKeyDown);
        this.zoomWindow?.removeEventListener("keydown", this.onZoomShortcut, true);
        this.zoomWindow = null;
    }

    setFindRequestHandler(handler?: PdfFindRequestHandler) {
        this.findRequestHandler = handler;
    }

    /** Integrated find is handled by the host search UI via RequestOpenFind. */
    get supportsIntegratedFind() {
        return pdfjsLib.shadow(this, "supportsIntegratedFind", true);
    }

    private webViewerClick = (_evt: MouseEvent) => {};

    private webViewerKeyDown = (evt: KeyboardEvent) => {
        const { pdfViewer } = this;
        const isViewerInPresentationMode = pdfViewer.isInPresentationMode;

        let handled = false;
        let ensureViewerFocused = false;
        const cmd =
            (evt.ctrlKey ? 1 : 0) |
            (evt.altKey ? 2 : 0) |
            (evt.shiftKey ? 4 : 0) |
            (evt.metaKey ? 8 : 0);

        const curElement = this.getActiveOrFocusedElement();
        const curElementTagName = curElement?.tagName?.toUpperCase() ?? "";

        if (cmd === 1 || cmd === 8 || cmd === 5 || cmd === 12) {
            switch (evt.keyCode) {
                case 70:
                    if (!evt.shiftKey) {
                        handled = true;
                        this.findRequestHandler?.();
                    }
                    break;
                case 71:
                    break;
                case 38:
                    if (isViewerInPresentationMode || pdfViewer.currentPageNumber > 1) {
                        pdfViewer.currentPageNumber = 1;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
                case 40:
                    if (
                        isViewerInPresentationMode ||
                        pdfViewer.currentPageNumber < pdfViewer.pagesCount
                    ) {
                        pdfViewer.currentPageNumber = pdfViewer.pagesCount;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
            }
        }

        let turnPage = 0;
        let turnOnlyIfPageFit = false;

        if (cmd === 0 || (cmd === 4 && !isViewerInPresentationMode)) {
            switch (evt.keyCode) {
                case 38:
                case 33:
                    if (pdfViewer.isVerticalScrollbarEnabled) {
                        turnPage = -1;
                    } else if (
                        isViewerInPresentationMode ||
                        (cmd === 4 && pdfViewer.currentScaleValue !== "page-fit")
                    ) {
                        turnPage = -1;
                        turnOnlyIfPageFit = cmd === 0;
                    }
                    break;
                case 37:
                    if (pdfViewer.isHorizontalScrollbarEnabled) {
                        turnPage = -1;
                    }
                    break;
                case 40:
                case 34:
                    if (pdfViewer.isVerticalScrollbarEnabled) {
                        turnPage = 1;
                    } else if (
                        isViewerInPresentationMode ||
                        (cmd === 4 && pdfViewer.currentScaleValue !== "page-fit")
                    ) {
                        turnPage = 1;
                        turnOnlyIfPageFit = cmd === 0;
                    }
                    break;
                case 39:
                    if (pdfViewer.isHorizontalScrollbarEnabled) {
                        turnPage = 1;
                    }
                    break;
                case 36:
                    if (isViewerInPresentationMode || pdfViewer.currentPageNumber > 1) {
                        pdfViewer.currentPageNumber = 1;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
                case 35:
                    if (
                        isViewerInPresentationMode ||
                        pdfViewer.currentPageNumber < pdfViewer.pagesCount
                    ) {
                        pdfViewer.currentPageNumber = pdfViewer.pagesCount;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
                case 32:
                    turnPage = evt.shiftKey ? -1 : 1;
                    break;
            }
        }

        if (cmd === 4) {
            switch (evt.keyCode) {
                case 13:
                case 32:
                    if (
                        !isViewerInPresentationMode &&
                        pdfViewer.currentScaleValue !== "page-fit"
                    ) {
                        break;
                    }
                    pdfViewer.previousPage();
                    handled = true;
                    break;
            }
        }

        if (turnPage !== 0 && (!turnOnlyIfPageFit || pdfViewer.currentScaleValue === "page-fit")) {
            if (turnPage > 0) {
                pdfViewer.nextPage();
            } else {
                pdfViewer.previousPage();
            }
            handled = true;
        }

        if (!handled && !isViewerInPresentationMode) {
            if (
                (evt.keyCode >= 33 && evt.keyCode <= 40) ||
                (evt.keyCode === 32 && curElementTagName !== "BUTTON")
            ) {
                ensureViewerFocused = true;
            }
        }

        if (ensureViewerFocused && !pdfViewer.containsElement(curElement)) {
            pdfViewer.focus();
        }

        if (handled) {
            evt.preventDefault();
        }
    };

    /**
     * Capture phase on window: Ctrl/Cmd +/-/0 is the browser zoom shortcut.
     * The PDF container bubble listener never sees it when focus is on the page chrome.
     */
    private onZoomShortcut = (evt: KeyboardEvent) => {
        const action = zoomShortcutAction(evt);
        if (!action || this.pdfViewer.isInPresentationMode) {
            return;
        }
        if (!this.isFocusedReader() || !this.isViewerOnScreen()) {
            return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        const previousScale = this.pdfViewer.currentScale;
        if (action === "in") {
            this.pdfViewer.increaseScale({ drawingDelay: 400 });
        } else if (action === "out") {
            this.pdfViewer.decreaseScale({ drawingDelay: 400 });
        } else {
            this.pdfViewer.currentScaleValue = "auto";
        }
        this.pdfViewer.adjustScrollForViewportCenter(previousScale);
    };

    private isFocusedReader = () => {
        const current = ReaderHub.getFocusReader() ?? ReaderHub.getActiveReader();
        return current?.id === this.reader.id;
    };

    private isViewerOnScreen = () => {
        if (!this.container.isConnected) {
            return false;
        }
        const rect = this.container.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };

    private getActiveOrFocusedElement = (): Element | null => {
        let curRoot: Document | ShadowRoot = this.container.ownerDocument;
        let curActiveOrFocused: Element | null =
            curRoot.activeElement || curRoot.querySelector(":focus");

        while ((curActiveOrFocused as HTMLElement | null)?.shadowRoot) {
            curRoot = (curActiveOrFocused as HTMLElement).shadowRoot!;
            curActiveOrFocused = curRoot.activeElement || curRoot.querySelector(":focus");
        }

        return curActiveOrFocused;
    };
}

/** Ctrl/Cmd (+ optional Shift, no Alt) zoom keys. key and code, not keyCode alone. */
const zoomShortcutAction = (evt: KeyboardEvent): PdfZoomShortcut | null => {
    if (evt.altKey || !(evt.ctrlKey || evt.metaKey)) {
        return null;
    }
    const key = evt.key;
    const code = evt.code;
    if (
        key === "+" ||
        key === "=" ||
        code === "Equal" ||
        code === "NumpadAdd" ||
        evt.keyCode === 61 ||
        evt.keyCode === 107 ||
        evt.keyCode === 187 ||
        evt.keyCode === 171
    ) {
        return "in";
    }
    if (
        key === "-" ||
        key === "_" ||
        code === "Minus" ||
        code === "NumpadSubtract" ||
        evt.keyCode === 173 ||
        evt.keyCode === 109 ||
        evt.keyCode === 189
    ) {
        return "out";
    }
    if (
        key === "0" ||
        code === "Digit0" ||
        code === "Numpad0" ||
        evt.keyCode === 48 ||
        evt.keyCode === 96
    ) {
        return "reset";
    }
    return null;
};
