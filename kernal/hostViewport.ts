export type HostViewportMode = "host" | "window";

export type HostViewport = {
    mode: HostViewportMode;
    height: number;
    width: number;
    /** IntersectionObserver root; null uses the browser viewport. */
    observerRoot: Element | null;
    /** Element used for scrollTop / scrollLeft / scrollTo. */
    scrollElement: HTMLElement;
    /** Target that actually receives scroll events. */
    scrollWatchTarget: Document | Element;
};

export const MIN_HOST_VIEWPORT_PX = 80;
const CHROME_MAX_LAYOUT_PX = 33554400;
const PROBE_HEIGHT_PX = 10000;

const isUsableSize = (value: number) =>
    value >= MIN_HOST_VIEWPORT_PX && value < CHROME_MAX_LAYOUT_PX - 1;

const getOverflow = (style: CSSStyleDeclaration, axis: "x" | "y") =>
    (axis == "x" ? style.overflowX : style.overflowY) || style.overflow;

const canClipOrScroll = (overflow: string) =>
    overflow == "auto" || overflow == "scroll" || overflow == "hidden";

const canScroll = (overflow: string) =>
    overflow == "auto" || overflow == "scroll";

const getVisualViewportHeight = (view: Window | null) =>
    Math.round(view?.visualViewport?.height ?? view?.innerHeight ?? 0);

const getDocumentScrollElement = (doc: Document) =>
    (doc.scrollingElement as HTMLElement | null)
    ?? doc.documentElement
    ?? doc.body;

/**
 * True when the host's used height does not grow with a tall child.
 * Must run before reader content is inserted.
 */
export const probeDefiniteHostHeight = (host: HTMLElement): boolean => {
    if (!host.isConnected) {
        return false;
    }
    const view = host.ownerDocument.defaultView;
    if (!view) {
        return false;
    }
    const display = view.getComputedStyle(host).display;
    if (display == "none") {
        return false;
    }

    const probe = host.ownerDocument.createElement("div");
    probe.setAttribute("data-role", "host-height-probe");
    probe.style.cssText = "width:1px;height:1px;margin:0;padding:0;border:0;flex:none;visibility:hidden;pointer-events:none;position:relative";
    host.appendChild(probe);
    const withSmall = host.clientHeight;
    probe.style.height = PROBE_HEIGHT_PX + "px";
    const withLarge = host.clientHeight;
    host.removeChild(probe);

    if (!isUsableSize(withSmall) && !isUsableSize(withLarge)) {
        return false;
    }
    return Math.abs(withLarge - withSmall) <= 1;
};

const findAncestorOverflow = (
    start: HTMLElement,
    predicate: (overflowY: string, overflowX: string, element: HTMLElement) => boolean
): HTMLElement | null => {
    const view = start.ownerDocument.defaultView;
    if (!view) {
        return null;
    }
    let current = start.parentElement;
    while (current) {
        const style = view.getComputedStyle(current);
        if (predicate(getOverflow(style, "y"), getOverflow(style, "x"), current)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
};

export const findNearestObserverRoot = (host: HTMLElement): Element | null =>
    findAncestorOverflow(host, (overflowY, overflowX, element) =>
        (canClipOrScroll(overflowY) || canClipOrScroll(overflowX)) && isUsableSize(element.clientHeight)
    );

export const findNearestScrollElement = (host: HTMLElement): HTMLElement => {
    const ancestor = findAncestorOverflow(host, (overflowY, overflowX, element) =>
        (canScroll(overflowY) || canScroll(overflowX)) && isUsableSize(element.clientHeight)
    );
    return ancestor ?? getDocumentScrollElement(host.ownerDocument);
};

export const resolveViewportHeight = (
    host: HTMLElement,
    mode: HostViewportMode,
    observerRoot: Element | null
): number => {
    const view = host.ownerDocument.defaultView;
    if (mode == "host" && isUsableSize(host.clientHeight)) {
        return Math.round(host.clientHeight);
    }
    if (observerRoot instanceof HTMLElement && isUsableSize(observerRoot.clientHeight)) {
        return Math.round(observerRoot.clientHeight);
    }
    const visualHeight = getVisualViewportHeight(view);
    if (isUsableSize(visualHeight)) {
        return visualHeight;
    }
    return 600;
};

export const resolveHostViewport = (host: HTMLElement): HostViewport => {
    const mode: HostViewportMode = probeDefiniteHostHeight(host) ? "host" : "window";
    const observerRoot = mode == "window" ? findNearestObserverRoot(host) : null;
    const doc = host.ownerDocument;
    const scrollElement = mode == "window"
        ? findNearestScrollElement(host)
        : host;
    const isDocumentScroll = scrollElement == doc.documentElement || scrollElement == doc.body;
    return {
        mode,
        height: resolveViewportHeight(host, mode, observerRoot),
        width: Math.max(1, host.clientWidth || host.getBoundingClientRect().width || 1),
        observerRoot,
        scrollElement,
        scrollWatchTarget: mode == "host"
            ? host
            : (isDocumentScroll ? doc : scrollElement),
    };
};

export const refreshHostViewportSize = (host: HTMLElement, viewport: HostViewport): HostViewport => ({
    ...viewport,
    height: resolveViewportHeight(host, viewport.mode, viewport.observerRoot),
    width: Math.max(1, host.clientWidth || viewport.width),
});
