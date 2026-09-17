/**
 * Distance from `ancestor`'s padding edge to `element`'s border edge.
 *
 * `offsetLeft` is relative to the offsetParent's padding edge, so each hop
 * past an intermediate offsetParent must add that parent's `clientLeft`.
 * RTL page wrappers put `border-inline-end` on the physical left; skipping
 * that 1px makes every page transform overshoot (408×7 → 2857 instead of 2856).
 */
export const getLayoutOffsetLeft = (element: HTMLElement, ancestor: HTMLElement): number => {
    let left = 0;
    let current: HTMLElement | null = element;
    while (current && current !== ancestor) {
        left += current.offsetLeft;
        const offsetParent = current.offsetParent as HTMLElement | null;
        if (!offsetParent || offsetParent === current) {
            break;
        }
        if (offsetParent !== ancestor) {
            left += offsetParent.clientLeft;
        }
        current = offsetParent;
    }
    return left;
};
