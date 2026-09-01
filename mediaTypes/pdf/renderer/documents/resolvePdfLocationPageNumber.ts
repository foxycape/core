import { FileLocation } from "../../../../kernal";

/**
 * Resolve a 1-based PDF page from {@link FileLocation}.
 * `current` is only treated as a page number when `unit` is `page`, or when unit is
 * the legacy default `ratio` with `current >= 1`. `unit=symbol` means a char/symbol
 * index and must not be used as a page.
 */
export const resolvePdfLocationPageNumber = (
    location: FileLocation | undefined,
    numberOfPages: number,
    pageFromUrl?: (url: string) => number | null,
): number | null => {
    if (!location) {
        return 1;
    }
    const unit = location.unit ?? "ratio";
    const pageByUrl = () => {
        if (!location.url) {
            return 1;
        }
        const fromUrl = pageFromUrl?.(location.url);
        return fromUrl === undefined ? 1 : fromUrl;
    };
    if (unit === "page" && location.current != null && location.current >= 1) {
        return location.current;
    }
    if (unit === "symbol") {
        return pageByUrl();
    }
    if (location.current) {
        if (location.current < 1) {
            return Math.max(1, Math.ceil(location.current * numberOfPages));
        }
        return location.current;
    }
    return pageByUrl();
};
