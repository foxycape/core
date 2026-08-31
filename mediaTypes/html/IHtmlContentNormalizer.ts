/**
 * Rewrites chapter HTML source before it is parsed into a Document.
 * Applied only in HtmlTextDocument.getContent.
 * Packaging XML (OPF / NCX) and SVG must not go through this.
 */
export type IHtmlContentNormalizer = {
    normalize: (html: string) => string
}

/** Default: leave chapter source unchanged. */
export const identityHtmlContentNormalizer: IHtmlContentNormalizer = {
    normalize: (html) => html ?? "",
}
