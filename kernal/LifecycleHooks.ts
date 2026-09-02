import { IRenderer } from "./IRenderer";
import { Options } from "./Options";
import { IFileParser } from "./IFileParser";
import { IDocumentsProvider } from "./IDocumentsProvider";
import { FileLocation } from "./progress/Progress";

/**
 * Reader / FileLoader lifecycle and extension hooks.
 */
export type LifecycleHooks = {
    onInitialize?: (extension: string) => Promise<void>;
    onDisposing?: () => Promise<void>;
    onDisposed?: () => Promise<void>;
    onOptionsParse?: (options: Options) => Promise<void>;
    onContainerCreated?: () => Promise<void>;
    onFileParsed?: (fileParser: IFileParser) => Promise<void>;
    onRenderer?: (renderer: IRenderer) => Promise<void>;
    onRenderered?: (renderer: IRenderer) => Promise<void>;
    /** progress change guard (return false to interrupt subsequent broadcast/storage) */
    onProgressChangeGuard?: (progress: number) => boolean;
    /** redirect before (can be used to save current progress) */
    onBeforeRedirect?: (documentsProvider: IDocumentsProvider) => Promise<void>;

    /**if no valid location is provided, request a location for the file */
    onLocationRequest?: (simpleId: string) => Promise<FileLocation | undefined>;
};
