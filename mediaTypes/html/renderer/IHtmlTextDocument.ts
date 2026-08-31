import { ITextDocument } from "../../../kernal/ITextDocument";

export interface IHtmlTextDocument extends ITextDocument {
    /**
     * Normalized chapter HTML source (after IHtmlContentNormalizer).
     */
    getContent(): Promise<string>;

    /**
     * Standard chapter Document: normalize → parse → wrap/number.
     * Use this for chapter DOM; do not re-parse the source.
     */
    getFormattedDocument(): Promise<Document>;
}