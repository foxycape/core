import type { FileUrlParserOptions } from "../services/fileUrlParser/IFileUrlParser";
import type { HttpClientOptions, IHttpClient } from "../network/IHttpClient";
import { assertByteRange, type IByteSource } from "./IByteSource";
import { MemoryByteSource } from "./MemoryByteSource";

const RANGE_TIMEOUT_MS = 600000

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
 * Open an HTTP URL as a random-access source.
 * A 206 probe with a total length keeps range reads. Otherwise the file is downloaded once.
 */
export const openHttpByteSource = async (
    httpClient: IHttpClient,
    url: string,
    options?: FileUrlParserOptions,
): Promise<IByteSource> => {
    if (options?.requireCORSProxy) {
        return downloadAll(httpClient, url, options)
    }
    const probe = await httpClient.getRange(url, { start: 0, end: 1 }, {
        headers: authorizationHeaders(options),
        timeout: RANGE_TIMEOUT_MS,
        abortController: options?.abortController,
    })
    if (probe.partial && probe.totalSize != null && probe.totalSize > 0) {
        return new HttpByteSource(httpClient, url, probe.totalSize, options)
    }
    return downloadAll(httpClient, url, options)
}

/** HTTP resource that supports range reads. `size` comes from the Content-Range total. */
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
        }
    }
}
