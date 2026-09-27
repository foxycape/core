import { Metadata } from "../../Metadata";
import { SpineFile } from "../../IFileParser";
import type { IByteSource } from "../../io/IByteSource";
import { Nav } from "../../nav/Nav";
import { OpenOptions } from "../../OpenOptions";

export interface IFileUrlParser {
    parse(url: any, options?: FileUrlParserOptions): Promise<UrlParseResult>
}

/** Parser-facing open options. Inherits fileDownloadingCallback from OpenOptions. */
export class FileUrlParserOptions extends OpenOptions {
}

export class UrlParseResult {
    mainUrl?: string;
    data?: ArrayBuffer
    /** Random-access view of a single file. Absent for multi-file inputs. */
    byteSource?: IByteSource
    metadata?: Metadata
    nav?: Nav
    isMultiFiles:boolean=false;
    spineFiles: SpineFile[] = [];
    requireSignUrl: boolean = false;
    base: string = "";
    requireCalculateFileSymbolCount = false;
}