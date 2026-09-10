import type { PagingExtra } from "../navigator/IPagingNavigator";
import type { LocationFrom } from "./Progress";

/** Programmatic jumps that must not count as the user changing progress. */
export const isAppLocationFrom = (from?: LocationFrom): boolean =>
    from === "tts" || from === "restore";

export const shouldSetUserChangedProgress = (isReload?: boolean, from?: LocationFrom): boolean =>
    !isReload && !isAppLocationFrom(from);

export const locationFromOfPagingExtra = (extra?: PagingExtra): LocationFrom | undefined => {
    if (!extra || extra.trigger === "app") {
        return undefined;
    }
    const triggerType = extra.triggerType;
    if (!triggerType) {
        return extra.trigger === "user" ? "mouse" : undefined;
    }
    if (triggerType === "key" || triggerType === "keyboard") {
        return "keyboard";
    }
    if (triggerType === "pen") {
        return "mouse";
    }
    return triggerType;
};

export const applyPagingLocationFrom = <T extends { from?: LocationFrom }>(
    location: T,
    extra?: PagingExtra,
): T => {
    const from = locationFromOfPagingExtra(extra);
    if (from) {
        location.from = from;
    }
    return location;
};
