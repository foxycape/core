import type { IPdfRendererLayout, PdfScrollMode, PdfSpreadMode } from "./IPdfRendererLayout";
import type { MultiPDFViewer } from "../MultiPdfViewer";

export class PdfRendererLayout implements IPdfRendererLayout {
    constructor(private readonly pdfViewer: MultiPDFViewer) { }

    changeScrollMode(direction: PdfScrollMode): void {
        //scrollMode 0-vertical，1-horizontal，2-doublePage，3-singlePage
        this.pdfViewer.scrollMode = direction === "horizontal" ? 1 : 0;
    }

    changeSpreadMode(spreadMode: PdfSpreadMode): void {
        //spreadMode 0-single，1-double，2-doubleBook
        this.pdfViewer.spreadMode = spreadMode === "single" ? 0 : spreadMode === "double" ? 1 : 2;
    }

    rotatePages(delta: number): void {
        this.pdfViewer.pagesRotation += delta;
    }
}
