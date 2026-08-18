import { getTransformLength } from "../../../../kernal/html/style";
import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { parseNumber } from "../../../../kernal/common/number";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { resolveLayoutFlow } from "../layout/resolveLayoutFlow";

export class HtmlPageCalculator {
    constructor(
        private readonly doc: IHtmlDocument,
        private readonly layout: IRendererViewport<HtmlLayoutMetrics>,
        private readonly options: HtmlOptions
    ) {
    }

    calcNumberOfPages(update?: boolean) {
        let numberOfPages = 1;
        const flow = resolveLayoutFlow(this.options);
        if (flow.flipMode == "scroll") {
            return numberOfPages;
        }
        const ownerDocument = this.doc.getContentContainer()?.ownerDocument;
        const documentElement = ownerDocument?.documentElement;
        if (!documentElement || !documentElement.firstElementChild)
            return 1;
        if (!update) {
            numberOfPages = parseNumber(documentElement.getAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName), 0, 'parseInt');
            if (numberOfPages > 1) {
                return numberOfPages;
            }
        }
        const documentViewport = this.layout.getLayoutMetrics();
        const iframe = this.getIframe();
        const axis = flow.pageAxis;
        let totalLength = 0;
        let htmlScrollLength = axis == "y" ? documentElement.scrollHeight : documentElement.scrollWidth;
        if (htmlScrollLength < 1)
            htmlScrollLength = 1;
        let translateLength = getTransformLength(documentElement, axis);
        if (Math.abs(translateLength) > 0) {
            if (iframe) {
                const iframeScrollLength = axis == "y" ? iframe.scrollHeight : iframe.scrollWidth;
                if (htmlScrollLength == iframeScrollLength) {
                    this.transformCurrentDocument(this.getContentRootElement(), translateLength - 2, axis);
                    const newHtmlScrollLength = axis == "y" ? documentElement.scrollHeight : documentElement.scrollWidth;
                    if (htmlScrollLength == newHtmlScrollLength) {
                        this.transformCurrentDocument(this.getContentRootElement(), 0, axis);
                        translateLength = 0;
                        htmlScrollLength = axis == "y" ? documentElement.scrollHeight : documentElement.scrollWidth;
                    }
                    else {
                        this.transformCurrentDocument(this.getContentRootElement(), translateLength, axis);
                    }
                }
            }
        }
        totalLength = translateLength + htmlScrollLength;
        if (axis == "y") {
            totalLength = Math.max(totalLength, iframe?.scrollHeight ?? 0);
        }
        else {
            totalLength = Math.max(totalLength, iframe?.scrollWidth ?? 0, iframe?.offsetWidth ?? 0);
        }
        numberOfPages = Math.floor(totalLength / documentViewport.pageMoveLength);
        if (totalLength % documentViewport.pageMoveLength > documentViewport.columnGap) {
            numberOfPages = numberOfPages + 1;
        }
        documentElement.setAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName, numberOfPages.toString());
        return numberOfPages;
    }

    getPageNumber(element: Element) {
        if (!element)
            return 1;
        const ownerDocument = this.doc.getContentContainer()?.ownerDocument;
        const body = getDocumentBody(ownerDocument);
        if (!body)
            return 1;
        if (compareTagName("BODY", element.tagName)) {
            return 1;
        }
        const documentViewport = this.layout.getLayoutMetrics();
        const flow = resolveLayoutFlow(this.options);
        const elementRect = element.getBoundingClientRect();
        if (flow.pageAxis == "y") {
            const translateY = getTransformLength(ownerDocument.documentElement, "y");
            const top = (elementRect?.top ?? 0) + translateY;
            let pageNumber = Math.floor(top / documentViewport.pageMoveLength);
            if (top > documentViewport.pageHeight && top % documentViewport.pageMoveLength >= 0) {
                pageNumber = pageNumber + 1;
            }
            return pageNumber == 0 ? 1 : pageNumber;
        }
        const translatex = getTransformLength(ownerDocument.documentElement, "x");
        const left = (elementRect?.left ?? 0) + translatex;
        let pageNumber = Math.floor(left / documentViewport.pageMoveLength);
        if (left > documentViewport.pageWidth && left % documentViewport.pageMoveLength >= 0) {
            pageNumber = pageNumber + 1;
        }
        if (pageNumber == 0)
            pageNumber = 1;

        if (flow.isRtlProgression) {
            const numberOfPages = this.calcNumberOfPages();
            pageNumber = Math.max(1, numberOfPages - pageNumber + 1);
        }
        return pageNumber;
    }

    private getIframe(): HTMLIFrameElement | undefined {
        return this.doc.getContentContainer()?.ownerDocument?.defaultView?.frameElement as HTMLIFrameElement | undefined;
    }

    private getContentRootElement(): HTMLElement {
        if (this.doc.inIframe) {
            return this.doc.getContentContainer()?.ownerDocument?.documentElement;
        }
        return this.doc.getWrapperContainer();
    }

    private transformCurrentDocument(rootElement: HTMLElement, translateLegnth: number, axis: 'x' | 'y') {
        if (!axis || !rootElement)
            return;
        if (axis == "x") {
            rootElement.style.transform = "translateX(-" + parseFloat(translateLegnth.toFixed(10)) + "px)";
        }
        else {
            rootElement.style.transform = "translateY(-" + parseFloat(translateLegnth.toFixed(10)) + "px)";
        }
    }
}
