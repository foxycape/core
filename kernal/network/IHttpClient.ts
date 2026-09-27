export interface IHttpClient {

    /**
     * GET request
     * @param url 
     * @param options 
     */
    get(url: string, options?: HttpClientOptions): Promise<any>;

    /**
     * POST request
     * @param url Request URL
     * @param data Request body. Supported forms:
     * - `FormData`: sent as multipart/form-data
     * - URL-encoded string: e.g. `key1=encodeURIComponent(value1)&key2=encodeURIComponent(value2)`, converted to FormData
     * - Plain object: converted to FormData by default; when `options.requestBodyType` is `'raw'`, sent as JSON (`application/json`)
     * @param options Request options
     * @returns Response body according to `options.responseType`
     */
    post(url: string, data: any | FormData, options?: HttpClientOptions): Promise<any>

    /**
     * Get config
     * @param urls 
     * @param defaultValue 
     * @param responseType 
     */
    getConfig<T>(urls: string[], defaultValue: T, responseType?: ResponseType): Promise<T>;

    /**
     * GET a half-open byte range `[start, end)`.
     * Sends `Range: bytes=start-(end-1)`. Status 206 sets `partial`.
     * Status 200 means the server ignored Range and `data` is the whole body.
     */
    getRange(url: string, range: HttpByteRange, options?: HttpClientOptions): Promise<HttpRangeResult>;
}

/** Half-open byte range. `end` is exclusive. */
export type HttpByteRange = {
    start: number
    end: number
}

export type HttpRangeResult = {
    data: Uint8Array
    status: number
    /** Set when the response is 206 and Content-Range includes a total length. */
    totalSize?: number
    partial: boolean
}

export class HttpClientOptions {
    url?: string;
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
    requestBodyType?: RequestBodyType;
    responseType?: ResponseType;
    timeout?: number;
    timeoutErrorMessage?: string;
    withCredentials?: boolean;
    maxContentLength?: number;
    /** AbortController */
    abortController?: AbortController;
    /** Size of the file to download */
    contentLength?: number;
    /** Download progress callback */
    downloadProgressCallback?: (contentLength: number, receivedLength: number, done: boolean) => void
    /** Upload progress callback (not supported in fetch mode) */
    uploadProgressCallback?: (contentLength: number, uploadLength: number, done: boolean) => void

    /** Whether a CORS proxy is required for cross-origin requests */
    requireCORSProxy?:boolean
}

export type ResponseType = 'arraybuffer' | 'blob' | 'json' | 'text' | 'stream'
export type RequestBodyType = 'form-data' | 'x-www-form-urlencoded' | 'raw'
