import {
    ElementInitialNumberName,
    ElementMtInitialNumberName,
    MTTAG,
    STTAG,
} from "../Constants";
import { compareTagName } from "./finder";
import { isHtmlElement } from "./realm";

const isElementDisplayed = (el: Element): boolean => {
    const view = el.ownerDocument?.defaultView;
    const style = view?.getComputedStyle(el);
    if (!style) {
        return true;
    }
    return style.display !== "none" && style.visibility !== "hidden";
};

const isVisiblyPresent = (el: Element): boolean => {
    let current: Element | null = el;
    while (current) {
        if (!isElementDisplayed(current)) {
            return false;
        }
        current = current.parentElement;
    }
    return true;
};

const findAncestorByTag = (el: Element, tag: string): Element | null => {
    let current: Element | null = el;
    while (current) {
        if (compareTagName(current.tagName, tag)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
};

const queryPaired = (from: Element, attr: string, index: string): Element | null => {
    const value = index.trim();
    if (!value) {
        return null;
    }
    const root = from.ownerDocument ?? from;
    try {
        return root.querySelector(`[${attr}="${CSS.escape(value)}"]`);
    } catch {
        return root.querySelector(`[${attr}="${value}"]`);
    }
};

const asVisibleHtml = (el: Element | null): HTMLElement | null => {
    if (!el || !isHtmlElement(el) || !isVisiblyPresent(el)) {
        return null;
    }
    return el;
};

/**
 * If `el` or an ancestor is hidden (e.g. `<st>` in translation-only mode),
 * return the paired visible source/translation node.
 */
export const resolveVisibleTranslationAnchor = (el: Element | null): HTMLElement | null => {
    if (!el) {
        return null;
    }
    if (isHtmlElement(el) && isVisiblyPresent(el)) {
        return el;
    }
    const st = findAncestorByTag(el, STTAG) ?? (compareTagName(el.tagName, STTAG) ? el : null);
    const mt = findAncestorByTag(el, MTTAG) ?? (compareTagName(el.tagName, MTTAG) ? el : null);
    if (st) {
        const paired = queryPaired(el, ElementMtInitialNumberName, st.getAttribute(ElementInitialNumberName) ?? "");
        const visible = asVisibleHtml(paired);
        if (visible) {
            return visible;
        }
    }
    if (mt) {
        const paired = queryPaired(el, ElementInitialNumberName, mt.getAttribute(ElementMtInitialNumberName) ?? "");
        const visible = asVisibleHtml(paired);
        if (visible) {
            return visible;
        }
    }
    const ownInitial = el.getAttribute(ElementInitialNumberName);
    if (ownInitial) {
        const visible = asVisibleHtml(queryPaired(el, ElementMtInitialNumberName, ownInitial));
        if (visible) {
            return visible;
        }
    }
    const ownMt = el.getAttribute(ElementMtInitialNumberName);
    if (ownMt) {
        const visible = asVisibleHtml(queryPaired(el, ElementInitialNumberName, ownMt));
        if (visible) {
            return visible;
        }
    }
    return isHtmlElement(el) ? el : null;
};
