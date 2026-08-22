export type OverlayRect = {
    x: number
    y: number
    width: number
    height: number
}

export type PaintRectSpec = {
    id: string
    className: string
    idAttr?: string
    attrs?: Record<string, string>
    extraStyle?: string
    /** When true (default), drop existing masks with this id before painting. */
    replace?: boolean
}

export type EnsureOverlayLayerOptions = {
    relativeClass?: string
    /** Size the layer to the host scroll box (HTML reflow). Default uses client box. */
    sizeToScroll?: boolean
}

const DEFAULT_ID_ATTR = "data-highlight-id"

const createDiv = (ownerDocument: Document, className: string): HTMLElement => {
    const el = ownerDocument.createElement("div")
    el.className = className
    return el
}

export const ensureOverlayLayer = (
    host: HTMLElement,
    layerClass: string,
    options?: EnsureOverlayLayerOptions,
): HTMLElement => {
    let layer = host.querySelector<HTMLElement>(`:scope > .${layerClass}`)
    if (!layer) {
        layer = createDiv(host.ownerDocument, layerClass)
        host.appendChild(layer)
        const style = host.ownerDocument.defaultView?.getComputedStyle(host)
        if (style && style.position === "static") {
            if (options?.relativeClass) {
                host.classList.add(options.relativeClass)
            } else {
                host.style.position = "relative"
            }
        }
    }
    const width = options?.sizeToScroll
        ? Math.max(host.clientWidth, host.scrollWidth)
        : host.clientWidth
    const height = options?.sizeToScroll
        ? Math.max(host.clientHeight, host.scrollHeight)
        : host.clientHeight
    layer.style.width = `${width}px`
    layer.style.height = `${height}px`
    return layer
}

export const removeOverlaysById = (
    root: ParentNode,
    ids: string[],
    idAttr = DEFAULT_ID_ATTR,
): void => {
    for (const id of ids) {
        if (!id) {
            continue
        }
        root.querySelectorAll(`[${idAttr}="${CSS.escape(id)}"]`).forEach((node) => node.remove())
    }
}

export const removeOverlayLayers = (root: ParentNode, layerClass: string): void => {
    root.querySelectorAll(`.${layerClass}`).forEach((layer) => layer.remove())
}

export const paintRects = (
    layer: HTMLElement,
    rects: OverlayRect[],
    spec: PaintRectSpec,
): void => {
    const idAttr = spec.idAttr ?? DEFAULT_ID_ATTR
    if (spec.replace !== false) {
        layer.querySelectorAll(`[${idAttr}="${CSS.escape(spec.id)}"]`).forEach((node) => node.remove())
    }
    const ownerDocument = layer.ownerDocument
    for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= 0) {
            continue
        }
        const mask = createDiv(ownerDocument, spec.className)
        mask.setAttribute(idAttr, spec.id)
        if (spec.attrs) {
            for (const [key, value] of Object.entries(spec.attrs)) {
                mask.setAttribute(key, value)
            }
        }
        const extra = spec.extraStyle ?? ""
        mask.setAttribute(
            "style",
            `${extra}left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;`,
        )
        layer.appendChild(mask)
    }
}

const isPointInBox = (
    x: number,
    y: number,
    left: number,
    top: number,
    right: number,
    bottom: number,
    slop = 1,
): boolean =>
    x >= left - slop && x <= right + slop && y >= top - slop && y <= bottom + slop

export const findOverlayIdAtPoint = (
    host: HTMLElement,
    maskClass: string,
    offsetX: number,
    offsetY: number,
    idAttr = DEFAULT_ID_ATTR,
): string | undefined => {
    const masks = host.querySelectorAll<HTMLElement>(`.${maskClass}`)
    for (let i = masks.length - 1; i >= 0; i--) {
        const mask = masks[i]
        const left = Number.parseFloat(mask.style.left)
        const top = Number.parseFloat(mask.style.top)
        const width = Number.parseFloat(mask.style.width)
        const height = Number.parseFloat(mask.style.height)
        if (isPointInBox(offsetX, offsetY, left, top, left + width, top + height)) {
            return mask.getAttribute(idAttr) ?? undefined
        }
    }
    return undefined
}

export const findOverlayAtClientPoint = (
    root: ParentNode,
    maskClass: string,
    clientX: number,
    clientY: number,
): HTMLElement | undefined => {
    const masks = root.querySelectorAll<HTMLElement>(`.${maskClass}`)
    for (let i = masks.length - 1; i >= 0; i--) {
        const mask = masks[i]
        const box = mask.getBoundingClientRect()
        if (isPointInBox(clientX, clientY, box.left, box.top, box.right, box.bottom)) {
            return mask
        }
    }
    return undefined
}

export const findOverlayIdAtClientPoint = (
    root: ParentNode,
    maskClass: string,
    clientX: number,
    clientY: number,
    idAttr = DEFAULT_ID_ATTR,
): string | undefined => {
    return findOverlayAtClientPoint(root, maskClass, clientX, clientY)?.getAttribute(idAttr) ?? undefined
}

/** Merge adjacent boxes on the same line to cut overlay node count. */
export const mergeOverlayRects = (rects: OverlayRect[], gap = 1): OverlayRect[] => {
    const valid = rects.filter((rect) => rect.width > 0 && rect.height > 0)
    if (valid.length <= 1) {
        return valid
    }
    const sorted = [...valid].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    const merged: OverlayRect[] = []
    for (const rect of sorted) {
        const last = merged[merged.length - 1]
        if (!last) {
            merged.push({ ...rect })
            continue
        }
        const sameLine =
            Math.abs(rect.y - last.y) <= gap &&
            Math.abs(rect.height - last.height) <= Math.max(2, last.height * 0.35)
        const adjacent = rect.x <= last.x + last.width + gap
        if (sameLine && adjacent) {
            const right = Math.max(last.x + last.width, rect.x + rect.width)
            const bottom = Math.max(last.y + last.height, rect.y + rect.height)
            last.x = Math.min(last.x, rect.x)
            last.y = Math.min(last.y, rect.y)
            last.width = right - last.x
            last.height = bottom - last.y
            continue
        }
        merged.push({ ...rect })
    }
    return merged
}

export const clientRectsToOverlayRects = (
    layer: HTMLElement,
    clientRects: ArrayLike<DOMRect>,
): OverlayRect[] => {
    const origin = layer.getBoundingClientRect()
    const rects: OverlayRect[] = []
    for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i]
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            continue
        }
        rects.push({
            x: rect.left - origin.left,
            y: rect.top - origin.top,
            width: rect.width,
            height: rect.height,
        })
    }
    return mergeOverlayRects(rects)
}
