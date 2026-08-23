export class Metadata {
    fileName?: string = "";
    title?: string = "";
    subtitle?: string;
    size?: number = 0;
    author?: string[] = [];
    contributor?: string[] = [];
    publisher?: string = "";
    issueDate?: string = "";
    modifiedDate?: string;
    extension?: string;
    language?: string;
    identifier?: string;
    isbn?: string;
    asin?: string;
    subject?: string[] = [];
    description?: string;
    rights?: string;
    source?: string;
    series?: string;
    seriesIndex?: string;
}

export type BookMetadataSource = {
    title?: unknown;
    subtitle?: unknown;
    author?: unknown;
    contributor?: unknown;
    publisher?: unknown;
    published?: unknown;
    issueDate?: unknown;
    modified?: unknown;
    modifiedDate?: unknown;
    language?: unknown;
    identifier?: unknown;
    isbn?: unknown;
    asin?: unknown;
    subject?: unknown;
    description?: unknown;
    rights?: unknown;
    source?: unknown;
    series?: unknown;
    seriesIndex?: unknown;
    size?: unknown;
};

const NamedHtmlEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    copy: "©",
    reg: "®",
    trade: "™",
    mdash: "—",
    ndash: "–",
    hellip: "…",
    rsquo: "\u2019",
    lsquo: "\u2018",
    rdquo: "\u201d",
    ldquo: "\u201c",
};

const decodeHtmlEntities = (value: string) =>
    value.replace(/&(#x[\da-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
        if (entity.startsWith("#")) {
            const code = entity[1] === "x" || entity[1] === "X"
                ? Number.parseInt(entity.slice(2), 16)
                : Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return NamedHtmlEntities[entity.toLowerCase()] ?? match;
    });

const stripHtmlTags = (value: string) =>
    value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^<>]*?)?\/?>/g, "");

/** Remove HTML tags / entities from bibliographic fields. */
export const stripHtmlFromMetadata = (value: string): string => {
    const text = value.trim();
    if (!text) {
        return "";
    }
    const cleaned = decodeHtmlEntities(stripHtmlTags(decodeHtmlEntities(stripHtmlTags(text))));
    return cleaned.replace(/\s+/g, " ").trim();
};

const firstText = (value: unknown): string => {
    if (typeof value === "string") {
        return stripHtmlFromMetadata(value);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    if (Array.isArray(value)) {
        return firstText(value[0]);
    }
    if (value && typeof value === "object" && "name" in value) {
        return firstText((value as { name: unknown }).name);
    }
    return "";
};

/** Normalize Dublin Core / EXTH / FB2 list fields into trimmed strings. */
export const toMetadataList = (value: unknown): string[] => {
    if (value == null) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.flatMap((item) => toMetadataList(item));
    }
    const text = firstText(value);
    return text ? [text] : [];
};

export const fillMetadata = (metadata: Metadata, source?: BookMetadataSource | null): Metadata => {
    if (!source) {
        return metadata;
    }
    const title = firstText(source.title);
    if (title) {
        metadata.title = title;
    }
    const subtitle = firstText(source.subtitle);
    if (subtitle) {
        metadata.subtitle = subtitle;
    }
    const authors = toMetadataList(source.author);
    if (authors.length > 0) {
        metadata.author = authors;
    }
    const contributors = toMetadataList(source.contributor);
    if (contributors.length > 0) {
        metadata.contributor = contributors;
    }
    const publisher = firstText(source.publisher);
    if (publisher) {
        metadata.publisher = publisher;
    }
    const issueDate = firstText(source.issueDate) || firstText(source.published);
    if (issueDate) {
        metadata.issueDate = issueDate;
    }
    const modifiedDate = firstText(source.modifiedDate) || firstText(source.modified);
    if (modifiedDate) {
        metadata.modifiedDate = modifiedDate;
    }
    const language = firstText(source.language);
    if (language) {
        metadata.language = language;
    }
    const identifier = firstText(source.identifier);
    if (identifier) {
        metadata.identifier = identifier;
    }
    const isbn = firstText(source.isbn);
    if (isbn) {
        metadata.isbn = isbn;
    }
    const asin = firstText(source.asin);
    if (asin) {
        metadata.asin = asin;
    }
    const subjects = toMetadataList(source.subject);
    if (subjects.length > 0) {
        metadata.subject = subjects;
    }
    const description = firstText(source.description);
    if (description) {
        metadata.description = description;
    }
    const rights = firstText(source.rights);
    if (rights) {
        metadata.rights = rights;
    }
    const sourceValue = firstText(source.source);
    if (sourceValue) {
        metadata.source = sourceValue;
    }
    const series = firstText(source.series);
    if (series) {
        metadata.series = series;
    }
    const seriesIndex = firstText(source.seriesIndex);
    if (seriesIndex) {
        metadata.seriesIndex = seriesIndex;
    }
    if (typeof source.size === "number" && Number.isFinite(source.size)) {
        metadata.size = source.size;
    }
    return metadata;
};
