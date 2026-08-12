import type { IEventEmitter, IFileParser, IInternalUrlBuilder, ILocale, OpenOptions, SpineFile } from "../../../kernal";
import type { DocumentInitParameters } from '../../../pdfjs/types/src/display/api';
import * as pdfjsLib from '../../../pdfjs/legacy/build/pdf.mjs';

export interface IPdfFileParser extends IFileParser {
    /**
     * Get the pdf document
     * @param spineFile
     */
    getPdfDocument(spineFile: SpineFile): Promise<pdfjsLib.PDFDocumentProxy>
}

export type PdfPasswordPromptCallback = (password: string | Error) => void | Promise<void>

export type PdfFileParserOptions = {
    cMapUrl?: string;
    standardFontDataUrl?: string;
    /**
     * Enable pdf.js password prompt. When true,
     * PdfPasswordProvider emits EventNames.RequirePdfPassword (app only needs to listen).
     */
    showPasswordPrompt?: boolean;
    standardPasswordProvider?: (fileParser: IFileParser, spineFile?: SpineFile) => Promise<string | undefined>;
    internalUrlBuilder?: IInternalUrlBuilder;
    /** Mutate pdf.js getDocument parameters (e.g. embedded CMap/font factories). */
    documentInitParametersCallback?: (documentInitParameters: DocumentInitParameters) => void;
};
