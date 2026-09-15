import { toCssVariableName } from "./common/naming";

/**
 * reader core configuration
 */
export class Options {

    /** specify version */
    version: string;

    /** specify base address */
    baseUrl: string;

    /** specify the hash value to prevent caching */
    preventCacheHash: string;

    /** whether to open debug mode, after opening, the log information will be output */
    debug: boolean = true;

    /** offset when redirecting objects on the page */
    redirectPositionOffset: number = 5;

    /** whether to use zen mode */
    zenMode?: boolean;

    /** theme name */
    themeName: string = "default";

    /** wallpaper name */
    wallpaperName: string = "default";

    /** whether to calculate the scroll direction */
    calcScrollDirection: boolean = true;

    /** whether to inject reset CSS */
    enableInjectResetCss: boolean = false;

    /** file extensions that must be opened in iframe */
    iframeRequiredExtensions = [];

    /** scrollbar width */
    scrollbarSize: string = "10px";
    /** scrollbar radius */
    scrollbarRadius: string = "4px";
    /** scrollbar border */
    scrollbarBorder: string = "1px";

    static readonly ScrollbarSize = toCssVariableName("scrollbarSize" satisfies OptionsCssKey);
    static readonly ScrollbarRadius = toCssVariableName("scrollbarRadius" satisfies OptionsCssKey);
    static readonly ScrollbarBorder = toCssVariableName("scrollbarBorder" satisfies OptionsCssKey);
}

/**
 * The properties that will be injected as CSS variables in Options.
 * Naming rule: camelCase → --kebab-case (e.g.: scrollbarSize → --scrollbar-size)
 */
export const OptionsCssKeys = [
    "scrollbarSize",
    "scrollbarRadius",
    "scrollbarBorder",
] as const satisfies readonly (keyof Options)[];

export type OptionsCssKey = typeof OptionsCssKeys[number];

export const isOptionsCssKey = (path: string): path is OptionsCssKey =>
    (OptionsCssKeys as readonly string[]).includes(path);

/** common property names in Options, for comparing with OptionsChange etc. */
export const OptionKeys = [
    "zenMode",
    "scrollbarSize",
    "scrollbarRadius",
    "scrollbarBorder",
] as const satisfies readonly (keyof Options)[];

export type OptionKey = typeof OptionKeys[number];

export const isOptionKey = (path: string): path is OptionKey =>
    (OptionKeys as readonly string[]).includes(path);
