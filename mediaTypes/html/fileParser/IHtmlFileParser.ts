import { IFileParser } from "../../../kernal";
import type { IHtmlContentNormalizer } from "../IHtmlContentNormalizer";
import type { IHtmlSymbolMeasure } from "../IHtmlSymbolMeasure";

export interface IHtmlFileParser extends IFileParser {
    options: HtmlFileParserOptions;
    readonly contentNormalizer: IHtmlContentNormalizer;
    readonly symbolMeasure: IHtmlSymbolMeasure;
}

export const asHtmlFileParser = (fileParser: IFileParser): IHtmlFileParser =>
    fileParser as IHtmlFileParser;

/**
 * HTML file parser options (media-specific; not part of IFileParser).
 */
export type HtmlFileParserOptions = {
    /** Whether to wrap floating text nodes (e.g. for fulltext translate) */
    wrapFullTextNode?: boolean;
};
