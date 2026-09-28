import { isNullOrWhiteSpace } from "../../../kernal/common/text";
import { Nav, SpineFile, FileLocation, NavPoint, IFileDecrypter, Context, ILocale, IEventEmitter, FileLoadOptions } from "../../../kernal";
import { IPdfFileParser, PdfFileParserOptions } from "./IPdfFileParser";
import * as pdfjsLib from '../../../pdfjs/legacy/build/pdf.mjs';
import { loadPdfDocument, type PdfDocumentSource } from "../loadPdfDocument";
import { ITextDocument } from "../../../kernal/ITextDocument";
import { PdfTextDocument } from "./PdfTextDocument";
import { BaseFileParser } from "../../base/fileParser/BaseFileParser";
import { IHttpClient } from "../../../kernal/network/IHttpClient";
import { FileUrlParserOptions, IFileUrlParser, UrlParseResult } from "../../../kernal/services/fileUrlParser/IFileUrlParser";
import { IFileProvider } from "../../../kernal/services/file/IFileProvider";
import { PdfPasswordProvider } from "./PdfPasswordProvider";
import { BlobByteSource } from "../../../kernal/io/BlobByteSource";
import { materialize, type IByteSource } from "../../../kernal/io/IByteSource";
import { MemoryByteSource } from "../../../kernal/io/MemoryByteSource";

export class PdfFileParser extends BaseFileParser implements IPdfFileParser {
    private readonly passwordProvider: PdfPasswordProvider;
    /** Single-file source shared by every page. Absent when the bytes were passed in whole. */
    private sharedSource: IByteSource | undefined;
    private readonly ownedSources: IByteSource[] = [];

    constructor(
        fileDecrypter: IFileDecrypter,
        fileProvider: IFileProvider,
        fileUrlParser: IFileUrlParser,
        httpClient: IHttpClient,
        public readonly events: IEventEmitter,
        public readonly locale: ILocale,
        public readonly context: Context,
        public readonly url: any,
        public readonly extension: string,
        public readonly options: PdfFileParserOptions,
    ) {
        super(fileDecrypter, fileProvider, fileUrlParser, httpClient, url, extension);
        this.passwordProvider = new PdfPasswordProvider(events, locale, context);
        this.bindDefaultPasswordFlow();
    }

    /**
     * When showPasswordPrompt is on and no custom passwordPrompt is set,
     * emit EventNames.RequirePdfPassword for the host UI to handle.
     */
    private bindDefaultPasswordFlow() {
        if (!this.options.standardPasswordProvider) {
            this.options.standardPasswordProvider = this.passwordProvider.getPassword;
        }
    }

    override async buildLocation(target: NavPoint | string, docUrl?: string): Promise<FileLocation> {
        const navPoint = typeof target === "string" ? new NavPoint('', target) : target;
        const location = await super.buildLocation(target, docUrl);
        if ((navPoint.startPageNumber ?? 0) > 0) {
            location.current = navPoint.startPageNumber
            location.unit = 'page'
        }
        if (!isNullOrWhiteSpace(navPoint.pdfDest)) {
            location.pdfDest = navPoint.pdfDest;
        }
        return location;
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
            const textDocument = new PdfTextDocument(this, file);
            this.textDocuments.push(textDocument)
        }
        return this.textDocuments;
    }

    /**
     * Keep an in-memory buffer on `result.data`. A ranged source is stored for later page loads.
     */
    private async captureInitialSource(result: UrlParseResult): Promise<void> {
        if (result.data && result.data.byteLength > 0) {
            const source = result.byteSource;
            result.byteSource = undefined;
            await source?.close();
            return;
        }
        if (!result.byteSource) {
            return;
        }
        if (result.byteSource instanceof MemoryByteSource) {
            result.data = await materialize(result.byteSource);
            const source = result.byteSource;
            result.byteSource = undefined;
            await source.close();
            return;
        }
        this.sharedSource = result.byteSource;
        this.ownedSources.push(result.byteSource);
        result.byteSource = undefined;
    }

    private trackSource(source: IByteSource): IByteSource {
        this.ownedSources.push(source);
        return source;
    }

    private async resolveSpineInput(spineFile: SpineFile): Promise<PdfDocumentSource> {
        if (spineFile.data instanceof ArrayBuffer && spineFile.data.byteLength > 0) {
            return new Uint8Array(spineFile.data);
        }
        if (spineFile.data instanceof Blob && spineFile.data.size > 0) {
            return this.trackSource(new BlobByteSource(spineFile.data));
        }
        if (this.sharedSource) {
            return this.sharedSource;
        }
        if (!spineFile.url) {
            return new Uint8Array(0);
        }
        const parsed = await this.fileUrlParser.parse(spineFile.url, { requireDownload: false });
        if (parsed.data && parsed.data.byteLength > 0) {
            const source = parsed.byteSource;
            parsed.byteSource = undefined;
            await source?.close();
            return new Uint8Array(parsed.data);
        }
        if (parsed.byteSource instanceof MemoryByteSource) {
            const data = new Uint8Array(await materialize(parsed.byteSource));
            await parsed.byteSource.close();
            return data;
        }
        if (parsed.byteSource) {
            return this.trackSource(parsed.byteSource);
        }
        return new Uint8Array(0);
    }

    protected pdfDocs = new Map<string, pdfjsLib.PDFDocumentProxy>();
    async getPdfDocument(spineFile: SpineFile): Promise<pdfjsLib.PDFDocumentProxy> {
        let doc = this.pdfDocs.get(spineFile.url)
        if (doc && !doc.loadingTask.destroyed) {
            return doc;
        }
        doc = await this.internalGetPdfDocumentProxy(spineFile)
        this.pdfDocs.set(spineFile.url, doc)
        return doc;
    }

    async internalGetPdfDocumentProxy(spineFile: SpineFile): Promise<pdfjsLib.PDFDocumentProxy> {
        let password: string;
        if (this.options.standardPasswordProvider) {
            password = await this.options.standardPasswordProvider(this, spineFile);
        }
        const data = await this.resolveSpineInput(spineFile)
        const doc = await loadPdfDocument(data, {
            password: password,
            cMapUrl: this.options.cMapUrl,
            standardFontDataUrl: this.options.standardFontDataUrl,
            wasmUrl: this.options.wasmUrl,
            showPasswordPrompt: this.options.showPasswordPrompt,
            passwordPrompt: this.passwordProvider.onPasswordPrompt,
            internalUrlBuilder: this.options.internalUrlBuilder,
            documentInitParametersCallback: this.options.documentInitParametersCallback,
        })
        return doc;
    }

    override async load(options?: FileLoadOptions): Promise<void> {
        const result = await this.parseUrl(this.url, { requireDownload: false });
        await this.initializeDatas(result);
        if (options?.measureFilePercentage) {
            await this.measureFilePercentage(result.spineFiles ?? [], result.requireCalculateFileSymbolCount)
        }
    }

    protected override async parseUrl(url: any, options: FileUrlParserOptions): Promise<UrlParseResult> {
        const result = await super.parseUrl(url, options);
        if (!result.spineFiles) {
            result.spineFiles = [];
        }
        if (!result.isMultiFiles) {
            await this.captureInitialSource(result);
            const rootSpineFile = new SpineFile(result.data, result.mainUrl, this.extension);
            const doc = await this.internalGetPdfDocumentProxy(rootSpineFile)
            result.data = undefined;
            rootSpineFile.data = undefined;
            // Add to cache
            for (let i = 0; i < doc.numPages; i++) {
                const spineFileUrl = `${i + 1}.pdf`; // Page numbers start from 1
                const spineFile = new SpineFile(null, spineFileUrl, this.extension);
                result.spineFiles.push(spineFile);
                this.pdfDocs.set(spineFileUrl, doc);
            }
            const nav = await this.initNav(doc);
            result.nav = nav;
        }
        return result;
    }

    protected override async measureFilePercentage(spineFiles: SpineFile[], requireCalculateFileSymbolCount: boolean): Promise<void> {
        if (!spineFiles) {
            return;
        }
        const symbolCountIsUndefined = spineFiles.find(x => x.symbolCount == undefined);
        if (!symbolCountIsUndefined) {
            if (spineFiles[0]?.ratio != null) {
                this.applyProgressRanges(spineFiles);
            }
            return;
        }
        // Calculate total progress
        let totalSymbolCount = 0;
        spineFiles.forEach((spineFile) => {
            if (spineFile.symbolCount == undefined || spineFile.symbolCount <= 0) {
                // If symbol count is less than or equal to 0, count as 1 (one file = one symbol)
                spineFile.symbolCount = 1;
            }

            totalSymbolCount += spineFile.symbolCount;
        });

        if (totalSymbolCount <= 0)
            totalSymbolCount = 1;

        spineFiles.forEach((spineFile) => {
            // Do not recalculate ratio when it already has a value, as it may be specified by the server
            // Note: do not use ! when checking numbers
            if (spineFile.ratio == null)
                spineFile.ratio = spineFile.symbolCount / totalSymbolCount;
        });
        this.applyProgressRanges(spineFiles);
    }

    override async getNav(): Promise<Nav> {
        const nav = await super.getNav();
        if (nav) {
            return nav;
        }
        return null;
    }

    override async dispose(): Promise<void> {
        await super.dispose();
        for (const [key, value] of this.pdfDocs.entries()) {
            try {
                await value.cleanup();
                if (value.loadingTask) {
                    await value.loadingTask.destroy();
                }
                await value.destroy();
            } catch (e) {
                //
            }
        }
        this.pdfDocs.clear();
        this.sharedSource = undefined;
        const sources = this.ownedSources.splice(0);
        for (const source of sources) {
            try {
                await source.close();
            } catch (e) {
                //
            }
        }
        if (this.textDocuments) {
            for (const textDocument of this.textDocuments) {
                await textDocument.dispose();
            }
            this.textDocuments.splice(0)
        }
    }

    private async initNav(pdfDocument: pdfjsLib.PDFDocumentProxy): Promise<Nav> {
        const nav = new Nav();
        if (!pdfDocument) {
            return nav;
        }

        const outline = await pdfDocument.getOutline();
        if (outline == null || outline.length == 0)
            return nav;
        for (let i = 0; i < outline.length; i++) {
            const o = outline[i];
            const pageNumber = await this.getPageNumber(pdfDocument, o.dest);
            let pdfDest = await this.formatPdfDest(pdfDocument, o.dest);;
            const navPoint = await this.getNavPoint(pdfDocument, o.title, pageNumber, pdfDest, o.items);
            nav.navPoints.push(navPoint);
        }
        return nav;
    }


    private async getNavPoint(pdfDocument: pdfjsLib.PDFDocumentProxy, title: string, pageNumber: number, pdfDest: string, items: any[]) {

        // eslint-disable-next-line no-control-regex
        title = title?.trim().replace(/[\x00-\x1f]/gi, "");;
        let url = pageNumber.toString() + '.pdf';
        let startPageNumber = pageNumber;
        const navPoint = new NavPoint(title, url, startPageNumber, pdfDest);
        if (items != null && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const pageNumber = await this.getPageNumber(pdfDocument, items[i].dest);
                let pdfDest = await this.formatPdfDest(pdfDocument, items[i].dest);
                const childNavPoint = await this.getNavPoint(pdfDocument, items[i].title, pageNumber, pdfDest, items[i].items)
                navPoint.children.push(childNavPoint);
            }
        }
        return navPoint;
    }

    private async formatPdfDest(pdfDocument: pdfjsLib.PDFDocumentProxy, dest: string | any[]) {
        let explicitDest: any;
        if (typeof dest === "string") {
            explicitDest = await pdfDocument.getDestination(dest);
        } else {
            explicitDest = dest;
        }
        return JSON.stringify(explicitDest)
    }

    private async getPageNumber(pdf: any, dest: any) {
        let explicitDest: any, pageNumber = 0;
        try {
            if (typeof dest === "string") {
                explicitDest = await pdf.getDestination(dest);
            } else {
                explicitDest = dest;
            }
            if (Array.isArray(explicitDest)) {
                const [destRef] = explicitDest;
                if (typeof destRef === "object" && destRef !== null) {
                    pageNumber = (await pdf.getPageIndex(destRef)) + 1;
                } else if (Number.isInteger(destRef)) {
                    pageNumber = destRef + 1;
                }
            }
        } catch (err) {
            // this.logger.error(err);
        }
        return pageNumber;
    }
}