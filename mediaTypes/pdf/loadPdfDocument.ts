import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs';
import type { DocumentInitParameters, PDFDocumentLoadingTask } from '../../pdfjs/types/src/display/api';
import { getCurrentBaseUrl } from '../../kernal/common/url';
import type { IInternalUrlBuilder } from '../../kernal';
import type { IByteSource } from '../../kernal/io/IByteSource';
import { ByteSourceRangeTransport } from './ByteSourceRangeTransport';

export type LoadPdfDocumentOptions = {
    password?: string;
    cMapUrl?: string;
    standardFontDataUrl?: string;
    wasmUrl?: string;
    showPasswordPrompt?: boolean;
    passwordPrompt?: (callback: (password: string) => void, reason: any) => void;
    documentInitParametersCallback?: (documentInitParameters: DocumentInitParameters) => void;
    internalUrlBuilder?: IInternalUrlBuilder;
};

export type PdfDocumentSource = string | Uint8Array | ArrayBuffer | Blob | IByteSource;

const isByteSource = (value: PdfDocumentSource): value is IByteSource => {
    return typeof value === 'object'
        && value !== null
        && !(value instanceof Uint8Array)
        && !(value instanceof ArrayBuffer)
        && !(value instanceof Blob)
        && typeof (value as IByteSource).size === 'number'
        && typeof (value as IByteSource).read === 'function'
        && typeof (value as IByteSource).close === 'function';
};

export async function loadPdfDocument(
    data: PdfDocumentSource,
    options?: LoadPdfDocumentOptions,
) {
    const ensurePdfWebWorker = await import('./ensurePdfWebWorker').then(m => m.ensurePdfWebWorker);
    await ensurePdfWebWorker();

    let cmapUrl = options?.cMapUrl
    if (!cmapUrl) {
        /* @vite-ignore */
        cmapUrl = new URL('../../pdfjs/cmaps/', import.meta.url).href
        //note: here cannot add /
        if (cmapUrl.indexOf('/core/pdfjs/cmaps') < 0) {
            cmapUrl = options?.internalUrlBuilder ? await options.internalUrlBuilder.getAbsoluteUrl("pdfjs/cmaps/", true) : getCurrentBaseUrl() + "/pdfjs/cmaps/";
        }
    }
    if (cmapUrl && !cmapUrl.endsWith("/")) {
        cmapUrl += "/"
    }
    let standardFontDataUrl = options?.standardFontDataUrl
    if (!standardFontDataUrl) {
        /* @vite-ignore */
        standardFontDataUrl = new URL('../../pdfjs/standard_fonts/', import.meta.url).href
        //note: here cannot add /
        if (standardFontDataUrl.indexOf('/core/pdfjs/standard_fonts') < 0) {
            standardFontDataUrl = options?.internalUrlBuilder ? await options.internalUrlBuilder.getAbsoluteUrl("pdfjs/standard_fonts/", true) : getCurrentBaseUrl() + "/pdfjs/standard_fonts/";
        }
    }
    if (standardFontDataUrl && !standardFontDataUrl.endsWith("/")) {
        standardFontDataUrl += "/"
    }
    let wasmUrl = options?.wasmUrl
    if (!wasmUrl) {
        /* @vite-ignore */
        wasmUrl = new URL('../../pdfjs/wasm/', import.meta.url).href
        //note: here cannot add /
        if (wasmUrl.indexOf('/core/pdfjs/wasm') < 0) {
            wasmUrl = options?.internalUrlBuilder ? await options.internalUrlBuilder.getAbsoluteUrl("pdfjs/wasm/", true) : getCurrentBaseUrl() + "/pdfjs/wasm/";
        }
    }
    if (wasmUrl && !wasmUrl.endsWith("/")) {
        wasmUrl += "/"
    }
    const documentInitParameters: DocumentInitParameters = {
        cMapUrl: cmapUrl,
        standardFontDataUrl: standardFontDataUrl,
        wasmUrl: wasmUrl,
        cMapPacked: true,
        useSystemFonts: true,
        password: options?.password,
    }
    let opened = false
    let rejectRange: ((error: unknown) => void) | undefined
    const rangeTransport = isByteSource(data)
        ? new ByteSourceRangeTransport(data, (error) => {
            if (opened) {
                console.error(error)
                return
            }
            rejectRange?.(error)
        })
        : undefined
    if (rangeTransport) {
        documentInitParameters.range = rangeTransport
        documentInitParameters.disableStream = true
        documentInitParameters.disableAutoFetch = true
    }
    else if (typeof data === "string") {
        documentInitParameters.url = data;
    }
    else if (data instanceof Blob) {
        documentInitParameters.data = await data.arrayBuffer();
    }
    else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        documentInitParameters.data = data;
    }
    if (options?.documentInitParametersCallback) {
        options.documentInitParametersCallback(documentInitParameters);
    }
    // Re-apply after the callback. pdf.js ignores `range` when `data` is set.
    if (rangeTransport) {
        documentInitParameters.range = rangeTransport
        documentInitParameters.disableStream = true
        documentInitParameters.disableAutoFetch = true
        documentInitParameters.data = undefined
    }
    const loadingTask = pdfjsLib.getDocument(documentInitParameters)
    // getDocument only stores an internally created worker. A caller-supplied
    // worker stays unset, so destroy() would leak it.
    const taskWithWorker = loadingTask as unknown as {
        _worker: DocumentInitParameters["worker"] | null
    }
    if (!taskWithWorker._worker && documentInitParameters.worker) {
        taskWithWorker._worker = documentInitParameters.worker
    }
    if (options?.showPasswordPrompt) {
        loadingTask.onPassword = options?.passwordPrompt
    }
    if (!rangeTransport) {
        return await loadingTask.promise
    }
    try {
        return await new Promise<Awaited<PDFDocumentLoadingTask['promise']>>((resolve, reject) => {
            rejectRange = reject
            loadingTask.promise.then(
                (doc) => {
                    opened = true
                    resolve(doc)
                },
                reject,
            )
        })
    } catch (error) {
        await destroyLoadingTask(loadingTask)
        throw error
    }
}

const destroyLoadingTask = async (task: PDFDocumentLoadingTask) => {
    try {
        await task.destroy()
    } catch {
        // Already destroyed, or the worker closed while the range read failed.
    }
}
