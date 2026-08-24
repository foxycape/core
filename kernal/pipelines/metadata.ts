import { getFileName } from "../common/path";
import { checkIsAbsoluteUrl } from "../common/url";
import { Metadata, unescapeHtml, toMetadataList } from "../Metadata";
import { FilePackage } from "../IFileParser";

const asTrimmedString = (value: unknown): string =>
    typeof value === "string" ? unescapeHtml(value) : "";

export const formatMetadata = (metadata: Metadata, url: any, extension: string): Metadata => {
    if (!metadata) {
        metadata = new Metadata();
    }
    if (!metadata.title || typeof metadata.title !== 'string') {
        if (typeof url === "string") {
            metadata.title = getFileName(url)?.trim()
        }
        else {
            metadata.title = "";
        }
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
        if (!metadata.fileName) {
            if (typeof url === "string") {
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
        if (metadata.fileName?.length > 1000) {
            metadata.fileName = '';
        }
    } catch (e) {
        //
    }
    return metadata;
}