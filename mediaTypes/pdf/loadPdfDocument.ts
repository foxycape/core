import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs';
import type { DocumentInitParameters } from '../../pdfjs/types/src/display/api';
import { getCurrentBaseUrl } from '../../kernal/common/url';
import type { IInternalUrlBuilder } from '../../kernal';

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

export async function loadPdfDocument(
    data: string | Uint8Array | ArrayBuffer | Blob,
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
    if (typeof data === "string") {
        documentInitParameters.url = data;
    }
    else if (data instanceof Blob) {
        documentInitParameters.data = await data.arrayBuffer();
    }
    else {
        documentInitParameters.data = data;
    }
    if (options?.documentInitParametersCallback) {
        options.documentInitParametersCallback(documentInitParameters);
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
    return await loadingTask.promise
}
