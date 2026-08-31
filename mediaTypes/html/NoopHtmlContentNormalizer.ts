import { IHtmlContentNormalizer } from "./IHtmlContentNormalizer";

export class NoopHtmlContentNormalizer implements IHtmlContentNormalizer {
    normalize(html: string): string {
        return html ?? "";
    }
}