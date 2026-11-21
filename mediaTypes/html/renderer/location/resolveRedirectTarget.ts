import { FileLocation, STTAG } from "../../../../kernal";
import { compareTagName } from "../../../../kernal/html/finder";
import { isUnsplittableContentElement, type LocateTarget } from "../../../../kernal/html/geometry";
import { createRange } from "../../../../kernal/html/selection";

const MEDIA_SELECTOR = "img, image, svg, video, audio, canvas";

const mediaTagNames = new Set(["img", "image", "svg", "video", "audio", "canvas"]);

const isMediaElement = (element: Element) => mediaTagNames.has(element.tagName?.toLowerCase());

const selectNodeRange = (node: Node): Range | undefined => {
    const ownerDocument = node.ownerDocument;
    if (!ownerDocument) {
        return undefined;
    }
    const range = ownerDocument.createRange();
    try {
        range.selectNode(node);
    } catch {
        return undefined;
    }
    return range;
};

/**
 * Character offset cannot describe an image-only element. Select the media
 * node so page and scroll math use its client rects instead of an empty box
 * at the origin.
 */
const resolveMediaTarget = (element: Element): LocateTarget => {
    const media = isMediaElement(element) ? element : element.querySelector(MEDIA_SELECTOR);
    return selectNodeRange(media ?? element) ?? element;
};

/**
 * Map location.textOffset to a live Range so scroll / page calc can use
 * character geometry without wrapping each glyph into a DOM node.
 * Image-only targets become a Range around the media node.
 */
export const resolveContentRedirectTarget = (
    target: Element | undefined,
    location: FileLocation,
): LocateTarget | undefined => {
    if (!target || !(location?.textOffset >= 0)) {
        return target;
    }
    if (isUnsplittableContentElement(target)) {
        return resolveMediaTarget(target);
    }
    const textContent = target.textContent ?? "";
    if (location.textOffset >= textContent.length) {
        return target;
    }
    let offset = location.textOffset;
    const firstChild = target.firstElementChild;
    if (firstChild && compareTagName(firstChild.tagName, STTAG) && firstChild.getBoundingClientRect().width == 0) {
        offset = firstChild.textContent?.length ?? 0;
    }
    if (offset >= textContent.length) {
        return target;
    }
    return createRange(target, target, offset, Math.min(offset + 1, textContent.length)) ?? target;
};
