import { HtmlLayoutMetrics } from "./HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { EventNames, FlipMode, IDocumentsProvider, IProgressTracker, Reader, Theme, WritingMode } from "../../../../kernal";
import { ColumnOptions, IHtmlRendererLayout } from "./IHtmlRendererLayout";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { ContentLayoutCssVariableNames } from "../style/ContentLayoutCssVariableNames";
import { getDocumentBody } from "../../../../kernal/html/finder";
import { HtmlSettings } from "../../HtmlSettings";
import { injectCssContent } from "../../../../kernal/html/injector";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";

export class HtmlRendererLayout implements IHtmlRendererLayout {
    /**Column layout style name */
    private readonly ColumnsLayoutCssName = "columns-layout";
    /**Vertical writing scroll mode style name */
    private readonly WritingVerticalScollColumnsLayoutCssName = "vertical-columns-layout";

    constructor(private readonly owner: Reader,
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly renererviewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly progress: IProgressTracker,
        private readonly htmlOptions: HtmlOptions) {

    }

    async applyCssVariables(): Promise<void> {
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.injectColumnStyles(doc);
        }
    }

    async injectColumnStyles(doc: IHtmlDocument): Promise<void> {
        const contentContainer = doc.getContentContainer() ?? await doc.getVirtualContentContainer();
        const documentElement = contentContainer.ownerDocument.documentElement;
        const flipMode = this.htmlOptions.flipMode;
        const metrics = this.renererviewport.getLayoutMetrics();
        //inject column styles
        const css = await this.prepareColumnsStyes(documentElement.ownerDocument, doc.getWritingMode());
        injectCssContent(documentElement.ownerDocument, css, true, 'columns-layout-css');
        const themeProvider = await this.owner.services.get('themeProvider');
        let theme: Theme;
        if (!themeProvider) {
            theme = new Theme();
        }
        else {
            theme = themeProvider.getCurrentTheme();
        }
        const cssVariables = await this.getCssVariables(theme, metrics, flipMode);
        //apply
        for (const [key, value] of cssVariables) {
            documentElement.style.setProperty(key, value);
        }

        this.toggleColumnLayout(documentElement, flipMode, doc.getWritingMode());
    }

    private async getCssVariables(theme: Theme, metrics: HtmlLayoutMetrics, flipMode: FlipMode) {
        let columnMaxHeight: string;
        if (flipMode == "scroll") {
            columnMaxHeight = "none"
        }
        else {
            columnMaxHeight = metrics.columnHeight + "px"
        }
        const vars = new Map<string, string>();
        vars.set(ContentLayoutCssVariableNames.ColumnWidth, metrics.columnWidth + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnHeight, metrics.columnHeight + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnMaxHeight, columnMaxHeight);
        vars.set(ContentLayoutCssVariableNames.ContentShadowWidth, metrics.shadowWidth + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnWidthNumber, metrics.columnWidth.toString());
        vars.set(ContentLayoutCssVariableNames.ColumnHeightNumber, metrics.columnHeight.toString());

        vars.set(ContentLayoutCssVariableNames.PageWidth, metrics.pageWidth + "px");
        vars.set(ContentLayoutCssVariableNames.PageHeight, metrics.pageHeight + "px");
        vars.set(ContentLayoutCssVariableNames.PageMoveLength, metrics.pageMoveLength + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnGap, this.htmlOptions.columnGap + "px");
        if (this.htmlOptions.enableColumnRule && this.htmlOptions.columns > 1 && !isNullOrWhiteSpace(theme.columnRuleColor)) {
            vars.set(Theme.ColumnRuleColor, theme.columnRuleColor);
        }
        else {
            vars.set(Theme.ColumnRuleColor, "none");
        }

        // const imageRatio = this.runtime.getFlipMode() == "page" ? 0.7 : 1;
        vars.set(ContentLayoutCssVariableNames.MaxImageHeightRatio, `${this.htmlOptions.maxImageHeightRatio}`);
        // vars.set(ReaderCssVariables.MaxImageWidthRatio, `${imageRatio}`);
        vars.set(ContentLayoutCssVariableNames.MaxImageWidthRatio, `${this.htmlOptions.maxImageWidthRatio}`);

        return vars;
    }

    private prepareColumnsStyes = async (doc: Document, writingMode: WritingMode) => {
        let css = "." + this.ColumnsLayoutCssName + "";
        css += "{";
        if (writingMode == 'horizontal-tb') {
            css += "width:var(" + ContentLayoutCssVariableNames.ContentShadowWidth + ")  !important;";
        }
        else {
            css += "width:var(" + ContentLayoutCssVariableNames.PageWidth + ") !important;";
        }

        css += "height:var(" + ContentLayoutCssVariableNames.PageHeight + ") !important;";
        css += "column-width:var(" + ContentLayoutCssVariableNames.ColumnWidth + ") !important;";
        css += "column-rule:1px solid var(" + Theme.ColumnRuleColor + ") !important;";
        css += "column-fill:auto;column-gap:var(" + ContentLayoutCssVariableNames.ColumnGap + ") !important;";
        css += "page-break-inside:avoid;break-inside:avoid;";
        css += "transition-property: transform;";
        css += "overflow: hidden !important;";
        css += "overflow-wrap: break-word !important;";
        css += "position: static !important;";
        css += "border: 0px !important;";
        css += "margin: 0px !important;";
        css += "padding:0px !important;";
        css += "max-height: none !important;";
        css += "max-width: none !important;";
        css += "}";


        //Vertical writing, scroll mode layout
        css += "." + this.WritingVerticalScollColumnsLayoutCssName + "";
        css += "{";
        //Vertical layout, height using column width
        css += "width:100%;height:var(" + ContentLayoutCssVariableNames.ColumnWidth + ") !important;";
        css += "column-fill:auto;column-width:var(" + ContentLayoutCssVariableNames.ColumnWidth + ") !important;"
        css += "column-gap:var(" + ContentLayoutCssVariableNames.ColumnGap + ") !important;";
        css += "page-break-inside:avoid;break-inside:avoid;";
        css += "margin:0 auto !important;padding:0 !important;";
        css += "column-rule:1px solid var(" + Theme.ColumnRuleColor + ") !important;";
        css += "}";

        const contentContainer = getDocumentBody(doc);
        const lastElementChild = contentContainer.lastElementChild;
        if (lastElementChild) {
            css += "." + HtmlSettings.WithoutMarginBottomCssName + "{margin-block-end:0 !important;}";
            lastElementChild.classList.add(HtmlSettings.WithoutMarginBottomCssName);
        }
        return css;
    }

    private toggleColumnLayout(rootElement: HTMLElement, flipMode: FlipMode, writingMode: WritingMode) {
        if (flipMode == "page") {
            rootElement.classList.remove(this.WritingVerticalScollColumnsLayoutCssName);
            rootElement.classList.add(this.ColumnsLayoutCssName);
        }
        else {
            if (this.isVerticalWriting(writingMode) && !this.htmlOptions.forceScroll) {
                rootElement.classList.remove(this.ColumnsLayoutCssName);
                rootElement.classList.add(this.WritingVerticalScollColumnsLayoutCssName);
            }
            else {
                rootElement.classList.remove(this.WritingVerticalScollColumnsLayoutCssName);
                rootElement.classList.remove(this.ColumnsLayoutCssName);
            }
        }
    }

    private isVerticalWriting(writingMode: WritingMode) {
        return writingMode == "vertical-lr" || writingMode == "vertical-rl";
    }

    async changeFlipMode(flipMode: FlipMode): Promise<void> {
        if (this.htmlOptions.flipMode === flipMode) {
            return;
        }
        const oldFlipMode = this.htmlOptions.flipMode;
        const oldColumns = this.htmlOptions.columns;
        const oldAutoColumns = this.htmlOptions.autoColumns;
        if (!this.owner.context.currentLocation?.precise) {
            const progress = await this.progress.getProgress(true);
            if (progress) {
                this.owner.context.currentLocation = progress.location;
            }
        }
        this.owner.context.setUserChangedProgress(false);
        this.htmlOptions.flipMode = flipMode;
        this.renererviewport.applyCssVariables();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.injectColumnStyles(doc);
        }
        this.owner.events.emit(EventNames.LayoutChange, oldFlipMode, oldColumns, oldAutoColumns);
        await this.documentsProvider.reload();
    }

    async changeColumns(columnOptions: ColumnOptions): Promise<void> {
        if (this.htmlOptions.columns === columnOptions.columns && this.htmlOptions.autoColumns === columnOptions.autoColumns) {
            return;
        }
        const oldFlipMode = this.htmlOptions.flipMode;
        const oldColumns = this.htmlOptions.columns;
        const oldAutoColumns = this.htmlOptions.autoColumns;
        if (!this.owner.context.currentLocation?.precise) {
            const progress = await this.progress.getProgress(true);
            if (progress) {
                this.owner.context.currentLocation = progress.location;
            }
        }
        this.owner.context.setUserChangedProgress(false);
        this.htmlOptions.columns = columnOptions.columns;
        this.htmlOptions.autoColumns = columnOptions.autoColumns;
        this.renererviewport.applyCssVariables();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.injectColumnStyles(doc);
        }
        this.owner.events.emit(EventNames.LayoutChange, oldFlipMode, oldColumns, oldAutoColumns);
        await this.documentsProvider.reload();
    }
}
