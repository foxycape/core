import { isNullOrWhiteSpace } from "../../../../kernal/common/text";

const PLACEHOLDER_DATA_URL_PREFIX = "data:image/svg+xml";
const PLACEHOLDER_MARK = "foxycape-S2VlcGNhcGU=";

export const createHtmlPlaceholderImageUrl = (width: number, height: number) => {
    const w = width > 0 ? Math.round(width) : 1;
    const h = height > 0 ? Math.round(height) : 1;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-foxycape-placeholder="${PLACEHOLDER_MARK}"></svg>`;
    return `${PLACEHOLDER_DATA_URL_PREFIX},${encodeURIComponent(svg)}`;
};

export const isHtmlPlaceholderImageUrl = (url: string | null | undefined): boolean => {
    if (isNullOrWhiteSpace(url) || !url.startsWith(PLACEHOLDER_DATA_URL_PREFIX)) {
        return false;
    }
    let result = url.includes(PLACEHOLDER_MARK);
    if (!result) {
        result = decodeURIComponent(url).includes(PLACEHOLDER_MARK);
    }
    return result;
};
