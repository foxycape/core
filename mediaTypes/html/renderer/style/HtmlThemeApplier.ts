import { BrowserCapabilities, IDocumentsProvider, MTTAG, readerPrefixName, Theme } from "../../../../kernal";
import { compareTagName } from "../../../../kernal/html/finder";
import { injectCssContent, removeElement } from "../../../../kernal/html/injector";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlThemeApplier } from "./IHtmlThemeApplier";

/**
 * Apply theme color styles to HTML child documents (iframes).
 * Layout / reading preference variables belong to HtmlStyleProvider.
 */
export class HtmlThemeApplier implements IHtmlThemeApplier {
    /** placeholder classes to raise CSS selector specificity against book styles */
    private readonly holderClassNames = [
        readerPrefixName + "a",
        readerPrefixName + "b",
        readerPrefixName + "c",
        readerPrefixName + "d",
    ];
    private readonly allElementSelectorPrefix =
        `html body *[class*='${readerPrefixName}a'][class*='${readerPrefixName}b'][class*='${readerPrefixName}c']`;
    private readonly documentElementSelectorPrefix =
        `html,body[class*='${readerPrefixName}a'][class*='${readerPrefixName}b'][class*='${readerPrefixName}c']`;
    private readonly preElementSelectorPrefix =
        `html body pre[class*='${readerPrefixName}a'][class*='${readerPrefixName}b'][class*='${readerPrefixName}c']`;
    private readonly preAllElementSelectorPrefix =
        `html body pre *[class*='${readerPrefixName}a'][class*='${readerPrefixName}b'][class*='${readerPrefixName}c']`;
    private readonly animationElementSelectorPrefix =
        `html body *[class*='${readerPrefixName}a'][class*='${readerPrefixName}b'][class*='${readerPrefixName}c'][class*='${readerPrefixName}d']`;

    private readonly specialColorCssName = readerPrefixName + "reader-special-color";
    private readonly specialBackgroundCssName = readerPrefixName + "reader-special-background";
    private readonly specialColorCssId = readerPrefixName + "reader-special-variables-color-css";
    private readonly specialBackgroundCssId = readerPrefixName + "reader-special-variables-background-css";
    private readonly preBackgroundCssId = readerPrefixName + "reader-pre-variables-background-css";
    private readonly themeDynamicCssId = readerPrefixName + "html-theme-dynamic-css";
    private readonly holdersMarkedAttr = readerPrefixName + "theme-holders";

    constructor(private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>) {
    }

    async applyTheme(theme: Theme): Promise<void> {
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.applyToDocument(doc, theme);
        }
    }

    /**
     * Apply theme to a single document (e.g. on DocumentLoad).
     */
    async applyToDocument(doc: IHtmlDocument, theme: Theme): Promise<void> {
        let contentContainer = doc.getContentContainer();
        if (!contentContainer) {
            contentContainer = await doc.getVirtualContentContainer();
        }
        if (!contentContainer?.ownerDocument?.documentElement) {
            return;
        }

        const documentElement = contentContainer.ownerDocument.documentElement;
        this.applyCssVariables(documentElement, theme);
        await this.ensureHolderClasses(contentContainer);
        this.injectThemeStyles(documentElement, theme);
    }

    private applyCssVariables(documentElement: HTMLElement, theme: Theme): void {
        documentElement.style.setProperty(Theme.GotoTargetAnimationColor, theme.gotoTargetAnimationColor);
        documentElement.style.setProperty(Theme.ContentBackground, theme.contentBackground);
        documentElement.style.setProperty(Theme.ContentTextColor, theme.contentTextColor);
        documentElement.style.setProperty(Theme.CodeblockBackgroundColor, theme.codeblockBackgroundColor);
        documentElement.style.setProperty(Theme.SelectionBackground, theme.selectionBackground);
        documentElement.style.setProperty(Theme.SelectionColor, theme.selectionColor);
        documentElement.style.setProperty(Theme.ColumnRuleColor, theme.columnRuleColor);

        if (theme.vars) {
            for (const [name, value] of Object.entries(theme.vars)) {
                if (name) {
                    documentElement.style.setProperty(name, value);
                }
            }
        }
    }

    private async ensureHolderClasses(contentContainer: HTMLElement): Promise<void> {
        const documentElement = contentContainer.ownerDocument.documentElement as HTMLElement;
        if (documentElement.getAttribute(this.holdersMarkedAttr) === "1") {
            return;
        }

        const supportScheduler = BrowserCapabilities.supportScheduler();
        const elements = contentContainer.getElementsByTagName("*");
        const preElementChildren: Element[] = [];
        for (let i = 0; i < elements.length; i++) {
            const currentElement = elements[i];
            if (preElementChildren.includes(currentElement)) {
                continue;
            }
            if (compareTagName(currentElement.tagName, MTTAG)) {
                continue;
            }
            if (compareTagName(currentElement.tagName, "PRE")) {
                currentElement.classList.add(...this.holderClassNames);
                currentElement.classList.add(this.specialColorCssName, this.specialBackgroundCssName);
                if (currentElement.firstElementChild && compareTagName(currentElement.firstElementChild.tagName, "CODE")) {
                    currentElement.firstElementChild.classList.add(...this.holderClassNames);
                    currentElement.firstElementChild.classList.add(this.specialBackgroundCssName);
                }
                preElementChildren.push(...Array.from(currentElement.getElementsByTagName("*")));
                continue;
            }
            currentElement.classList.add(...this.holderClassNames);
            currentElement.classList.add(this.specialColorCssName, this.specialBackgroundCssName);
            if (i % 100 === 0 && supportScheduler) {
                await scheduler.yield();
            }
        }

        contentContainer.classList.add(...this.holderClassNames);
        contentContainer.classList.add(this.specialColorCssName, this.specialBackgroundCssName);
        documentElement.classList.add(...this.holderClassNames);
        documentElement.classList.add(this.specialColorCssName, this.specialBackgroundCssName);
        documentElement.setAttribute(this.holdersMarkedAttr, "1");
    }

    private injectThemeStyles(documentElement: HTMLElement, theme: Theme): void {
        // text color: only force for black themes (preserve book colors otherwise)
        if (theme.colorMode === "black" && theme.contentTextColor !== "inherit") {
            const colorCss =
                `${this.documentElementSelectorPrefix}.${this.specialColorCssName},` +
                `${this.allElementSelectorPrefix}.${this.specialColorCssName}` +
                `{color:var(${Theme.ContentTextColor}) !important;}`;
            injectCssContent(documentElement, colorCss, true, this.specialColorCssId);
        }
        else {
            removeElement(documentElement, this.specialColorCssId);
        }

        // background: white themes keep book backgrounds; others override with !important
        const importantKey = theme.colorMode === "white" ? "" : "!important";
        if (theme.colorMode === "white") {
            removeElement(documentElement, this.specialBackgroundCssId);
        }
        else {
            const backgroundCss =
                `${this.documentElementSelectorPrefix}.${this.specialBackgroundCssName},` +
                `${this.allElementSelectorPrefix}.${this.specialBackgroundCssName}` +
                `{background-color:var(${Theme.ContentBackground}) ${importantKey};}`;
            injectCssContent(documentElement, backgroundCss, true, this.specialBackgroundCssId);
        }

        const preBackgroundCss =
            `${this.preElementSelectorPrefix}.${this.specialBackgroundCssName},` +
            `${this.preAllElementSelectorPrefix}.${this.specialBackgroundCssName}` +
            `{background-color:var(${Theme.CodeblockBackgroundColor}) ${importantKey};}`;
        injectCssContent(documentElement, preBackgroundCss, true, this.preBackgroundCssId);

        let dynamicCss = "";
        dynamicCss += `::selection{background:var(${Theme.SelectionBackground});color:var(${Theme.SelectionColor});}`;

        dynamicCss += "@keyframes bg {";
        dynamicCss += "0% {background: transparent;}";
        dynamicCss += `50% {background: var(${Theme.GotoTargetAnimationColor});}`;
        dynamicCss += "100% {background: transparent;}";
        dynamicCss += "}";

        dynamicCss += `${this.animationElementSelectorPrefix}.${HtmlSettings.HtmlDocumentGotoAnimationCssName}{`;
        dynamicCss += "animation:bg 2s !important;";
        dynamicCss += "}";
        dynamicCss += `.${HtmlSettings.HtmlDocumentGotoAnimationCssName}{`;
        dynamicCss += "animation:bg 2s !important;";
        dynamicCss += "}";

        injectCssContent(documentElement, dynamicCss, true, this.themeDynamicCssId);
    }
}
