export const clampPreloadFileCount = (value: number) => {
    if (!Number.isFinite(value) || value < 1) {
        return 1;
    }
    return Math.min(10, value);
};

export const collectPreloadNeighbors = <T>(
    documents: T[],
    startIndex: number,
    endIndex: number,
    preloadFileCount: number,
    previousFirst: boolean,
) => {
    const count = clampPreloadFileCount(preloadFileCount);
    const previous: T[] = [];
    const next: T[] = [];
    for (let i = 1; i <= count; i++) {
        const previousIndex = startIndex - i;
        if (previousIndex >= 0) {
            previous.push(documents[previousIndex]);
        }
        const nextIndex = endIndex + i;
        if (nextIndex >= 0 && nextIndex < documents.length) {
            next.push(documents[nextIndex]);
        }
    }
    return previousFirst ? [...previous, ...next] : [...next, ...previous];
};
