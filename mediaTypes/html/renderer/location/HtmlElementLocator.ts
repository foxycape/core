import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { FileLocation, IDocumentsProvider, ProgressUnit, SymbolType } from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { compareTagName, getElementByNameAndIndex } from "../../../../kernal/html/finder";
import { IHtmlDocument } from "../IHtmlDocument";
import { Progress } from "../../../../kernal/progress/Progress";
import { getUrlFragment } from "../../../../kernal/common/url";
import type { FlipMode } from "../../../../kernal/types";
import type { IHtmlSymbolMeasure } from "../../IHtmlSymbolMeasure";
import { asHtmlFileParser } from "../../fileParser/IHtmlFileParser";
import { ElementLocatorResult } from "./IHtmlElementLocator";
import { IHtmlElementLocator } from "./IHtmlElementLocator";

export class HtmlElementLocator implements IHtmlElementLocator {
    constructor(public readonly documentsProvider: IDocumentsProvider) {
    }

    async locateElement(doc: IHtmlDocument, location: FileLocation, options: HtmlOptions): Promise<ElementLocatorResult> {
        let target: Element;
        let pageNumber: number | undefined;
        let isDocumentStart: boolean = false;
        const flipMode = options.flipMode;
        const contentContainer = doc.getContentContainer();
        const measure = asHtmlFileParser(this.documentsProvider.fileParser).symbolMeasure;
        const symbolType = location.symbolType ?? measure.defaultSymbolType;

        if (!isNullOrWhiteSpace(location.tagName)) {
            target = getElementByNameAndIndex(contentContainer, location.tagName, location.tagIndex);
        }
        else if (location.current != undefined) {
            const unit: ProgressUnit = location.unit ?? "ratio";
            const current = location.current ?? 0;

            if (unit === "page") {
                const result = await this.locateByPageUnit(doc, contentContainer, location, current, flipMode, symbolType, measure);
                target = result.target;
                pageNumber = result.pageNumber;
                isDocumentStart = result.isDocumentStart;
            }
            else if (unit === "symbol") {
                const result = this.locateBySymbolUnit(contentContainer, current, symbolType, measure);
                target = result.target;
                isDocumentStart = result.isDocumentStart;
            }
            else {
                // ratio / second: locate by ratio; keep a compatibility heuristic for values that look like page numbers in page flip mode
                const result = await this.locateByRatioUnit(doc, contentContainer, location, current, flipMode, symbolType, measure);
                target = result.target;
                pageNumber = result.pageNumber;
                isDocumentStart = result.isDocumentStart;
            }
        }
        else {
            const anchor = getUrlFragment(location?.url ?? "").anchor;
            let element: Element = contentContainer;
            if (!isNullOrWhiteSpace(anchor)) {
                const targetAnchor = contentContainer.ownerDocument.getElementById(anchor);
                if (targetAnchor != null) {
                    element = targetAnchor;
                }
            }
            else {
                isDocumentStart = true;
            }

            target = element;
        }

        if (!target) {
            target = contentContainer;
            if (flipMode == "page" && !pageNumber) {
                pageNumber = 1;
            }
        }
        else {
            if (flipMode == "page" && !pageNumber && !(location.textOffset >= 0)) {
                pageNumber = await doc.getPageNumber(target);
            }
        }
        if (compareTagName(target.tagName, "BODY")) {
            isDocumentStart = true;
        }
        return { target, pageNumber, isDocumentStart };
    }

    private async locateByPageUnit(
        doc: IHtmlDocument,
        contentContainer: HTMLElement,
        location: FileLocation,
        current: number,
        flipMode: FlipMode,
        symbolType: SymbolType,
        measure: IHtmlSymbolMeasure,
    ): Promise<PartialLocateResult> {
        if (current == 0) {
            return { target: contentContainer, pageNumber: 1, isDocumentStart: true };
        }

        const numberOfPages = await doc.getNumberOfPages();
        let page = current;
        if (location.total > 1 && location.total != numberOfPages) {
            page = Math.ceil(numberOfPages * (location.current / location.total));
        }

        if (flipMode == "page") {
            return { pageNumber: page, isDocumentStart: false };
        }

        // Scroll mode: convert page number to ratio, then locate the element (page 1 maps to document start)
        if (page <= 1 || numberOfPages <= 1) {
            return { target: contentContainer, isDocumentStart: true };
        }
        if (page >= numberOfPages) {
            return this.locateElementByRatio(contentContainer, Progress.Max, symbolType, measure);
        }
        const ratio = (page - 1) / numberOfPages;
        return this.locateElementByRatio(contentContainer, ratio, symbolType, measure);
    }

    private locateBySymbolUnit(
        contentContainer: HTMLElement,
        current: number,
        symbolType: SymbolType,
        measure: IHtmlSymbolMeasure,
    ): PartialLocateResult {
        if (current == 0) {
            return { target: contentContainer, isDocumentStart: true };
        }

        const result = measure.getElementByPosition(contentContainer, current, symbolType);
        if (result?.element) {
            return { target: result.element, isDocumentStart: false };
        }
        if (contentContainer.lastElementChild) {
            return { target: contentContainer.lastElementChild, isDocumentStart: false };
        }
        return { target: contentContainer, isDocumentStart: false };
    }

    private async locateByRatioUnit(
        doc: IHtmlDocument,
        contentContainer: HTMLElement,
        location: FileLocation,
        current: number,
        flipMode: FlipMode,
        symbolType: SymbolType,
        measure: IHtmlSymbolMeasure,
    ): Promise<PartialLocateResult> {
        if (flipMode == "page") {
            if (current == 0) {
                return { target: contentContainer, pageNumber: 1, isDocumentStart: true };
            }

            const numberOfPages = await doc.getNumberOfPages();
            let value = current;
            // Compat: historical callers often put the page number in current with unit=ratio
            if (location.total > 1 && location.total != numberOfPages) {
                value = Math.ceil(numberOfPages * (location.current / location.total));
            }

            if (value >= Progress.Min && value <= Progress.Max) {
                return this.locateElementByRatio(contentContainer, value, symbolType, measure);
            }
            return { pageNumber: value, isDocumentStart: false };
        }

        return this.locateElementByRatio(contentContainer, current, symbolType, measure);
    }

    private locateElementByRatio(
        contentContainer: HTMLElement,
        ratio: number,
        symbolType: SymbolType,
        measure: IHtmlSymbolMeasure,
    ): PartialLocateResult {
        if (ratio >= Progress.Max && contentContainer.lastElementChild) {
            return { target: contentContainer.lastElementChild, isDocumentStart: false };
        }
        const result = measure.getElementByProgress(contentContainer, ratio, symbolType);
        return { target: result?.element, isDocumentStart: false };
    }
}

type PartialLocateResult = {
    target?: Element;
    pageNumber?: number;
    isDocumentStart: boolean;
};
