import type { Direction } from "../types";

/**
 * Primary language subtags (ISO 639-1 / 639-2 / 639-3) that default to RTL.
 * Region tags such as `ar-SA` are matched by the primary subtag.
 */
export const RtlLanguageCodes = [
    "ar",
    "ara",
    "he",
    "heb",
    "fa",
    "fas",
    "per",
    "prs",
    "ur",
    "urd",
    "yi",
    "yid",
    "dv",
    "div",
    "ps",
    "pus",
    "sd",
    "snd",
    "ug",
    "uig",
    "ckb",
    "arc",
    "syc",
    "syr",
    "nqo",
    "rhg",
    "azb",
    "bal",
    "ks",
    "kas",
    "mzn",
    "glk",
] as const;

const RtlLanguageSet = new Set<string>(RtlLanguageCodes);

export const normalizeLanguageCode = (language?: string): string => {
    if (!language) {
        return "";
    }
    const primary = language.trim().split(/[-_]/, 1)[0] ?? "";
    return primary.toLowerCase();
};

export const isRtlLanguage = (
    language?: string,
    rtlLanguages: readonly string[] = RtlLanguageCodes,
): boolean => {
    const code = normalizeLanguageCode(language);
    if (!code) {
        return false;
    }
    if (rtlLanguages === RtlLanguageCodes) {
        return RtlLanguageSet.has(code);
    }
    return rtlLanguages.some((item) => normalizeLanguageCode(item) === code);
};

export const resolveTextDirectionFromLanguage = (
    language?: string,
    rtlLanguages: readonly string[] = RtlLanguageCodes,
): Direction => (isRtlLanguage(language, rtlLanguages) ? "rtl" : "ltr");
