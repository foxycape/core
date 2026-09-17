import { HtmlLayoutMetrics } from "./HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { EventNames, FileLocation, IDocumentsProvider, IProgressTracker, Reader, Theme, yieldToMain } from "../../../../kernal";
import { HtmlChangeLayoutOptions, IHtmlRendererLayout } from "./IHtmlRendererLayout";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlDocumentsProvider } from "../IHtmlDocumentsProvider";
import { ContentLayoutCssVariableNames } from "../style/ContentLayoutCssVariableNames";
import { getDocumentBody } from "../../../../kernal/html/finder";
import { HtmlSettings } from "../../HtmlSettings";
import { injectCssContent } from "../../../../kernal/html/injector";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { applyContentLayoutClass } from "./applyLayoutClasses";
import { DOCUMENT_LAYOUT_CSS } from "./css/hostLayoutCss";
import type { ILayoutGeometry } from "./geometry/ILayoutGeometry";
import {
    freezePageStripForRouteChange,
    unfreezePageStripForRouteChange,
    waitForPageStripPaint,
} from "./pageStripRouteChange";
import { getLayoutGeometry } from "./resolveLayoutRoute";

export class HtmlRendererLayout implements IHtmlRendererLayout {
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

    async applyDocStyles(doc: IHtmlDocument): Promise<void> {
        const contentContainer = doc.getContentContainer() ?? await doc.getVirtualContentContainer();
        const documentElement = contentContainer.ownerDocument.documentElement;
        const geometry = getLayoutGeometry(this.htmlOptions);
        const metrics = this.renererviewport.getLayoutMetrics();
        injectCssContent(documentElement.ownerDocument, this.prepareDocStyles(documentElement.ownerDocument), true, "columns-layout-css");
        const themeProvider = await this.owner.services.get("themeProvider");
        const theme = themeProvider ? themeProvider.getCurrentTheme() : new Theme();
        const cssVariables = await this.getCssVariables(theme, metrics, geometry);
        for (const [key, value] of cssVariables) {
            documentElement.style.setProperty(key, value);
        }

        applyContentLayoutClass(documentElement, geometry);
        documentElement.removeAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName);
        doc.resetLayoutSizes();
        await yieldToMain();
    }

    private async getCssVariables(theme: Theme, metrics: HtmlLayoutMetrics, geometry: ILayoutGeometry) {
        const columnMaxHeight = geometry.flipMode == "scroll" ? "none" : metrics.columnHeight + "px";
        const columnWidthForCss = geometry.getColumnWidthForCss(metrics.columnWidth, metrics.pageHeight);
        const vars = new Map<string, string>();
        vars.set(ContentLayoutCssVariableNames.ColumnWidth, columnWidthForCss + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnHeight, metrics.columnHeight + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnMaxHeight, columnMaxHeight);
        vars.set(ContentLayoutCssVariableNames.ContentShadowWidth, metrics.shadowWidth + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnWidthNumber, metrics.columnWidth.toString());
        vars.set(ContentLayoutCssVariableNames.ColumnHeightNumber, metrics.columnHeight.toString());
        vars.set(ContentLayoutCssVariableNames.ColumnBoxWidth, metrics.columnWidth + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnBoxHeight, metrics.columnHeight + "px");

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

        vars.set(ContentLayoutCssVariableNames.MaxImageHeightRatio, `${this.htmlOptions.maxImageHeightRatio}`);
        vars.set(ContentLayoutCssVariableNames.MaxImageWidthRatio, `${this.htmlOptions.maxImageWidthRatio}`);
        vars.set(
            ContentLayoutCssVariableNames.ImagePlaceholderColor,
            `color-mix(in srgb, var(${Theme.ContentTextColor}) 8%, var(${Theme.ContentBackground}))`
        );

        return vars;
    }

    protected prepareDocStyles(doc: Document): string {
        const contentContainer = getDocumentBody(doc);
        const lastElementChild = contentContainer.lastElementChild;
        if (lastElementChild) {
            lastElementChild.classList.add(HtmlSettings.WithoutMarginBottomCssName);
        }
        return DOCUMENT_LAYOUT_CSS;
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

        const shouldFreezePageStrip =
            (directionChanged || writingModeChanged)
            && getLayoutGeometry(this.htmlOptions).flipMode == "page";
        if (shouldFreezePageStrip) {
            this.capturePageReloadLocation();
            freezePageStripForRouteChange(this.renererviewport.getRendererContainer());
        }
        try {
            this.renererviewport.applyCssVariables();
            const loadedDocuments = this.documentsProvider.getLoadedDocuments();
            for (const doc of loadedDocuments) {
                await this.applyDocStyles(doc);
            }
            this.owner.events.emit(EventNames.LayoutChange, payload);
            if (this.pageReloadLocation) {
                const location = this.pageReloadLocation;
                this.pageReloadLocation = undefined;
                await this.documentsProvider.load(location, true);
                return;
            }
            await this.documentsProvider.reload();
        } finally {
            if (shouldFreezePageStrip) {
                const rendererContainer = this.renererviewport.getRendererContainer();
                await waitForPageStripPaint();
                unfreezePageStripForRouteChange(rendererContainer);
            }
        }
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
