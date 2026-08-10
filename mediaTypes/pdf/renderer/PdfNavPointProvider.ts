import { containValues } from "../../../kernal/common/array";
import { deepClone } from "../../../kernal/common/object";
import { isNullOrWhiteSpace } from "../../../kernal/common/text";
import { IDocumentsProvider, IFileParser, INavPointProvider, Nav, NavPoint, SymbolType } from "../../../kernal";
import { IPdfDocument, PdfPageGeometry } from "./IPdfDocument";
import { IPdfFileParser } from "../fileParser/IPdfFileParser";

export class PdfNavPointProvider implements INavPointProvider {
    readonly fileParser: IFileParser;
    private flattingNavPoints: NavPoint[] = [];
    // Must not be initialized here
    private reversedFlattingNavPoints: NavPoint[];
    private isInitNav: boolean = false;
    constructor(public readonly documentsProvider: IDocumentsProvider<IPdfDocument, IPdfFileParser>) {
        this.fileParser = documentsProvider.fileParser;
    }
    async getFlattingNavPoints(): Promise<NavPoint[]> {
        return await this.getInternalFlattingNavPoints();
    }

    private async getInternalFlattingNavPoints(reversed?: boolean): Promise<NavPoint[]> {
        if (!this.isInitNav) {
            const nav = await this.fileParser.getNav();
            this.initialNav(nav);
            this.isInitNav = true;
        }
        if (reversed) {
            if (!this.reversedFlattingNavPoints) {
                if (this.flattingNavPoints && this.flattingNavPoints.length > 0) {
                    this.reversedFlattingNavPoints = deepClone<NavPoint[]>(this.flattingNavPoints).reverse();
                    return this.reversedFlattingNavPoints;
                }
                else {
                    this.reversedFlattingNavPoints = []
                    return this.reversedFlattingNavPoints;
                }
            }
            return this.reversedFlattingNavPoints;
        }
        return this.flattingNavPoints;
    }

    async getCurrentNavPoint(): Promise<NavPoint> {
        const flattingNavPoints = await this.getFlattingNavPoints();
        if (flattingNavPoints.length == 0)
            return undefined;
        const visibleDocuments = this.documentsProvider.getVisibleDocuments();
        if (visibleDocuments.length == 0)
            return undefined;
        const doc = visibleDocuments[0];
        return await this.getNavPoint(doc.url, doc.pageNumber, 'char');
    }

    async getNavPoint(url: string, target: Element | number, _symbolType: SymbolType): Promise<NavPoint> {
        const flattingNavPoints = await this.getFlattingNavPoints();
        if (flattingNavPoints.length == 0) {
            return undefined;
        }
        const reversedFlattingNavPoints = await this.getInternalFlattingNavPoints(true);
        const doc = this.documentsProvider.getDocument(url);
        if (!doc) {
            return undefined;
        }

        const pageNumber = doc.pageNumber;
        if (typeof target === "number") {
            // One PDF page maps to one document; resolve nav by the current page for both page numbers and progress ratios
            return this.getNavPointByPageNumber(pageNumber, flattingNavPoints, reversedFlattingNavPoints);
        }

        const geometry = await doc.getPageGeometry();
        if (!geometry) {
            return this.getNavPointByPageNumber(pageNumber, flattingNavPoints, reversedFlattingNavPoints);
        }

        const samePageNavPoints = flattingNavPoints.filter(x => x.startPageNumber == pageNumber);
        if (samePageNavPoints.length > 0) {
            // Scan from last to first: pick the latest nav point the element has passed
            const navPoints = samePageNavPoints.slice().reverse();
            const targetRect = target.getBoundingClientRect();
            for (const navPoint of navPoints) {
                if (this.isElementAtOrPastPdfDest(targetRect, navPoint.pdfDest, geometry)) {
                    return deepClone<NavPoint>(navPoint);
                }
            }
        }

        return this.getNavPointByPageNumber(pageNumber, flattingNavPoints, reversedFlattingNavPoints);
    }

    private getNavPointByPageNumber(
        pageNumber: number,
        flattingNavPoints: NavPoint[],
        reversedFlattingNavPoints: NavPoint[]
    ): NavPoint {
        let navPoint = reversedFlattingNavPoints.find(x => x.startPageNumber == pageNumber);
        if (!navPoint) {
            navPoint = reversedFlattingNavPoints.find(x => x.startPageNumber <= pageNumber);
        }
        if (!navPoint) {
            return undefined;
        }
        const originalNavPoint = flattingNavPoints.find(x => x.url == navPoint.url);
        return deepClone<NavPoint>(originalNavPoint ?? navPoint);
    }

    /**
     * Whether the element has reached or passed the XYZ destination on the page.
     */
    private isElementAtOrPastPdfDest(
        targetRect: DOMRect,
        pdfDest: string | undefined,
        geometry: PdfPageGeometry
    ): boolean {
        if (!pdfDest || pdfDest.indexOf("XYZ") <= 0) {
            return false;
        }
        let pdfDestArray: any[];
        try {
            pdfDestArray = JSON.parse(pdfDest) as any[];
        } catch {
            return false;
        }
        const rawY = parseFloat(pdfDestArray[3]);
        if (!Number.isFinite(rawY) || geometry.rawHeight <= 0) {
            return false;
        }

        const { rotation, rawHeight, displayWidth, displayHeight, pageRect } = geometry;
        // Scale with display size to avoid mixing pageRect width/height
        const alongReading = rotation % 180 == 0
            ? (rawY / rawHeight) * displayHeight
            : (rawY / rawHeight) * displayWidth;

        if (rotation == 0) {
            // PDF Y grows upward; DOM top grows downward
            return displayHeight - alongReading <= targetRect.top - pageRect.top;
        }
        if (rotation == 90) {
            return displayWidth - alongReading <= pageRect.right - targetRect.right;
        }
        if (rotation == 180) {
            return displayHeight - alongReading <= pageRect.bottom - targetRect.bottom;
        }
        if (rotation == 270) {
            return displayWidth - alongReading <= targetRect.left - pageRect.left;
        }
        return false;
    }

    async dispose(): Promise<void> {
        if (this.flattingNavPoints) {
            this.flattingNavPoints.splice(0);
        }
        if (this.reversedFlattingNavPoints) {
            this.reversedFlattingNavPoints.splice(0);
        }
    }


    private initialNav(nav: Nav) {
        this.flattingNavPoints = [];
        if (!containValues(nav?.navPoints))
            return;
        this.initialNavPoints(nav.navPoints);
    }

    private initialNavPoints(navPoints: NavPoint[]) {
        if (navPoints.length == 0)
            return;
        navPoints.forEach((navPoint) => {
            if (!isNullOrWhiteSpace(navPoint.url) || navPoint.startPageNumber > 0) {
                this.flattingNavPoints.push(navPoint);
            }
            if (containValues(navPoint.children)) {
                this.initialNavPoints(navPoint.children);
            }
        })
    }
}
