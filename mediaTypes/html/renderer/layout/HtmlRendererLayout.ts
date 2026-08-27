import { HtmlLayoutMetrics } from "./HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { Direction, EventNames, FileLocation, IDocumentsProvider, IProgressTracker, Reader, Theme, WritingMode, yieldToMain } from "../../../../kernal";
import { HtmlChangeLayoutOptions, IHtmlRendererLayout } from "./IHtmlRendererLayout";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlDocumentsProvider } from "../IHtmlDocumentsProvider";
import { ContentLayoutCssVariableNames } from "../style/ContentLayoutCssVariableNames";
import { getDocumentBody } from "../../../../kernal/html/finder";
import { HtmlSettings } from "../../HtmlSettings";
import { injectCssContent } from "../../../../kernal/html/injector";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { resolveLayoutFlow } from "./resolveLayoutFlow";

export class HtmlRendererLayout implements IHtmlRendererLayout {
    /**Column layout style name */
    private readonly DocumentLayoutCssName = "document-layout";
    private readonly DocumentPageModeCssName = "document-page-mode";
    /**Vertical writing scroll mode style name */
    private readonly WritingVerticalScollDocumentLayoutCssName = "vertical-document-layout";
    private readonly DocumentVerticalPageModeCssName = HtmlSettings.DocumentVerticalPageModeCssName;
    private pageReloadLocation: FileLocation | undefined;

    constructor(private readonly owner: Reader,
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly renererviewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly progress: IProgressTracker,
        private readonly htmlOptions: HtmlOptions) {

    }

    async applyStyles(): Promise<void> {
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.applyDocStyles(doc);
        }
    }

    async applyDocStyles(doc: IHtmlDocument, restoreLayoutState = true): Promise<void> {
        const contentContainer = doc.getContentContainer() ?? await doc.getVirtualContentContainer();
        const documentElement = contentContainer.ownerDocument.documentElement;
        const flow = resolveLayoutFlow(this.htmlOptions);
        const metrics = this.renererviewport.getLayoutMetrics();
        const css = await this.prepareDocStyes(documentElement.ownerDocument, flow.writingMode, flow.direction);
        injectCssContent(documentElement.ownerDocument, css, true, 'columns-layout-css');
        const themeProvider = await this.owner.services.get('themeProvider');
        let theme: Theme;
        if (!themeProvider) {
            theme = new Theme();
        }
        else {
            theme = themeProvider.getCurrentTheme();
        }
        const cssVariables = await this.getCssVariables(theme, metrics, flow);
        //apply
        for (const [key, value] of cssVariables) {
            documentElement.style.setProperty(key, value);
        }

        this.toggleColumnLayout(documentElement, flow);
        documentElement.removeAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName);
        const layoutState = restoreLayoutState ? doc.captureLayoutState() : undefined;
        doc.resetLayoutSizes();
        await yieldToMain();
        if (restoreLayoutState && layoutState) {
            await doc.restoreLayoutState(layoutState);
        }
    }

    private async getCssVariables(theme: Theme, metrics: HtmlLayoutMetrics, flow: ReturnType<typeof resolveLayoutFlow>) {
        let columnMaxHeight: string;
        if (flow.flipMode == "scroll") {
            columnMaxHeight = "none"
        }
        else {
            columnMaxHeight = metrics.columnHeight + "px"
        }
        const columnWidthForCss = flow.useColumnLayout && flow.isVerticalWriting
            ? metrics.pageHeight
            : metrics.columnWidth;
        const vars = new Map<string, string>();
        vars.set(ContentLayoutCssVariableNames.ColumnWidth, columnWidthForCss + "px");
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
        vars.set(
            ContentLayoutCssVariableNames.ImagePlaceholderColor,
            `color-mix(in srgb, var(${Theme.ContentTextColor}) 8%, var(${Theme.ContentBackground}))`
        );

        return vars;
    }

    protected async prepareDocStyes(doc: Document, writingMode: WritingMode, direction: Direction): Promise<string> {
        //default document layout
        let css = "";
        css += `html { writing-mode: ${writingMode} !important; direction: ${direction} !important; }`;
        css += `body { writing-mode: ${writingMode} !important; direction: ${direction} !important; }`;

        //writing mode
        css += "." + this.DocumentPageModeCssName + "";
        css += `{`;
        css += "width:var(" + ContentLayoutCssVariableNames.PageWidth + ") !important;";
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

        css += "." + this.DocumentPageModeCssName + "." + HtmlSettings.RtlProgressionClassName + "{";
        css += "min-width:100% !important;";
        css += "}";

        css += "." + this.WritingVerticalScollDocumentLayoutCssName + ",";
        css += "." + this.WritingVerticalScollDocumentLayoutCssName + " body{";
        css += "height:100% !important;";
        css += "width:max-content !important;";
        css += "max-height:100% !important;";
        css += "overflow:hidden !important;";
        css += "}";

        const contentContainer = getDocumentBody(doc);
        const lastElementChild = contentContainer.lastElementChild;
        if (lastElementChild) {
            css += "." + this.DocumentPageModeCssName + " ." + HtmlSettings.WithoutMarginBottomCssName + "{margin-block-end:0 !important;}";
            lastElementChild.classList.add(HtmlSettings.WithoutMarginBottomCssName);
        }
        return css;
    }

    private toggleColumnLayout(rootElement: HTMLElement, flow: ReturnType<typeof resolveLayoutFlow>) {
        rootElement.classList.add(this.DocumentLayoutCssName);
        rootElement.classList.toggle(this.DocumentPageModeCssName, flow.useColumnLayout);
        rootElement.classList.toggle(this.DocumentVerticalPageModeCssName, flow.useColumnLayout && flow.pageAxis == "y");
        rootElement.classList.toggle(HtmlSettings.RtlProgressionClassName, flow.useColumnLayout && flow.isRtlProgression);
        rootElement.classList.toggle(this.WritingVerticalScollDocumentLayoutCssName, flow.flipMode == "scroll" && flow.isVerticalWriting);
    }

    async changeLayout(options: HtmlChangeLayoutOptions): Promise<void> {
        const flipModeChanged = options.flipMode !== undefined && this.htmlOptions.flipMode !== options.flipMode;
        const columnsChanged = options.columns !== undefined
            && (this.htmlOptions.columns !== options.columns.columns
                || this.htmlOptions.autoColumns !== options.columns.autoColumns);
        const writingModeChanged = options.writingMode !== undefined && this.htmlOptions.writingMode !== options.writingMode;
        const directionChanged = options.direction !== undefined && this.htmlOptions.direction !== options.direction;

        if (!flipModeChanged && !columnsChanged && !writingModeChanged && !directionChanged) {
            return;
        }

        if (!this.owner.context.currentLocation?.precise) {
            const progress = await this.progress.getProgress(true);
            if (progress) {
                this.owner.context.currentLocation = progress.location;
            }
        }

        const payload: Record<string, unknown> = {};
        if (flipModeChanged) {
            payload.flipMode = { previous: this.htmlOptions.flipMode, current: options.flipMode };
            this.htmlOptions.flipMode = options.flipMode;
        }
        if (columnsChanged && options.columns) {
            payload.columns = { previous: this.htmlOptions.columns, current: options.columns.columns };
            payload.autoColumns = { previous: this.htmlOptions.autoColumns, current: options.columns.autoColumns };
            this.htmlOptions.columns = options.columns.columns;
            this.htmlOptions.autoColumns = options.columns.autoColumns;
        }
        if (writingModeChanged) {
            payload.writingMode = { previous: this.htmlOptions.writingMode, current: options.writingMode };
            this.htmlOptions.writingMode = options.writingMode;
        }
        if (directionChanged) {
            payload.direction = { previous: this.htmlOptions.direction, current: options.direction };
            this.htmlOptions.direction = options.direction;
        }

        if (
            (directionChanged || writingModeChanged)
            && resolveLayoutFlow(this.htmlOptions).flipMode == "page"
        ) {
            this.capturePageReloadLocation();
        }
        this.renererviewport.applyCssVariables();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.applyDocStyles(doc, false);
        }
        this.owner.events.emit(EventNames.LayoutChange, payload);
        if (this.pageReloadLocation) {
            const location = this.pageReloadLocation;
            this.pageReloadLocation = undefined;
            await this.documentsProvider.load(location, true);
            return;
        }
        await this.documentsProvider.reload();
    }

    private capturePageReloadLocation() {
        const provider = this.documentsProvider as IHtmlDocumentsProvider;
        const location = this.owner.context.currentLocation;
        const doc = (location?.url && provider.getDocument(location.url)) || provider.getFirstVisibleDocument();
        if (!doc) {
            return;
        }
        const pageLocation = new FileLocation(doc.url, 1, "page");
        pageLocation.current = Math.max(1, provider.getCurrentPageNumber(doc));
        const contentRoot = doc.getContentContainer()?.ownerDocument?.documentElement;
        const cachedPages = parseInt(contentRoot?.getAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName) ?? "", 10);
        if (Number.isFinite(cachedPages) && cachedPages > 0) {
            pageLocation.total = cachedPages;
        }
        this.pageReloadLocation = pageLocation;
    }
}
