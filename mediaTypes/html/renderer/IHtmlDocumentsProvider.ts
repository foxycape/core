import { IHtmlDocument } from "./IHtmlDocument";
import { IDocumentsProvider } from "../../../kernal";

export interface IHtmlDocumentsProvider extends IDocumentsProvider<IHtmlDocument> {
    getCurrentPageNumber(doc: IHtmlDocument): number;
    /** Recalculate current page / page count from the live transform and column metrics. */
    syncPageState(doc: IHtmlDocument): Promise<{ current: number; total: number }>;
    /** False when the next page-transform would move past the last content slice. */
    canAdvancePageTransform(doc: IHtmlDocument): boolean;
}