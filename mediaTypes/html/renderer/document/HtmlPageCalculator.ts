import { getTransformLength } from "../../../../kernal/html/style";
import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { getLocateClientRect, isDomRange, type LocateTarget } from "../../../../kernal/html/geometry";
import { parseNumber } from "../../../../kernal/common/number";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { getLayoutGeometry } from "../layout/resolveLayoutRoute";

export class HtmlPageCalculator {
    constructor(
        private readonly doc: IHtmlDocument,
        private readonly layout: IRendererViewport<HtmlLayoutMetrics>,
        private readonly options: HtmlOptions
    ) {
    }

    calcNumberOfPages(update?: boolean) {
        let numberOfPages = 1;
        const geometry = getLayoutGeometry(this.options);
        if (geometry.flipMode == "scroll") {
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
        const occupiedLength = geometry.getOccupiedLength(iframe, documentElement);
        let totalLength = Math.max(1, occupiedLength);
        const translateLength = getTransformLength(documentElement, geometry.pageAxis);
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
        const geometry = getLayoutGeometry(this.options);
        const elementRect = getLocateClientRect(target);
        const translateX = getTransformLength(ownerDocument.documentElement, "x");
        const translateY = getTransformLength(ownerDocument.documentElement, "y");
        const axisOffset = geometry.getLocateAxisOffset(
            { left: elementRect?.left ?? 0, top: elementRect?.top ?? 0 },
            translateX,
            translateY
        );
        return geometry.getPageNumberFromPoint({
            axisOffset,
            pageMoveLength: documentViewport.pageMoveLength,
            pageLength: geometry.getPageBoxLength(documentViewport),
            numberOfPages: this.calcNumberOfPages(),
        });
    }

    private getIframe(): HTMLIFrameElement | undefined {
        return this.doc.getContentContainer()?.ownerDocument?.defaultView?.frameElement as HTMLIFrameElement | undefined;
    }
}
