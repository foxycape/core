import { getTransformLength } from "../../../../kernal/html/style";
import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { getLocateClientRect, isDomRange, type LocateTarget } from "../../../../kernal/html/geometry";
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
        // html.scrollWidth is often --page-width (a full screen). Progress
        // should follow the iframe's occupied columns, not that forced box.
        const occupiedLength = axis == "y"
            ? (iframe?.offsetHeight || documentElement.scrollHeight)
            : (iframe?.offsetWidth || documentElement.scrollWidth);
        let totalLength = Math.max(1, occupiedLength);
        const translateLength = getTransformLength(documentElement, axis);
        if (Math.abs(translateLength) > 0) {
            totalLength = translateLength + totalLength;
        }
        numberOfPages = Math.floor(totalLength / documentViewport.pageMoveLength);
        if (totalLength % documentViewport.pageMoveLength > documentViewport.columnGap) {
            numberOfPages = numberOfPages + 1;
        }
        documentElement.setAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName, numberOfPages.toString());
        return numberOfPages;
    }

    getPageNumber(target: LocateTarget) {
        if (!target)
            return 1;
        const ownerDocument = this.doc.getContentContainer()?.ownerDocument;
        const body = getDocumentBody(ownerDocument);
        if (!body)
            return 1;
        if (!isDomRange(target) && compareTagName("BODY", target.tagName)) {
            return 1;
        }
        const documentViewport = this.layout.getLayoutMetrics();
        const flow = resolveLayoutFlow(this.options);
        const elementRect = getLocateClientRect(target);
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
}
