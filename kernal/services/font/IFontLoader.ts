import { IDisposable } from "../../IDisposable";
import type { Font } from "./IFontProvider";

/** Notified when the font catalog changes. The callback does not describe which usage scenario is active. */
export type FontCatalogListener = () => void;

/**
 * Font catalog.
 * Lists, imports, and removes fonts. It does not know which font a document is using.
 */
export interface IFontLoader extends IDisposable {
    /**
     * Load the default font and previously imported fonts.
     */
    initialize(): Promise<void>;

    /**
     * Clear the catalog and initialize it again.
     */
    reload(): Promise<void>;

    /** Whether this environment can enumerate installed fonts. */
    get supportLocalFonts(): boolean;

    /** Whether installed fonts have been added to the catalog. */
    get hasLoadedLocalFonts(): boolean;

    /**
     * Add installed fonts to the catalog.
     * @param showMessageWhenFail Show a message when enumeration fails or is denied.
     */
    loadLocalFonts(showMessageWhenFail: boolean): Promise<boolean>;

    /**
     * Remove installed fonts from the catalog.
     * Does not change the font selected by any usage scenario.
     */
    removeLocalFonts(): Promise<void>;

    /**
     * Fonts available for the current operating system.
     * @param language Optional language filter.
     */
    getFonts(language?: string): Promise<Font[]>;

    /**
     * Resolve a font by its name or family.
     * Returns the default font when nothing matches.
     */
    getFont(name: string): Promise<Font>;

    /**
     * Add a font to the catalog.
     */
    addFont(font: Font): void;

    /**
     * Add fonts to the catalog.
     */
    addFonts(fonts: Font[]): void;

    /**
     * Remove a font from the catalog.
     */
    removeFont(font: Font | string): void;

    /**
     * Remove fonts from the catalog.
     */
    removeFonts(fonts: Font[]): void;

    /**
     * Copy .ttf and .otf files into the catalog.
     */
    importFontFiles(files: File[]): Promise<{ imported: number; skipped: number }>;

    /**
     * Delete an imported font file and remove it from the catalog.
     * Does not change the font selected by any usage scenario.
     */
    deleteImportedFont(name: string): Promise<void>;

    /**
     * Remove every font from the catalog.
     */
    clear(): void;

    /**
     * Register a callback for catalog changes.
     */
    addChangeListener(listener: FontCatalogListener): void;

    /**
     * Remove a catalog-change callback.
     */
    removeChangeListener(listener: FontCatalogListener): void;
}
