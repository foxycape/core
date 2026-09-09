import { IHtmlDocument } from "./IHtmlDocument";
import { IDocumentsProvider } from "../../../kernal";

export interface IHtmlDocumentsProvider extends IDocumentsProvider<IHtmlDocument> {
    getCurrentPageNumber(doc: IHtmlDocument): number;
    /** Progress display only. Must not decide the viewport transform. */
    syncPageState(doc: IHtmlDocument): Promise<{ current: number; total: number }>;
    /** False when the next page-transform would move past the last content slice. */
    canAdvancePageTransform(doc: IHtmlDocument): boolean;
}