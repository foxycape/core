import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url'
import { getCurrentBaseUrl } from '../../kernal/common/url';
import { IInternalUrlBuilder } from '../../kernal';
import { ensurePdfWebWorker } from './ensurePdfWebWorker';

export class PdfJsAssistant {
    static readonly CMAP_PACKED: boolean = true;

    static async getPdfDocument(data: string | Uint8Array | ArrayBuffer | Blob, options?: { password?: string, cMapUrl?: string, standardFontDataUrl?: string, showPasswordPrompt?: boolean, passwordPrompt?: (callback: (password: string) => void, reason: any) => void, documentInitParametersCallback?: (documentInitParameters: DocumentInitParameters) => void, internalUrlBuilder?: IInternalUrlBuilder }) {
        // Real Web Worker (background thread). Uses Vite ?url when usable;
        // otherwise Blob URL from inlined worker source (Obsidian-safe).
        ensurePdfWebWorker(workerSrc);

        let cmapUrl = options?.cMapUrl
        if (!cmapUrl) {
            /* @vite-ignore */
            cmapUrl = new URL('../../pdfjs-dist/cmaps/', import.meta.url).href
            //note: here cannot add /
            if (cmapUrl.indexOf('/core/pdfjs-dist/cmaps') < 0) {
                cmapUrl = options?.internalUrlBuilder ? await options.internalUrlBuilder.getAbsoluteUrl("pdfjs-dist/cmaps/", true) : getCurrentBaseUrl() + "/pdfjs-dist/cmaps/";
            }
        }
        if (cmapUrl && !cmapUrl.endsWith("/")) {
            cmapUrl += "/"
        }
        let standardFontDataUrl = options?.standardFontDataUrl
        if (!standardFontDataUrl) {
            /* @vite-ignore */
            standardFontDataUrl = new URL('../../pdfjs-dist/standard_fonts/', import.meta.url).href
            //note: here cannot add /
            if (standardFontDataUrl.indexOf('/core/pdfjs-dist/standard_fonts') < 0) {
                standardFontDataUrl = options?.internalUrlBuilder ? await options.internalUrlBuilder.getAbsoluteUrl("pdfjs-dist/standard_fonts/", true) : getCurrentBaseUrl() + "/pdfjs-dist/standard_fonts/";
            }
        }
        if (standardFontDataUrl && !standardFontDataUrl.endsWith("/")) {
            standardFontDataUrl += "/"
        }
        const documentInitParameters: DocumentInitParameters = {
            cMapUrl: cmapUrl,
            standardFontDataUrl: standardFontDataUrl,
            cMapPacked: this.CMAP_PACKED,
            useWorkerFetch: true,
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
        if (!loadingTask._worker && documentInitParameters.worker) {
            loadingTask._worker = documentInitParameters.worker
        }
        if (options?.showPasswordPrompt) {
            loadingTask.onPassword = options?.passwordPrompt
        }
        return await loadingTask.promise
    }
}
