import type { FileLocation } from "../../../../kernal";

/**
 * Previous-chapter entry stores the last page known at navigate time.
 * An unfinished chapter is often recorded as 1/1; after it finishes measuring,
 * keep the last page instead of staying on page 1.
 */
export const remapStoredPageNumber = (
    location: Pick<FileLocation, "current" | "total" | "direction" | "unit">,
    numberOfPages: number,
) => {
    const current = location.current ?? 0;
    if (location.unit != "page" || current <= 0 || numberOfPages <= 0) {
        return current > 0 ? current : 1;
    }
    const total = location.total && location.total > 0 ? location.total : 1;
    if (total == numberOfPages) {
        return Math.min(current, numberOfPages);
    }
    if (location.direction == "previous" && current >= total) {
        return numberOfPages;
    }
    if (total > 1) {
        return Math.max(1, Math.ceil(numberOfPages * (current / total)));
    }
    return current;
};

export const shouldKeepPageEndOnContentGrow = (
    location: Pick<FileLocation, "url" | "unit" | "current" | "total" | "direction"> | undefined,
    docUrl: string,
) => {
    if (!location || location.url != docUrl || location.unit != "page" || location.direction != "previous") {
        return false;
    }
    const current = location.current ?? 0;
    const total = location.total ?? 0;
    return current > 0 && total > 0 && current >= total;
};
