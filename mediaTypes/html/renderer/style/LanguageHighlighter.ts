import type { HLJSApi } from "highlight.js";
import { IDocument, IDocumentsProvider, Theme } from "../../../../kernal";
import { getRequireHighlightCodeElements } from "../../../../kernal/html/image";
import { getDocumentBody } from "../../../../kernal/html/finder";
import { injectCssContent, removeElement } from "../../../../kernal/html/injector";
import { IHtmlDocument } from "../IHtmlDocument";
import { ContentLayoutCssVariableNames } from "./ContentLayoutCssVariableNames";
import { ILanguageHighlighter } from "./ILanguageHighlighter";

const NO_TEXT_INDENT_CLASS = "no-text-intent";

/**
 * highlight.js syntax highlighting for HTML documents.
 * Theme CSS is injected into each iframe; github-dark is used for dark colorMode.
 */
export class LanguageHighlighter implements ILanguageHighlighter {
    private readonly languagesHighlightCssId = "languages-highlight-css";
    private readonly highlightedDocuments = new Map<IDocument, boolean>();
    private loadedHljs?: HLJSApi;

    constructor(private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>) {
    }

    async dispose(): Promise<void> {
        this.highlightedDocuments.clear();
        this.loadedHljs = undefined;
    }

    async applyTheme(theme: Theme): Promise<void> {
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            const ownerDocument = doc.getContentContainer()?.ownerDocument;
            if (!ownerDocument) {
                continue;
            }
            if (theme.colorMode === "dark") {
                await this.injectCss(theme, ownerDocument);
            }
            else if (this.highlightedDocuments.get(doc)) {
                await this.injectCss(theme, ownerDocument);
            }
            else {
                removeElement(ownerDocument, this.languagesHighlightCssId);
            }
        }
    }

    /**
     * Prepare `pre` overflow/indent and highlight fenced code blocks.
     */
    async highlight(doc: IDocument): Promise<void> {
        const htmlDoc = doc as IHtmlDocument;
        const ownerDocument = (await htmlDoc.getVirtualContentContainer())?.ownerDocument;
        if (!ownerDocument) {
            return;
        }

        const pres = ownerDocument.getElementsByTagName("pre");
        for (let i = 0; i < pres.length; i++) {
            const pre = pres[i] as HTMLElement;
            pre.classList.add(NO_TEXT_INDENT_CLASS);
            pre.style.setProperty("max-height", `var(${ContentLayoutCssVariableNames.ColumnMaxHeight})`, "important");
            if (pre.firstElementChild) {
                pre.firstElementChild.classList.add(NO_TEXT_INDENT_CLASS);
            }
        }

        const requireHighlightItems = getRequireHighlightCodeElements(ownerDocument);
        const foundRequireHighlightItems = requireHighlightItems.length > 0;
        this.highlightedDocuments.set(doc, foundRequireHighlightItems);
        if (!foundRequireHighlightItems) {
            return;
        }

        const hljs = await this.getHighlightJs();
        const theme = await this.resolveCurrentTheme();
        await this.injectCss(theme, ownerDocument);
        for (const element of requireHighlightItems) {
            hljs.highlightElement(element as HTMLElement);
        }
    };

    private injectCss = async (theme: Theme, ownerDocument: Document) => {
        const body = getDocumentBody(ownerDocument);
        if (!body) {
            return;
        }
        const css = await this.getHighlightCss(theme);
        injectCssContent(ownerDocument, css, true, this.languagesHighlightCssId);
    };

    private getHighlightJs = async () => {
        if (this.loadedHljs) {
            return this.loadedHljs;
        }
        const { default: hljs } = await import("highlight.js");
        this.loadedHljs = hljs;
        return this.loadedHljs;
    };

    private getHighlightCss = async (theme: Theme) => {
        if (theme.colorMode === "dark") {
            const { default: contentCss } = await import("highlight.js/styles/github-dark.css?raw");
            return contentCss.toString();
        }
        const { default: contentCss } = await import("highlight.js/styles/github.css?raw");
        return contentCss.toString();
    };

    private resolveCurrentTheme = async (): Promise<Theme> => {
        const themeProvider = await this.documentsProvider.owner.services.get("themeProvider");
        return themeProvider?.getCurrentTheme() ?? new Theme();
    };
}
