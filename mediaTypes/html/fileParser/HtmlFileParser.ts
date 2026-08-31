import { ITextDocument } from "../../../kernal/ITextDocument";
import { SpineFile, SymbolType, IFileDecrypter } from "../../../kernal";
import { getDocumentBody } from "../../../kernal/html/finder";
import { HtmlTextDocument } from "./HtmlTextDocument";
import { BaseFileParser } from "../../base/fileParser/BaseFileParser";
import { FileUrlParserOptions, IFileUrlParser, UrlParseResult } from "../../../kernal/services/fileUrlParser/IFileUrlParser";
import { IFileProvider } from "../../../kernal/services/file/IFileProvider";
import { ICrypto } from "../../../kernal/crypto/ICrypto";
import { IHttpClient } from "../../../kernal/network/IHttpClient";
import { IHtmlTextDocument } from "../renderer/IHtmlTextDocument";
import type { IHtmlContentNormalizer } from "../IHtmlContentNormalizer";
import type { IHtmlSymbolMeasure } from "../IHtmlSymbolMeasure";
import { HtmlFileParserOptions, IHtmlFileParser } from "./IHtmlFileParser";
import { NoopHtmlContentNormalizer } from "../NoopHtmlContentNormalizer";
import { DefaultHtmlSymbolMeasure } from "../DefaultHtmlSymbolMeasure";

export class HtmlFileParser extends BaseFileParser implements IHtmlFileParser {
    private data: ArrayBuffer;
    readonly contentNormalizer: IHtmlContentNormalizer;
    readonly symbolMeasure: IHtmlSymbolMeasure;
    constructor(
        crypto: ICrypto,
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
        super(crypto, fileDecrypter, fileProvider, fileUrlParser, httpClient, url, extension)
        this.contentNormalizer = contentNormalizer ?? new NoopHtmlContentNormalizer();
        this.symbolMeasure = symbolMeasure ?? new DefaultHtmlSymbolMeasure();
    }

    protected override async parseUrl(url: any, options: FileUrlParserOptions): Promise<UrlParseResult> {
        const result = await super.parseUrl(url, options);
        if (!result.isMultiFiles) {
            result.spineFiles = [new SpineFile(result.data, result.mainUrl, this.extension)];
        }
        return result;
    }

    protected override async initializeDatas(result: UrlParseResult): Promise<void> {
        this.data = result.data;
        await super.initializeDatas(result);
    }

    override async getCover(width: number, height: number): Promise<Blob> {
        return null;
    }

    async getFileHash(algorithm?: 'MD5' | 'SHA-1'): Promise<string> {
        return await this.computeFileHash(this.isMultiFiles, this.data, algorithm);
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
        this.data = null
        await super.dispose();
    }
}
