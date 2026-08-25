import { injectCssContent } from "../../../../kernal/html/injector";
import { IDocument, IDocumentsProvider, IStyleProvider } from "../../../../kernal";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { ContentCssVariables } from "./ContentCssVariables";

export class HtmlStyleProvider implements IStyleProvider {
    readonly defaultVariables: Map<string, string> = new Map<string, string>();
    readonly currentVariables: Map<string, string> = new Map<string, string>();
    private readonly contentStyleId = "html-content-css-variables-style";

    constructor(private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>) {
        this.defaultVariables.clear();
        for (const [key, value] of ContentCssVariables.getDefaultVariables()) {
            this.defaultVariables.set(key, value);
        }
    }

    initialize(currentVariables?: Map<string, string>): void {
        this.currentVariables.clear();
        if (currentVariables) {
            for (const [key, value] of currentVariables) {
                this.currentVariables.set(key, value);
            }
        }
    }

    private async getCss(): Promise<string> {
        const { default: contentCss } = await import("./html-content.css?raw");
        return contentCss.toString();
    }

    getDefaultVariables(): Map<string, string> {
        return this.defaultVariables;
    }

    getCurrentVariables(): Map<string, string> {
        return this.currentVariables;
    }

    getDefaultVariableValue(variableName: string): string {
        return this.defaultVariables.get(variableName) ?? "";
    }

    getVariableValue(variableName: string): string {
        return this.currentVariables.get(variableName) ?? this.defaultVariables.get(variableName) ?? "";
    }

    async injectStyles(doc: IDocument): Promise<void> {
        let contentContainer = doc.getContentContainer();
        if (!contentContainer) {
            contentContainer = await (doc as IHtmlDocument).getVirtualContentContainer();
        }
        if (!contentContainer?.ownerDocument) {
            return;
        }
        const ownerDocument = contentContainer.ownerDocument;
        const documentElement = ownerDocument.documentElement;
        for (const [key, value] of this.defaultVariables) {
            if (!this.currentVariables.has(key)) {
                documentElement.style.setProperty(key, value);
            }
        }
        for (const [key, value] of this.currentVariables) {
            documentElement.style.setProperty(key, this.normalizeVariableValue(key, value));
        }
        this.syncUserSpecifiedFontClass(documentElement);
        const css = await this.getCss();
        injectCssContent(ownerDocument, css, true, this.contentStyleId);
    }

    private isUserSpecifiedFontFamily(value: string): boolean {
        const family = value.trim();
        if (!family || family === "inherit" || family === "default") {
            return false;
        }
        return family !== ContentCssVariables.FallbackFontFamily;
    }

    private syncUserSpecifiedFontClass(documentElement: HTMLElement): void {
        const family = this.normalizeVariableValue(
            ContentCssVariables.FontFamily,
            this.getVariableValue(ContentCssVariables.FontFamily),
        );
        documentElement.classList.toggle(
            HtmlSettings.UserSpecifiedFontClassName,
            this.isUserSpecifiedFontFamily(family),
        );
    }

    private normalizeVariableValue(variableName: string, variableValue: string): string {
        if (variableName === ContentCssVariables.FontFamily && variableValue.trim() === "inherit") {
            return ContentCssVariables.FallbackFontFamily;
        }
        return variableValue;
    }

    async changeStyles(variableNameValues: Map<string, string>): Promise<void> {
        for (const [key, value] of variableNameValues) {
            this.currentVariables.set(key, this.normalizeVariableValue(key, value));
        }
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        const visibleDocuments = loadedDocuments.filter((document) => document.getWrapperContainer()?.isVisible);
        const otherDocuments = loadedDocuments.filter((document) => !document.getWrapperContainer()?.isVisible);
        for (const document of visibleDocuments) {
            this.applyVariablesToDocument(document, variableNameValues);
        }
        for (const document of otherDocuments) {
            this.applyVariablesToDocument(document, variableNameValues);
        }
        await this.documentsProvider.reload();
    }

    async changeStyle(variableName: string, variableValue: string): Promise<void> {
        await this.changeStyles(new Map([[variableName, variableValue]]));
    }

    private applyVariablesToDocument(document: IHtmlDocument, variableNameValues: Map<string, string>): void {
        const contentContainer = document.getContentContainer();
        const documentElement = contentContainer?.ownerDocument?.documentElement;
        if (!documentElement) {
            return;
        }
        for (const [key, value] of variableNameValues) {
            documentElement.style.setProperty(key, this.normalizeVariableValue(key, value));
        }
        this.syncUserSpecifiedFontClass(documentElement);
    }

    async resetStyles(): Promise<void> {
        this.currentVariables.clear();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const document of loadedDocuments) {
            await this.injectStyles(document);
        }
    }

    async dispose(): Promise<void> {
        this.defaultVariables.clear();
        this.currentVariables.clear();
    }
}
