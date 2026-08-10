import {
    asyncDebounce,
    BrowserCapabilities,
    EventNames,
    Theme,
} from "../../../kernal";
import { removeAll } from "../../../kernal/common/array";
import { getByteLength } from "../../../kernal/common/text";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type * as pdfjsViewer from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import { PdfOptions } from "../PdfOptions";
import { IPdfDocument } from "./IPdfDocument";
import { IPdfRenderer } from "./IPdfRenderer";
import { IPdfSvgBuilder } from "./IPdfSvgBuilder";

type SvgPageTask = {
    svg: Element;
    batchLength: number;
    current: number;
    pageNumber: number;
    textContent: any;
    viewportTransform: number[];
    start: number;
    size: number;
};

/**
 * Builds a custom SVG text layer (textLayerMode === 2).
 * Visible text elements are resolved on demand via IPdfDocument.getVisibleElements().
 */
export class PdfSvgBuilder implements IPdfSvgBuilder {
    static readonly svgClassName = "custom-text-layer";
    private readonly SVG_NS = "http://www.w3.org/2000/svg";
    private readonly renderer: IPdfRenderer;
    private readonly options: PdfOptions;
    private pageTasks: SvgPageTask[] = [];
    private isScrolling = false;
    private scrollingTimer: ReturnType<typeof setTimeout> | null = null;
    private disposed = false;
    private readonly batchSize = 10;

    constructor(renderer: IPdfRenderer, options: PdfOptions) {
        this.renderer = renderer;
        this.options = options;
    }

    async initialize(): Promise<void> {
        this.bindEvents();
    }

    private bindEvents() {
        const events = this.renderer.owner.events;
        events.on(EventNames.PdfPageRendered, this.onPageRendered);
        events.on(EventNames.PageChange, this.onPageChange);
        events.on(EventNames.ReaderOriginalScroll, this.onReaderOriginalScroll);
    }

    private unbindEvents() {
        const events = this.renderer.owner.events;
        events.off(EventNames.PdfPageRendered, this.onPageRendered);
        events.off(EventNames.PageChange, this.onPageChange);
        events.off(EventNames.ReaderOriginalScroll, this.onReaderOriginalScroll);
    }

    private onReaderOriginalScroll = () => {
        this.isScrolling = true;
        if (this.scrollingTimer) {
            clearTimeout(this.scrollingTimer);
        }
        this.scrollingTimer = setTimeout(async () => {
            this.isScrolling = false;
            await this.delayRenderVisiblePageTexts();
        }, 500);
    };

    private onPageChange = async () => {
        await this.delayRenderVisiblePageTexts();
    };

    private getVisiblePageIds = () => this.renderer.getVisibleDocuments().map((x) => x.pageNumber);

    private renderVisiblePageTexts = async () => {
        if (this.disposed) {
            return;
        }
        // PDF uses scroll layout; skip heavy work while scrolling.
        if (!this.isScrolling) {
            await this.appendSvgs(this.getVisiblePageIds());
        }
    };

    private delayRenderVisiblePageTexts = asyncDebounce(this.renderVisiblePageTexts, 1);

    async dispose(): Promise<void> {
        this.disposed = true;
        this.unbindEvents();
        if (this.scrollingTimer) {
            clearTimeout(this.scrollingTimer);
            this.scrollingTimer = null;
        }
        this.pageTasks.splice(0);
    }

    private onPageRendered = async () => {
        const visiblePageNumbers = this.getVisiblePageIds();
        const numberOfPages = this.renderer.numberOfPages;
        for (let i = 1; i <= numberOfPages; i++) {
            if (!visiblePageNumbers.includes(i)) {
                const svgContainer = this.getTextLayerContainer(i);
                svgContainer?.parentElement?.removeChild(svgContainer);
            }
        }
        await this.delayRenderVisiblePageTexts();
    };

    private getTextLayerContainer(page: pdfjsViewer.PDFPageView | number | Element): Element | null {
        const className = PdfSvgBuilder.svgClassName;
        if (typeof page === "number") {
            const pageView = this.renderer.getPageView(page);
            return pageView?.div?.querySelector(`svg.${className}`) ?? null;
        }
        if ("tagName" in page) {
            return page.querySelector(`svg.${className}`);
        }
        return page.div?.querySelector(`svg.${className}`) ?? null;
    }

    private appendSvg = async (pageNumber: number) => {
        const pageView = this.renderer.getPageView(pageNumber);
        if (!pageView) {
            return;
        }
        if (this.options.textLayerMode != 2) {
            return;
        }
        if (!pageView.canvas?.parentElement) {
            return;
        }
        pageView.canvas.parentElement.style.background = `var(${Theme.ContentBackground})`;

        let svgContainer = this.getTextLayerContainer(pageView);
        if (svgContainer) {
            const state = svgContainer.getAttribute("data-state");
            if (state == "loading" || state == "loaded") {
                return;
            }
        }

        if (!svgContainer) {
            svgContainer = await this.buildSVG(pageView.viewport);
            if (!svgContainer) {
                return;
            }
            pageView.div.appendChild(svgContainer);
        }
        await this.appendTexts(svgContainer, pageNumber);

        const doc = this.renderer.getDocument((pageNumber - 1).toString()) as IPdfDocument;
        this.renderer.owner.events.emit(EventNames.PdfPageTextRendered, doc, pageNumber);
    };

    private appendSvgs = async (pageNumbers: number[]) => {
        for (const pageNumber of pageNumbers) {
            await this.appendSvg(pageNumber);
        }
    };

    private appendTexts = async (svg: Element, pageNumber: number) => {
        const pageView = this.renderer.getPageView(pageNumber);
        if (!pageView?.pdfPage) {
            return;
        }
        const textContent = await pageView.pdfPage.getTextContent();
        let batchLength = Math.floor(textContent.items.length / this.batchSize);
        const lastBatchSize = textContent.items.length % this.batchSize;
        if (lastBatchSize > 0) {
            batchLength++;
        }

        removeAll(this.pageTasks, (x) => !this.getVisiblePageIds().includes(x.pageNumber));
        for (const pageTask of this.pageTasks) {
            if (pageTask.pageNumber == pageNumber) {
                pageTask.svg = svg;
            }
        }

        if (!this.pageTasks.find((x) => x.pageNumber == pageNumber)) {
            for (let i = 0; i < batchLength; i++) {
                let size = this.batchSize;
                if (i == batchLength - 1 && lastBatchSize > 0) {
                    size = lastBatchSize;
                }
                this.pageTasks.push({
                    svg,
                    batchLength,
                    current: i,
                    pageNumber,
                    textContent,
                    viewportTransform: pageView.viewport.transform,
                    start: i * this.batchSize,
                    size,
                });
            }
        }
        await this.renderSvgTexts();
    };

    private renderSvgTexts = async () => {
        if (this.pageTasks.length == 0) {
            return;
        }

        if (this.isScrolling) {
            if (this.pageTasks[0].svg.getAttribute("data-state") != "pause") {
                this.pageTasks[0].svg.setAttribute("data-state", "pause");
            }
            return;
        }

        const pageTask = this.pageTasks.shift();
        if (!pageTask?.svg.parentElement) {
            await this.renderSvgTexts();
            return;
        }

        if (pageTask.svg.getAttribute("data-state") != "loading") {
            pageTask.svg.setAttribute("data-state", "loading");
        }

        const runBatch = async () => {
            await this.appendPartialText(
                pageTask.pageNumber,
                pageTask.svg,
                pageTask.viewportTransform,
                pageTask.textContent,
                pageTask.start,
                pageTask.size,
            );
            if (pageTask.batchLength - 1 == pageTask.current) {
                pageTask.svg.setAttribute("data-state", "loaded");
            }
        };

        if (BrowserCapabilities.supportScheduler()) {
            await BrowserCapabilities.yieldToMain();
            await runBatch();
        } else {
            await new Promise<void>((resolve) => {
                setTimeout(async () => {
                    if (!this.renderer.owner.context) {
                        resolve();
                        return;
                    }
                    await runBatch();
                    resolve();
                }, 0);
            });
        }
        await this.renderSvgTexts();
    };

    private calcTextWidth = (
        context: CanvasRenderingContext2D,
        text: string,
        textItemFontName: string,
        fontFamily: string,
        styleFontName: string,
    ) => {
        const byteLength = getByteLength(text);
        const byteLengthDiff = byteLength - text.length;
        if (text.length <= 2 && byteLengthDiff == 0) {
            if (styleFontName == "monospace") {
                context.font = "1px " + textItemFontName + ",sans-serif";
            } else {
                context.font = "1px " + textItemFontName + "," + fontFamily;
            }
        } else {
            context.font = "1px " + fontFamily;
        }
        return context.measureText(text).width;
    };

    private appendPartialText = async (
        pageNumber: number,
        svg: Element,
        viewportTransform: number[],
        textContent: any,
        start: number,
        size: number,
    ) => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const fontSize = 12;
        const isFirefox = BrowserCapabilities.isFirefox();
        const isSafari = BrowserCapabilities.isSafari();
        const documentFragment = document.createDocumentFragment();
        const ownerDocument = this.renderer.getRendererContainer().ownerDocument;
        const resourceId = this.renderer.owner.context?.id ?? "pdf";

        for (let i = start; i < start + size; i++) {
            const textItem = textContent.items[i];
            if (!textItem) {
                continue;
            }
            let tx = pdfjsLib.Util.transform(
                pdfjsLib.Util.transform(viewportTransform, textItem.transform),
                [1, 0, 0, -1, 0, 0],
            );
            const style = textContent.styles[textItem.fontName];
            const tx0 = textItem.transform[0];
            const tx1 = textItem.transform[1];
            let angle = Math.atan2(tx1, tx0);
            if (style.vertical) {
                angle += Math.PI / 2;
            }
            if (angle !== 0) {
                angle = Math.atan2(tx1, tx0) * (180 / Math.PI);
            }

            let absAngle = angle;
            if (absAngle < 0) {
                absAngle += 360;
            }
            absAngle = Math.round(absAngle);
            const text = textItem.str;
            let fontFamily = style.fontFamily.replaceAll(/^serif/g, "Times");

            if (text.length > 0) {
                let textMetricsWidth = textItem["textMetricsWidth"];
                if (!textMetricsWidth) {
                    textMetricsWidth = this.calcTextWidth(
                        context,
                        textItem.str,
                        textItem.fontName,
                        fontFamily,
                        style.fontName,
                    );
                    context.font = fontSize + "px " + fontFamily;
                    textItem["textMetricsWidth"] = textMetricsWidth;
                }

                let textScale = 1;
                let metricsWidth: number;
                switch (absAngle) {
                    case 90: {
                        tx = pdfjsLib.Util.transform(tx, [0, -1, 1, 0, 0, 0]);
                        const textTransform = pdfjsLib.Util.transform(textItem.transform, [0, -1, 1, 0, 0, 0]);
                        metricsWidth =
                            textMetricsWidth *
                            (textTransform[0] == 0 ? Math.abs(textTransform[1]) : Math.abs(textTransform[0]));
                        if (metricsWidth > 0) {
                            textScale = textItem.width / metricsWidth / fontSize;
                        }
                        tx = pdfjsLib.Util.transform(tx, [textScale, 0, 0, textScale, 0, 0]);
                        tx = pdfjsLib.Util.transform(tx, [0, 1, -1, 0, 0, 0]);
                        break;
                    }
                    case 180: {
                        tx = pdfjsLib.Util.transform(tx, [-1, 0, 0, -1, 0, 0]);
                        const textTransform = pdfjsLib.Util.transform(textItem.transform, [-1, 0, 0, -1, 0, 0]);
                        metricsWidth =
                            textMetricsWidth *
                            (textTransform[0] == 0 ? Math.abs(textTransform[1]) : Math.abs(textTransform[0]));
                        if (metricsWidth > 0) {
                            textScale = textItem.width / metricsWidth / fontSize;
                        }
                        tx = pdfjsLib.Util.transform(tx, [textScale, 0, 0, textScale, 0, 0]);
                        tx = pdfjsLib.Util.transform(tx, [-1, 0, 0, -1, 0, 0]);
                        break;
                    }
                    case 270: {
                        tx = pdfjsLib.Util.transform(tx, [0, 1, -1, 0, 0, 0]);
                        const textTransform = pdfjsLib.Util.transform(textItem.transform, [0, 1, -1, 0, 0, 0]);
                        metricsWidth =
                            textMetricsWidth *
                            (textTransform[0] == 0 ? Math.abs(textTransform[1]) : Math.abs(textTransform[0]));
                        if (metricsWidth > 0) {
                            textScale = textItem.width / metricsWidth / fontSize;
                        }
                        tx = pdfjsLib.Util.transform(tx, [textScale, 0, 0, textScale, 0, 0]);
                        tx = pdfjsLib.Util.transform(tx, [0, -1, 1, 0, 0, 0]);
                        break;
                    }
                    default: {
                        const textTransform = textItem.transform;
                        metricsWidth =
                            textMetricsWidth *
                            (textTransform[0] == 0 ? Math.abs(textTransform[1]) : Math.abs(textTransform[0]));
                        if (metricsWidth > 0) {
                            textScale = textItem.width / metricsWidth / fontSize;
                        }
                        tx = pdfjsLib.Util.transform(tx, [textScale, 0, 0, textScale, 0, 0]);
                        break;
                    }
                }
            }

            const textId = "p-" + resourceId + "-" + pageNumber + "-t-" + i;
            if (isFirefox || isSafari) {
                let newFontSize = fontSize;
                switch (absAngle) {
                    case 90: {
                        tx = pdfjsLib.Util.transform(tx, [0, -1, 1, 0, 0, 0]);
                        const width = Math.abs(tx[0]);
                        tx = [tx[0] / width, tx[1], tx[2], tx[3] / width, tx[4], tx[5]];
                        newFontSize = fontSize * width;
                        if (newFontSize <= 0) {
                            newFontSize = 1;
                        }
                        tx = pdfjsLib.Util.transform(tx, [0, 1, -1, 0, 0, 0]);
                        break;
                    }
                    case 180: {
                        tx = pdfjsLib.Util.transform(tx, [-1, 0, 0, -1, 0, 0]);
                        const width = Math.abs(tx[0]);
                        tx = [tx[0] / width, tx[1], tx[2], tx[3] / width, tx[4], tx[5]];
                        newFontSize = fontSize * width;
                        if (newFontSize <= 0) {
                            newFontSize = 1;
                        }
                        tx = pdfjsLib.Util.transform(tx, [-1, 0, 0, -1, 0, 0]);
                        break;
                    }
                    case 270: {
                        tx = pdfjsLib.Util.transform(tx, [0, 1, -1, 0, 0, 0]);
                        const width = Math.abs(tx[0]);
                        tx = [tx[0] / width, tx[1], tx[2], tx[3] / width, tx[4], tx[5]];
                        newFontSize = fontSize * width;
                        if (newFontSize <= 0) {
                            newFontSize = 1;
                        }
                        tx = pdfjsLib.Util.transform(tx, [0, -1, 1, 0, 0, 0]);
                        break;
                    }
                    default: {
                        const width = Math.abs(tx[0]);
                        tx = [tx[0] / width, tx[1], tx[2], tx[3] / width, tx[4], tx[5]];
                        newFontSize = fontSize * width;
                        if (newFontSize <= 0) {
                            newFontSize = 1;
                        }
                        break;
                    }
                }

                const g = ownerDocument.createElementNS(this.SVG_NS, "svg:g");
                g.setAttribute("transform", "matrix(" + tx.join(" ") + ")");
                g.setAttribute("style", "font-family:" + fontFamily + ";");
                const svgText = ownerDocument.createElementNS(this.SVG_NS, "svg:text");
                svgText.setAttribute("font-size", newFontSize + "px");
                if (isSafari) {
                    svgText.setAttribute("transform", "translate(0,-" + newFontSize + ")");
                    svgText.setAttribute("x", "0");
                    svgText.setAttribute("y", newFontSize.toString());
                }
                svgText.textContent = textItem.str;
                svgText.setAttribute("id", textId);
                g.appendChild(svgText);
                documentFragment.appendChild(g);
            } else {
                const svgText = ownerDocument.createElementNS(this.SVG_NS, "svg:text");
                svgText.setAttribute("transform", "matrix(" + tx.join(" ") + ")");
                svgText.setAttribute(
                    "style",
                    "font-size:" + fontSize + "px;font-family:" + fontFamily + ";",
                );
                svgText.textContent = textItem.str;
                svgText.setAttribute("id", textId);
                documentFragment.appendChild(svgText);
            }
        }
        svg.appendChild(documentFragment);
    };

    private buildSVG = async (viewport: pdfjsLib.PageViewport) => {
        if (viewport.width <= 0 || viewport.height <= 0) {
            return null;
        }
        const svg = this.renderer
            .getRendererContainer()
            .ownerDocument.createElementNS(this.SVG_NS, "svg:svg");
        svg.setAttribute("version", "1.1");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
        svg.setAttribute("class", PdfSvgBuilder.svgClassName);
        svg.setAttribute("data-loaded", "false");
        svg.setAttribute(
            "style",
            "fill:transparent;position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;contain:size layout paint;",
        );
        return svg;
    };
}
