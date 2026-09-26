/** 1: raw scrollLeft grows away from the start. -1: Chromium RTL, raw scrollLeft is negative. */
export type ScrollLeftSign = 1 | -1;

export const toLogicalScrollLeft = (raw: number, sign: ScrollLeftSign) =>
    sign < 0 ? -raw : raw;

export const fromLogicalScrollLeft = (logical: number, sign: ScrollLeftSign) =>
    sign < 0 ? -logical : logical;

/**
 * Chromium RTL keeps scrollLeft in [-max, 0]. Setting it to 1 does not stick.
 * Firefox RTL accepts a positive scrollLeft measured from the same start edge.
 * Callers must not probe unless the used direction is rtl.
 */
export const detectScrollLeftSign = (
    element: HTMLElement,
    direction = getComputedStyle(element).direction,
): ScrollLeftSign => {
    if (direction !== "rtl") {
        return 1;
    }
    const previous = element.scrollLeft;
    element.scrollLeft = 1;
    const acceptsPositive = element.scrollLeft === 1;
    element.scrollLeft = previous;
    return acceptsPositive ? 1 : -1;
};

const scrollLeftSignCache = new WeakMap<HTMLElement, { direction: string; sign: ScrollLeftSign }>();

/** Reuse a sign until the element's direction changes. Non-rtl never writes scrollLeft. */
export const resolveScrollLeftSign = (element: HTMLElement): ScrollLeftSign => {
    const direction = getComputedStyle(element).direction;
    const cached = scrollLeftSignCache.get(element);
    if (cached && cached.direction === direction) {
        return cached.sign;
    }
    const sign = detectScrollLeftSign(element, direction);
    scrollLeftSignCache.set(element, { direction, sign });
    return sign;
};
