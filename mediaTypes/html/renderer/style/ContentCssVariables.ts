
/**
 * HTML content css variables
 */
export class ContentCssVariables {
    static readonly FontSize = "--font-size";
    static readonly FontFamily = "--font-family";
    /** System / emoji stack used after `--font-family` for missing glyphs */
    static readonly FallbackFontFamily = `-apple-system,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans","Liberation Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"`;
    static readonly FontWeight = "--font-weight";
    static readonly TextLineHeight = "--text-line-height";
    static readonly ParagraphMarginTop = "--paragraph-margin-top";
    static readonly ParagraphMarginBottom = "--paragraph-margin-bottom";
    static readonly HeadMarginTop = "--head-margin-top";
    static readonly HeadMarginBottom = "--head-margin-bottom";
    static readonly HeadLineHeight = "--head-line-height";
    static readonly TextIndent = "--text-indent";
    static readonly TextAlign = "--text-align";

    private static defaultValues: Map<string, string>;

    static isUserSpecifiedFontFamily(value: string): boolean {
        const family = value.trim();
        if (!family || family === "inherit" || family === "default") {
            return false;
        }
        return family !== ContentCssVariables.FallbackFontFamily;
    }

    static initializeDefaultVariables(
        overrides?: Map<string, string> | Record<string, string>,
    ): Map<string, string> {
        const defaults = this.ensureBuiltinDefaults();
        if (overrides) {
            const entries = overrides instanceof Map ? overrides.entries() : Object.entries(overrides);
            for (const [key, value] of entries) {
                defaults.set(key, value);
            }
        }
        return defaults;
    }

    static getDefaultVariables(): Map<string, string> {
        return this.initializeDefaultVariables();
    }

    private static ensureBuiltinDefaults(): Map<string, string> {
        if (!this.defaultValues) {
            this.defaultValues = new Map<string, string>();
            this.defaultValues.set(ContentCssVariables.FontSize, "20px")
            this.defaultValues.set(ContentCssVariables.FontFamily, ContentCssVariables.FallbackFontFamily)
            this.defaultValues.set(ContentCssVariables.FontWeight, "normal")
            this.defaultValues.set(ContentCssVariables.ParagraphMarginTop, "0.5em")
            this.defaultValues.set(ContentCssVariables.ParagraphMarginBottom, "0.5em")
            this.defaultValues.set(ContentCssVariables.TextLineHeight, "1.65em")
            this.defaultValues.set(ContentCssVariables.HeadMarginTop, "0.5em")
            this.defaultValues.set(ContentCssVariables.HeadMarginBottom, "0.5em")
            this.defaultValues.set(ContentCssVariables.HeadLineHeight, "1.5em")
            this.defaultValues.set(ContentCssVariables.TextIndent, "2em")
            this.defaultValues.set(ContentCssVariables.TextAlign, "start")
        }
        return this.defaultValues;
    }
}
