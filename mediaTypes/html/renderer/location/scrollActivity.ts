export const USER_SCROLL_SETTLE_MS = 160;
export const PROGRAMMATIC_SCROLL_QUIET_MS = 160;

let lastUserScrollAt = 0;
let lastProgrammaticScrollAt = 0;
let programmaticScrollDepth = 0;
let pinReadingStart = false;
let holdAbsoluteAnchor = false;

export const markUserScroll = (at = Date.now()) => {
    lastUserScrollAt = at;
};

export const beginProgrammaticScroll = (at = Date.now()) => {
    programmaticScrollDepth++;
    lastProgrammaticScrollAt = at;
};

export const endProgrammaticScroll = (at = Date.now()) => {
    programmaticScrollDepth = Math.max(0, programmaticScrollDepth - 1);
    lastProgrammaticScrollAt = at;
};

export const isProgrammaticScroll = (at = Date.now()) =>
    programmaticScrollDepth > 0
    || at - lastProgrammaticScrollAt < PROGRAMMATIC_SCROLL_QUIET_MS;

export const releaseAbsoluteLocate = () => {
    holdAbsoluteAnchor = false;
};

export const shouldBeginAbsoluteLocate = (
    direction?: string,
    holdsAbsoluteLocate = false,
) => holdsAbsoluteLocate && direction != "next" && direction != "previous";

export const isUserScrollSettling = (settleMs = USER_SCROLL_SETTLE_MS) =>
    Date.now() - lastUserScrollAt < settleMs;

export const beginAbsoluteLocate = () => {
    holdAbsoluteAnchor = true;
    pinReadingStart = false;
};

export const isHoldingAbsoluteAnchor = () => holdAbsoluteAnchor;

export const setPinReadingStart = (value: boolean) => {
    pinReadingStart = value;
};

export const isPinReadingStart = () => pinReadingStart;

export const resetUserScroll = () => {
    lastUserScrollAt = 0;
    lastProgrammaticScrollAt = 0;
    programmaticScrollDepth = 0;
    pinReadingStart = false;
    holdAbsoluteAnchor = false;
};
