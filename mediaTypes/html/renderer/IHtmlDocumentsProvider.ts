import { IHtmlDocument } from "./IHtmlDocument";
import { IDocumentsProvider } from "../../../kernal";

export interface IHtmlDocumentsProvider extends IDocumentsProvider<IHtmlDocument> {
    getCurrentPageNumber(doc: IHtmlDocument): number;
    /** False when the next page-transform would move past the last content slice. */
    canAdvancePageTransform(doc: IHtmlDocument): boolean;
}