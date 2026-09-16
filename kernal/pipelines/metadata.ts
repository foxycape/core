import { getFileName } from "../common/path";
import { checkIsAbsoluteUrl } from "../common/url";
import { Metadata, unescapeHtml, toMetadataList } from "../Metadata";
import { FilePackage } from "../IFileParser";

const asTrimmedString = (value: unknown): string =>
    typeof value === "string" ? unescapeHtml(value) : "";

/** SAF document IDs and raw file URLs are not display titles. */
export const isUriLikeBookTitle = (title?: string): boolean => {
    const text = typeof title === "string" ? title.trim() : "";
    if (!text) {
        return false;
    }
    if (/^(content|file):\/\//i.test(text)) {
        return true;
    }
    if (/%2F|%3A/i.test(text)) {
        return true;
    }
    if (/^primary[:%]/i.test(text)) {
        return true;
    }
    return false;
};

const asUsableName = (value?: string): string => {
    const text = typeof value === "string" ? value.trim() : "";
    return text && !isUriLikeBookTitle(text) ? text : "";
};

export const formatMetadata = (
    metadata: Metadata,
    url: any,
    extension: string,
    fallbackFileName?: string,
): Metadata => {
    if (!metadata) {
        metadata = new Metadata();
    }
    const usableFallback = asUsableName(fallbackFileName);
    const urlName = typeof url === "string" ? asUsableName(getFileName(url)) : "";
    if (!asUsableName(typeof metadata.title === "string" ? metadata.title : "")) {
        metadata.title = usableFallback || urlName || "";
    }
    if (metadata.fileName && typeof metadata.fileName !== 'string') {
        metadata.fileName = "";
    }
    metadata.author = toMetadataList(metadata.author);
    metadata.contributor = toMetadataList(metadata.contributor);
    metadata.subject = toMetadataList(metadata.subject);
    metadata.subtitle = asTrimmedString(metadata.subtitle) || undefined;
    metadata.description = asTrimmedString(metadata.description);
    metadata.rights = asTrimmedString(metadata.rights);
    metadata.publisher = asTrimmedString(metadata.publisher);
    metadata.issueDate = asTrimmedString(metadata.issueDate);
    metadata.modifiedDate = asTrimmedString(metadata.modifiedDate) || undefined;
    metadata.language = asTrimmedString(metadata.language) || undefined;
    metadata.identifier = asTrimmedString(metadata.identifier) || undefined;
    metadata.isbn = asTrimmedString(metadata.isbn) || undefined;
    metadata.asin = asTrimmedString(metadata.asin) || undefined;
    metadata.source = asTrimmedString(metadata.source) || undefined;
    metadata.series = asTrimmedString(metadata.series) || undefined;
    metadata.seriesIndex = asTrimmedString(metadata.seriesIndex) || undefined;
    if (metadata.size && typeof metadata.size !== 'number') {
        metadata.size = 0;
    }
    metadata.extension = extension;
    try {
        if (!asUsableName(typeof metadata.fileName === "string" ? metadata.fileName : "")) {
            if (usableFallback) {
                metadata.fileName = usableFallback;
            } else if (typeof url === "string") {
                if (checkIsAbsoluteUrl(url)) {
                    metadata.fileName = getFileName(url)
                }
                else {
                    let isSimpleUrl = false;
                    try {
                        JSON.parse(url)
                        isSimpleUrl = false
                    }
                    catch (e) {
                        isSimpleUrl = true;
                    }
                    if (isSimpleUrl) {
                        metadata.fileName = getFileName(url)?.trim()
                    }
                }
            }
            else if (url instanceof FilePackage) {
                if (url.fileName) {
                    metadata.fileName = url.fileName?.trim();
                }
                else if (url.fileUrl && typeof url.fileUrl === "string" && checkIsAbsoluteUrl(url.fileUrl)) {
                    metadata.fileName = getFileName(url.fileUrl)?.trim()
                }
            }
            else if (globalThis.FileSystemFileHandle && url instanceof globalThis.FileSystemFileHandle) {
                metadata.fileName = url.name?.trim()
            }
        }
        if (isUriLikeBookTitle(metadata.fileName)) {
            metadata.fileName = usableFallback;
        }
        if (metadata.fileName?.length > 1000) {
            metadata.fileName = '';
        }
    } catch (e) {
        //
    }
    return metadata;
}