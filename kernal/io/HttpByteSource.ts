import type { FileUrlParserOptions } from "../services/fileUrlParser/IFileUrlParser";
import type { HttpClientOptions, IHttpClient } from "../network/IHttpClient";
import { assertByteRange, type IByteSource } from "./IByteSource";
import { MemoryByteSource } from "./MemoryByteSource";

const RANGE_TIMEOUT_MS = 600000

const listedFileSize = (options?: FileUrlParserOptions) => {
    const size = options?.fileSize
    return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : undefined
}

const authorizationHeaders = (options?: FileUrlParserOptions): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (options?.authorizationKey && options?.authorizationValue) {
        headers[options.authorizationKey] = options.authorizationValue
    }
    return headers
}

const downloadAll = async (
    httpClient: IHttpClient,
    url: string,
    options?: FileUrlParserOptions,
): Promise<IByteSource> => {
    const data = await httpClient.get(url, {
        responseType: "arraybuffer",
        timeout: RANGE_TIMEOUT_MS,
        contentLength: options?.fileSize,
        headers: authorizationHeaders(options),
        requireCORSProxy: options?.requireCORSProxy,
        downloadProgressCallback: options?.fileDownloadingCallback,
        abortController: options?.abortController,
    })
    return new MemoryByteSource(data as ArrayBuffer)
}

/**
 * Open an HTTP URL as a range source when the server answers the probe with 206.
 * A known file size wins over Content-Range. Servers that ignore Range return undefined.
 */
export const tryOpenHttpRange = async (
    httpClient: IHttpClient,
    url: string,
    options?: FileUrlParserOptions,
): Promise<HttpByteSource | undefined> => {
    const probe = await httpClient.getRange(url, { start: 0, end: 1 }, {
        headers: authorizationHeaders(options),
        timeout: RANGE_TIMEOUT_MS,
        abortController: options?.abortController,
        requireCORSProxy: options?.requireCORSProxy,
        contentLength: listedFileSize(options),
    })
    if (!probe.partial) {
        return undefined
    }
    const probed = probe.totalSize != null && probe.totalSize > 0 ? probe.totalSize : undefined
    const size = listedFileSize(options) ?? probed
    if (size == null) {
        return undefined
    }
    return new HttpByteSource(httpClient, url, size, options)
}

/**
 * Open an HTTP URL as a random-access source.
 * A 206 probe with a total length keeps range reads. Otherwise the file is downloaded once.
 */
export const openHttpByteSource = async (
    httpClient: IHttpClient,
    url: string,
    options?: FileUrlParserOptions,
): Promise<IByteSource> => {
    const ranged = await tryOpenHttpRange(httpClient, url, options)
    if (ranged) {
        return ranged
    }
    return downloadAll(httpClient, url, options)
}

/** HTTP resource that supports range reads. `size` is the known file length, or the Content-Range total when that length is absent. */
export class HttpByteSource implements IByteSource {
    private readonly lifetime = new AbortController()

    constructor(
        private readonly httpClient: IHttpClient,
        private readonly url: string,
        readonly size: number,
        private readonly options?: FileUrlParserOptions,
    ) {
    }

    async read(start: number, end: number): Promise<Uint8Array> {
        assertByteRange(start, end)
        if (start >= this.size) {
            return new Uint8Array(0)
        }
        const clampedEnd = Math.min(end, this.size)
        const result = await this.httpClient.getRange(this.url, { start, end: clampedEnd }, this.rangeOptions())
        if (!result.partial) {
            if (result.data.byteLength === this.size) {
                return result.data.slice(start, clampedEnd)
            }
            throw new Error('HTTP range request was ignored')
        }
        return result.data
    }

    async close(): Promise<void> {
        this.lifetime.abort()
    }

    private rangeOptions(): HttpClientOptions {
        const controller = new AbortController()
        const abort = () => {
            controller.abort()
        }
        if (this.lifetime.signal.aborted || this.options?.abortController?.signal.aborted) {
            controller.abort()
        } else {
            this.lifetime.signal.addEventListener('abort', abort, { once: true })
            this.options?.abortController?.signal.addEventListener('abort', abort, { once: true })
        }
        return {
            headers: authorizationHeaders(this.options),
            timeout: RANGE_TIMEOUT_MS,
            abortController: controller,
            requireCORSProxy: this.options?.requireCORSProxy,
            contentLength: listedFileSize(this.options),
        }
    }
}
