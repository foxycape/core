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
    iccUrl?: string;
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

const readModuleUrl = (): string => {
    const moduleUrl = import.meta.url
    return typeof moduleUrl === 'string' ? moduleUrl : ''
}

const resolvePdfAssetUrl = async (
    explicit: string | undefined,
    relativeToModule: string,
    devPathMarker: string,
    publicDir: string,
    options?: LoadPdfDocumentOptions,
): Promise<string> => {
    let url = explicit ?? ''
    if (!url) {
        const moduleUrl = readModuleUrl()
        if (moduleUrl) {
            try {
                url = new URL(relativeToModule, moduleUrl).href
            } catch {
                url = ''
            }
        }
        //note: here cannot add /
        if (!url || url.indexOf(devPathMarker) < 0) {
            url = options?.internalUrlBuilder
                ? await options.internalUrlBuilder.getAbsoluteUrl(publicDir, true)
                : getCurrentBaseUrl() + '/' + publicDir
        }
    }
    if (url && !url.endsWith('/')) {
        url += '/'
    }
    return url
}

export async function loadPdfDocument(
    data: PdfDocumentSource,
    options?: LoadPdfDocumentOptions,
) {
    const { createPdfDocumentWorker, terminatePdfDocumentWorker } = await import('./ensurePdfWebWorker');
    const pdfWorker = await createPdfDocumentWorker();

    const cmapUrl = await resolvePdfAssetUrl(options?.cMapUrl, '../../pdfjs/cmaps/', '/core/pdfjs/cmaps', 'pdfjs/cmaps/', options)
    const standardFontDataUrl = await resolvePdfAssetUrl(options?.standardFontDataUrl, '../../pdfjs/standard_fonts/', '/core/pdfjs/standard_fonts', 'pdfjs/standard_fonts/', options)
    const wasmUrl = await resolvePdfAssetUrl(options?.wasmUrl, '../../pdfjs/wasm/', '/core/pdfjs/wasm', 'pdfjs/wasm/', options)
    const iccUrl = await resolvePdfAssetUrl(options?.iccUrl, '../../pdfjs/iccs/', '/core/pdfjs/iccs', 'pdfjs/iccs/', options)
    const documentInitParameters: DocumentInitParameters = {
        cMapUrl: cmapUrl,
        standardFontDataUrl: standardFontDataUrl,
        wasmUrl: wasmUrl,
        iccUrl: iccUrl,
        cMapPacked: true,
        useSystemFonts: true,
        password: options?.password,
        worker: pdfWorker,
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
    documentInitParameters.worker = pdfWorker
    // Re-apply after the callback. pdf.js ignores `range` when `data` is set.
    if (rangeTransport) {
        documentInitParameters.range = rangeTransport
        documentInitParameters.disableStream = true
        documentInitParameters.disableAutoFetch = true
        documentInitParameters.data = undefined
    }
    let loadingTask: PDFDocumentLoadingTask
    try {
        loadingTask = pdfjsLib.getDocument(documentInitParameters)
    } catch (error) {
        terminatePdfDocumentWorker(pdfWorker)
        throw error
    }
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
        try {
            return await loadingTask.promise
        } catch (error) {
            await destroyLoadingTask(loadingTask)
            throw error
        }
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
    const { destroyPdfLoadingTask } = await import('./ensurePdfWebWorker')
    await destroyPdfLoadingTask(task)
}
