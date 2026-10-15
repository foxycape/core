import { Theme } from "../../../../kernal";
import { createElement, injectCssContent } from "../../../../kernal/html/injector";
import { getRandomId } from "../../../../kernal/common/uuid";
import { IRendererViewport, LayoutMetrics } from "../../../../kernal/IRendererViewport";
import { PdfCssVariableNames } from "../PdfCssVariableNames";
import { PdfOptions } from "../../PdfOptions";

/**
 * PDF renderer viewport — CSS variables and layout metrics (mirrors HtmlRendererViewport).
 */
export class PdfRendererViewport implements IRendererViewport<LayoutMetrics> {
    private readonly rendererClassName = "renderer";
    /** PDF-only so HTML `.renderer` scroll/gesture styles stay unchanged. */
    private readonly pdfRendererClassName = "pdf-renderer";
    private readonly rendererContainer: HTMLDivElement;
    private readonly viewerContainer: HTMLDivElement;
    private layout: LayoutMetrics;

    constructor(
        private readonly rootContainer: HTMLElement,
        private readonly readerContainer: HTMLElement,
        private readonly options: PdfOptions,
        private readonly getCurrentPageNumber: () => number,
        private readonly removePageBorders: () => boolean,
    ) {
        const { rendererContainer, viewerContainer } = this.createRendererContainer();
        this.rendererContainer = rendererContainer;
        this.viewerContainer = viewerContainer;
    }

    getViewerContainer(): HTMLDivElement {
        return this.viewerContainer;
    }

    getRendererContainer(): HTMLDivElement {
        return this.rendererContainer;
    }

    getScrollElement(): HTMLDivElement {
        return this.rendererContainer;
    }

    getLayoutMetrics(): LayoutMetrics {
        if (!this.layout) {
            this.applyCssVariables();
            this.layout = this.buildLayoutMetrics();
        }
        return this.layout;
    }

    applyCssVariables(): void {
        const vars = new Map<string, string>();
        vars.set(PdfCssVariableNames.ScrollElementOverflow, "auto");
        const ownerWindow = this.rendererContainer.ownerDocument.defaultView;
        const applyToRoot = () => {
            vars.forEach((v, k) => {
                this.rootContainer.style.setProperty(k, v);
            });
        };

        const currentPageNumber = this.getCurrentPageNumber();
        if (!currentPageNumber || !ownerWindow) {
            applyToRoot();
            this.layout = this.buildLayoutMetrics();
            return;
        }

        const rendererContainer = this.rendererContainer;
        const viewerContainer = this.viewerContainer;
        const rendererLeftNumber = rendererContainer.offsetLeft;
        const page = viewerContainer.querySelector(
            'div.page[data-page-number="' + currentPageNumber + '"]',
        ) as HTMLElement;

        if (page) {
            let rendererWidthNumber: number;

            if (page.parentElement?.classList.contains("spread")) {
                let spreadElement = page.parentElement;
                if (spreadElement.children.length < 2) {
                    const spreadElements = Array.from(
                        viewerContainer.querySelectorAll('div[class="spread"]'),
                    );
                    const index = spreadElements.findIndex((x) => x == spreadElement);
                    if (index >= 1) {
                        spreadElement = spreadElements[index - 1] as HTMLElement;
                    } else if (index < spreadElements.length - 1) {
                        spreadElement = spreadElements[index + 1] as HTMLElement;
                    }
                }
                const firstPageWidth = spreadElement.children[0].clientWidth;
                const firstPageOffsetLeft = (spreadElement.children[0] as HTMLElement).offsetLeft;
                if (spreadElement.children[1]) {
                    const secondPageWidth = spreadElement.children[1].clientWidth;
                    const secondPageOffsetLeft = (spreadElement.children[1] as HTMLElement)
                        .offsetLeft;
                    const middleSpaceWidth =
                        secondPageOffsetLeft - firstPageOffsetLeft - firstPageWidth;
                    rendererWidthNumber = firstPageWidth + secondPageWidth + middleSpaceWidth;
                } else {
                    rendererWidthNumber = firstPageWidth;
                }
            } else {
                rendererWidthNumber = page.clientWidth;
            }

            const contentContainerWrapperWidth = rendererWidthNumber + "px";
            const scrollElementVerticalScrollBarWidth =
                rendererContainer.offsetWidth - rendererContainer.clientWidth;
            const scrollElementHorizontalScrollBarHeight =
                rendererContainer.offsetHeight - rendererContainer.clientHeight;

            vars.set(PdfCssVariableNames.ContentsContainerWidth, contentContainerWrapperWidth);
            vars.set(
                PdfCssVariableNames.ScrollElementVerticalScrollBarWidth,
                scrollElementVerticalScrollBarWidth + "px",
            );
            vars.set(
                PdfCssVariableNames.ScrollElementHorizontalScrollBarHeight,
                scrollElementHorizontalScrollBarHeight + "px",
            );
            vars.set(PdfCssVariableNames.ContentContainerWidth, contentContainerWrapperWidth);
        }

        applyToRoot();
        this.layout = this.buildLayoutMetrics();
    }

    private createRendererContainer(): {
        rendererContainer: HTMLDivElement;
        viewerContainer: HTMLDivElement;
    } {
        // WebKit centers an over-wide page with negative auto margins and then
        // reports scrollWidth === clientWidth, so a zoomed page cannot be panned.
        // Size the viewer to its content (at least the viewport) so the extra
        // width is real scroll distance. overflow-x/y and touch-action are set
        // up front so iOS enables horizontal panning before the first zoom.
        let rendererCss = `.${this.rendererClassName}{`;
        rendererCss += `position:absolute;inset:0;overflow:auto;outline:none;`;
        rendererCss += `}`;
        rendererCss += `.${this.pdfRendererClassName}{`;
        rendererCss += `overflow-x:auto;overflow-y:auto;touch-action:pan-x pan-y;`;
        rendererCss += `}`;
        rendererCss += `.${this.pdfRendererClassName} .pdfViewer{`;
        rendererCss += `width:max-content;min-width:100%;`;
        rendererCss += `}`;

        const rendererContainer = createElement(
            this.readerContainer.ownerDocument,
            "div",
            getRandomId(true),
            this.rendererClassName,
        );
        rendererContainer.classList.add(this.pdfRendererClassName);
        rendererContainer.classList.add(Theme.customScrollerClassName);
        rendererContainer.setAttribute("data-role", "renderer-container");

        const viewerContainer = createElement(
            this.readerContainer.ownerDocument,
            "div",
            getRandomId(true),
            { class: "pdfViewer" },
        );
        viewerContainer.setAttribute("data-role", "viewer-container");
        rendererContainer.appendChild(viewerContainer);

        injectCssContent(this.readerContainer.ownerDocument, rendererCss, true, "pdf-renderer-style");
        this.readerContainer.appendChild(rendererContainer);
        return { rendererContainer, viewerContainer };
    }

    private buildLayoutMetrics(): LayoutMetrics {
        const layoutMetrics = new LayoutMetrics();
        layoutMetrics.clientWidth = this.rendererContainer.clientWidth;
        layoutMetrics.clientHeight = this.rendererContainer.clientHeight;
        return layoutMetrics;
    }
}
