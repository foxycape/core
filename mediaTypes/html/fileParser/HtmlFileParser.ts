import { ITextDocument } from "../../../kernal/ITextDocument";
import { FilePackage, SpineFile, SymbolType, IFileDecrypter } from "../../../kernal";
import { materialize } from "../../../kernal/io/IByteSource";
import { getDocumentBody } from "../../../kernal/html/finder";
import { HtmlTextDocument } from "./HtmlTextDocument";
import { BaseFileParser } from "../../base/fileParser/BaseFileParser";
import { FileUrlParserOptions, IFileUrlParser, UrlParseResult } from "../../../kernal/services/fileUrlParser/IFileUrlParser";
import { IFileProvider } from "../../../kernal/services/file/IFileProvider";
import { IHttpClient } from "../../../kernal/network/IHttpClient";
import { IHtmlTextDocument } from "../renderer/IHtmlTextDocument";
import type { IHtmlContentNormalizer } from "../IHtmlContentNormalizer";
import type { IHtmlSymbolMeasure } from "../IHtmlSymbolMeasure";
import { HtmlFileParserOptions, IHtmlFileParser } from "./IHtmlFileParser";
import { NoopHtmlContentNormalizer } from "../NoopHtmlContentNormalizer";
import { DefaultHtmlSymbolMeasure } from "../DefaultHtmlSymbolMeasure";

export class HtmlFileParser extends BaseFileParser implements IHtmlFileParser {
    readonly contentNormalizer: IHtmlContentNormalizer;
    readonly symbolMeasure: IHtmlSymbolMeasure;
    constructor(
        fileDecrypter: IFileDecrypter,
        fileProvider: IFileProvider,
        fileUrlParser: IFileUrlParser,
        httpClient: IHttpClient,
        url: any,
        extension: string,
        public readonly options: HtmlFileParserOptions,
        contentNormalizer?: IHtmlContentNormalizer,
        symbolMeasure?: IHtmlSymbolMeasure,
    ) {
        super(fileDecrypter, fileProvider, fileUrlParser, httpClient, url, extension)
        this.contentNormalizer = contentNormalizer ?? new NoopHtmlContentNormalizer();
        this.symbolMeasure = symbolMeasure ?? new DefaultHtmlSymbolMeasure();
    }

    protected override async parseUrl(url: any, options: FileUrlParserOptions): Promise<UrlParseResult> {
        const result = await super.parseUrl(url, options);
        if (!result.isMultiFiles) {
            if (!result.data && result.byteSource && isBlobBackedInput(url)) {
                result.data = await materialize(result.byteSource)
            }
            result.spineFiles = [new SpineFile(result.data, result.mainUrl, this.extension)];
        }
        return result;
    }

    override async getCover(width: number, height: number): Promise<Blob> {
        return null;
    }

    private textDocuments: ITextDocument[];
    override async getTextDocuments(): Promise<ITextDocument[]> {
        if (this.textDocuments) {
            return this.textDocuments;
        }
        this.textDocuments = [];
        const spineFiles = await this.getSpineFiles();
        for (let i = 0; i < spineFiles.length; i++) {
            const file = spineFiles[i]
            const textDocument = new HtmlTextDocument(this, file);
            this.textDocuments.push(textDocument)
        }
        return this.textDocuments;
    }

    protected override async calculateSymbolCount(spineFile: SpineFile, symbolType: SymbolType) {
        const textDocument = await this.getTextDocument(spineFile.url) as IHtmlTextDocument;
        if (!textDocument) {
            return 1;
        }
        const formattedDocument = await textDocument.getFormattedDocument();
        return this.symbolMeasure.count(getDocumentBody(formattedDocument), symbolType);
    }

    override async dispose(): Promise<void> {
        if (this.textDocuments) {
            for (const textDocument of this.textDocuments) {
                await textDocument.dispose();
            }
            this.textDocuments.splice(0)
        }
        await super.dispose();
    }
}

const isFileSystemFileHandle = (value: unknown): value is FileSystemFileHandle =>
    typeof globalThis.FileSystemFileHandle === 'function' && value instanceof globalThis.FileSystemFileHandle

/** Local File, Blob, or file handle. String URLs stay unloaded until a later fetch. */
const isBlobBackedInput = (url: unknown): boolean => {
    if (url instanceof Blob || isFileSystemFileHandle(url)) {
        return true
    }
    if (url instanceof FilePackage) {
        return url.fileUrl instanceof Blob || isFileSystemFileHandle(url.fileUrl)
    }
    return false
}
