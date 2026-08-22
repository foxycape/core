import { Metadata } from "../../Metadata";
import { SpineFile } from "../../IFileParser";
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
    metadata?: Metadata
    nav?: Nav
    isMultiFiles:boolean=false;
    spineFiles: SpineFile[] = [];
    requireSignUrl: boolean = false;
    base: string = "";
    requireCalculateFileSymbolCount = false;
}