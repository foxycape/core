const realmWindow = (node: Node | null | undefined): Window | null => {
    if (!node) {
        return null;
    }
    if (node.nodeType === 9) {
        return (node as Document).defaultView;
    }
    return node.ownerDocument?.defaultView ?? null;
};

/** Constructors live on `window` (`Window & typeof globalThis`), not on `Window`. */
const realmGlobal = (view: Window) => view.window;

const isRealmInstance = (
    value: unknown,
    ctor: (global: Window & typeof globalThis) => (new (...args: never[]) => object) | undefined,
): boolean => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const view = realmWindow(value as Node);
    const Ctor = view ? ctor(realmGlobal(view)) : undefined;
    return !!Ctor && value instanceof Ctor;
};

/** iframe-safe: `el instanceof el.ownerDocument.defaultView.window.HTMLElement` */
export const isHtmlElement = (el: EventTarget | Node | null | undefined): el is HTMLElement =>
    isRealmInstance(el, (global) => global.HTMLElement);

export const isDomElement = (el: EventTarget | Node | null | undefined): el is Element =>
    isRealmInstance(el, (global) => global.Element);

export const isDomDocument = (el: EventTarget | Node | null | undefined): el is Document =>
    isRealmInstance(el, (global) => global.Document);

export const isHtmlImageElement = (el: unknown): el is HTMLImageElement =>
    isRealmInstance(el, (global) => global.HTMLImageElement);

export const isHtmlCanvasElement = (el: unknown): el is HTMLCanvasElement =>
    isRealmInstance(el, (global) => global.HTMLCanvasElement);

export const isHtmlVideoElement = (el: unknown): el is HTMLVideoElement =>
    isRealmInstance(el, (global) => global.HTMLVideoElement);

export const isDomNode = (el: EventTarget | Node | null | undefined): el is Node =>
    isRealmInstance(el, (global) => global.Node);
