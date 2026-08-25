import { convertArrayBufferToString } from "../../../../kernal/common/encoding";
import { parseNumber } from "../../../../kernal/common/number";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { checkIsAbsoluteUrl, checkIsBlobUrl } from "../../../../kernal/common/url";
import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { getImageSize } from "../../../../kernal/html/image";
import { injectCssContent } from "../../../../kernal/html/injector";
import { getFormatDocument } from "../../../../kernal/html/parser";
import {
    asyncDebounce,
    BrowserCapabilities,
    ElementInitialNumberName,
    yieldToMain,
    EventNames,
    IDocument,
    IDocumentsProvider,
    IEventEmitter,
    ILogger,
} from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { ContentLayoutCssVariableNames } from "../style/ContentLayoutCssVariableNames";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import errorImageUrl from "./error-image.png";
import { IHtmlImageLoader, ImageElement, ImageSizeDescriptor } from "./IHtmlImageLoader";
import { createHtmlPlaceholderImageUrl, isHtmlPlaceholderImageUrl } from "./htmlImagePlaceholderUrl";

const SVG_STYLE_CLASS = "lhx-svg";
const PRELOAD_IMAGE_COUNT = 5;
const SVG_STYLE = `.${SVG_STYLE_CLASS} {width: 100% !important; height: auto !important; }`;
const ONLY_ONE_IMAGE_STYLE = "*,p,div{text-align:center;margin-block:0 !important;margin-inline:auto !important;text-indent:0 !important;padding:0 !important;line-height:0 !important}";

const isDefaultPlaceholderUrl = (url: string | null | undefined): boolean => {
    if (isNullOrWhiteSpace(url)) {
        return true;
    }
    return isHtmlPlaceholderImageUrl(url);
};

const collectImageElements = (root: Document | Element): ImageElement[] => {
    const collected = root.querySelectorAll("img, image");
    if (collected.length > 0) {
        return [...collected] as ImageElement[];
    }
    return [
        ...root.getElementsByTagName("img"),
        ...root.getElementsByTagName("image"),
    ] as ImageElement[];
};

const isSvgImageElement = (element: Element) => compareTagName(element.tagName, "IMAGE");

const applyStyles = (element: Element, styles: Record<string, string>, important = false) => {
    const style = (element as HTMLElement | SVGElement).style;
    if (!style) {
        const cssText = Object.entries(styles)
            .map(([name, value]) => important ? `${name}:${value} !important` : `${name}:${value}`)
            .join(";");
        element.setAttribute("style", cssText);
        return;
    }
    for (const [name, value] of Object.entries(styles)) {
        style.setProperty(name, value, important ? "important" : "");
    }
};

export class HtmlImageLoader implements IHtmlImageLoader {
    private readonly documentImageSizeMaps = new Map<IDocument, Map<string, ImageSizeDescriptor>>();
    private readonly blobUrls = new Map<IDocument, string[]>();
    private readonly events: IEventEmitter;
    private readonly logger: ILogger;
    private isDisposed = false;

    constructor(
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly rendererViewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly htmlOptions: HtmlOptions
    ) {
        this.events = this.documentsProvider.owner.events;
        this.logger = this.documentsProvider.owner.loggerFactory.getLogger(this.constructor.name);
        this.bindEvents();
    }

    private bindEvents() {
        this.events.on(EventNames.LayoutChange, this.onLayoutChange);
        this.events.on(EventNames.DocumentLoad, this.onDocumentLoad);
        this.events.on(EventNames.DocumentDisposing, this.onDocumentDisposing);
        this.events.on(EventNames.ImageElementsVisible, this.delayLoadOnImageElementsVisible);
    }

    private unbindEvents() {
        this.events.off(EventNames.LayoutChange, this.onLayoutChange);
        this.events.off(EventNames.DocumentLoad, this.onDocumentLoad);
        this.events.off(EventNames.DocumentDisposing, this.onDocumentDisposing);
        this.events.off(EventNames.ImageElementsVisible, this.delayLoadOnImageElementsVisible);
    }

    private onDocumentDisposing = (doc: IDocument) => {
        this.revokeDocumentBlobUrls(doc);
        this.documentImageSizeMaps.delete(doc);
    };

    private addBlobUrl(doc: IDocument, url: string) {
        if (!checkIsBlobUrl(url)) {
            return;
        }
        const list = this.blobUrls.get(doc);
        if (!list) {
            this.blobUrls.set(doc, [url]);
            return;
        }
        if (list.indexOf(url) < 0) {
            list.push(url);
        }
    }

    private revokeDocumentBlobUrls(doc: IDocument) {
        const urls = this.blobUrls.get(doc);
        if (!urls) {
            return;
        }
        for (const url of urls) {
            this.revokeObjectURL(url);
        }
        this.blobUrls.delete(doc);
    }

    private removeTrackedBlobUrl(doc: IDocument, url: string) {
        const list = this.blobUrls.get(doc);
        if (!list) {
            return;
        }
        const next = list.filter((item) => item != url);
        if (next.length == 0) {
            this.blobUrls.delete(doc);
            return;
        }
        this.blobUrls.set(doc, next);
    }

    private onImageElementsVisible = async (map: Map<IHtmlDocument, Element[]>) => {
        if (this.isDisposed) {
            return;
        }
        for (const [doc, elements] of map.entries()) {
            if (this.isDisposed) {
                return;
            }
            await this.loadImages(doc, elements);
        }
    };

    private delayLoadOnImageElementsVisible = asyncDebounce(this.onImageElementsVisible, 100);

    private onLayoutChange = async () => {
        await this.delayResetAllImageSize();
    };

    private onDocumentLoad = async (doc: IDocument) => {
        if (this.isDisposed) {
            return;
        }
        await this.resetImageSize(doc);
    };

    private resetAllImageSize = async () => {
        if (this.isDisposed) {
            return;
        }
        for (const doc of this.documentsProvider.getLoadedDocuments()) {
            if (this.isDisposed) {
                return;
            }
            await this.resetImageSize(doc);
        }
    };

    private delayResetAllImageSize = asyncDebounce(this.resetAllImageSize, 100);

    /**
     * Preprocess document images (placeholder, size probing, inline styles).
     * Intended to be registered on documentPreprocesses.
     */
    async preprocessImages(doc: IDocument): Promise<void> {
        const htmlDocument = doc as IHtmlDocument;
        const ownerDocument = (await htmlDocument.getVirtualContentContainer())?.ownerDocument;
        if (!ownerDocument) {
            return;
        }
        await this.prepareImageSize(htmlDocument, ownerDocument);
        this.setImagePreviewUrl(ownerDocument);
        this.applyOnlyOneImageStyles(ownerDocument);
    }

    private setImagePreviewUrl(virtualDocument: Document) {
        const images = collectImageElements(virtualDocument);
        for (const image of images) {
            this.applyPreviewUrl(image, this.getImageUrl(image));
        }
    }

    private applyPreviewUrl(element: ImageElement, imageUrl: string) {
        const width = parseNumber(element.getAttribute("data-width"), 0);
        const height = parseNumber(element.getAttribute("data-height"), 0);
        const sizedPlaceholderUrl = createHtmlPlaceholderImageUrl(width, height);
        let previewUrl = element.getAttribute("data-preview-src");
        if (isDefaultPlaceholderUrl(previewUrl)) {
            previewUrl = sizedPlaceholderUrl;
            element.setAttribute("data-preview-src", sizedPlaceholderUrl);
        }

        if (!isNullOrWhiteSpace(imageUrl) && !isDefaultPlaceholderUrl(imageUrl)) {
            const currentDataSrc = element.getAttribute("data-src");
            if (isNullOrWhiteSpace(currentDataSrc) || !isDefaultPlaceholderUrl(currentDataSrc)) {
                element.setAttribute("data-src", imageUrl);
            }
        }

        this.setImageSource(element, previewUrl);
        element.setAttribute("data-preset-preview-url", "true");
        this.setImageStyle(element);
    }

    private setImageSource(element: ImageElement, url: string) {
        if (compareTagName(element.tagName, "IMG")) {
            (element as HTMLImageElement).src = url;
            return;
        }
        if (BrowserCapabilities.isSafari()) {
            (element as SVGImageElement).href.baseVal = url;
            return;
        }
        element.setAttribute("xlink:href", url);
    }

    private setImageStyle(element: ImageElement) {
        const parent = element.parentElement;
        if (parent && parent.children.length == 1 && isNullOrWhiteSpace(parent.innerText)) {
            if (!BrowserCapabilities.supportCssHas()) {
                parent.classList.add(HtmlSettings.BreakInsideAvoid);
            }
            parent.style.removeProperty("width");
            parent.style.removeProperty("height");
        }
    }

    private async prepareImageSize(doc: IHtmlDocument, virtualDocument: Document): Promise<void> {
        injectCssContent(virtualDocument, SVG_STYLE, false, "lhx-svg-style");
        if (this.checkIsOnlyOneImageInDocument(virtualDocument)) {
            injectCssContent(virtualDocument, ONLY_ONE_IMAGE_STYLE, false, "only-one-image");
        }

        const images = collectImageElements(virtualDocument);
        const sizeMap = this.getImageSizeMap(doc);
        const cachedSizes = await this.loadImageSizes(doc);
        if (cachedSizes) {
            for (const item of cachedSizes) {
                if (!isNullOrWhiteSpace(item.url) && item.width > 0) {
                    sizeMap.set(item.url, item);
                }
            }
        }

        const requireEmitProgress = images.length > 100;
        for (let i = 0; i < images.length; i++) {
            if (this.isDisposed) {
                return;
            }
            try {
                const image = images[i];
                if (image.parentElement && compareTagName(image.parentElement.tagName, "SVG")) {
                    image.parentElement.classList.add(SVG_STYLE_CLASS);
                }
                const imageUrl = this.getImageUrl(image);
                let imageSize = imageUrl ? sizeMap.get(imageUrl) : undefined;
                if (!imageSize) {
                    imageSize = await this.prefetchImageSize(doc, image);
                }
                if (imageSize) {
                    this.resetImageStyles(image, imageSize.width, imageSize.height);
                    this.resetInlineImageSize(image);
                }
                if (requireEmitProgress && i % 10 == 0) {
                    this.events.emit(EventNames.ProcessedImageCount, {
                        doc,
                        totalImageCount: images.length,
                        processedImageCount: i,
                    });
                    await yieldToMain();
                }
            } catch (e) {
                this.logger.error(e);
            }
        }
        let imageSizes = Array.from(sizeMap.values()).filter((x) => x.width > 0 && !isNullOrWhiteSpace(x.url));
        if (imageSizes.length > 0) {
            if (cachedSizes && cachedSizes.length > 0) {
                const urls = new Set(cachedSizes.map((x) => x.url));
                const diff = imageSizes.filter((x) => !urls.has(x.url));
                if (diff.length > 0) {
                    //only persist the new image sizes
                    await this.persistImageSizes(doc, diff);
                }
                return;
            }
            //persist all image sizes
            await this.persistImageSizes(doc, imageSizes);
        }
    }

    async loadImageSizes(doc: IDocument): Promise<ImageSizeDescriptor[]> {
        return [];
    }

    async persistImageSizes(doc: IDocument, sizes: ImageSizeDescriptor[]): Promise<void> {
        //do nothing
    }

    private getImageSizeMap(doc: IDocument): Map<string, ImageSizeDescriptor> {
        let sizeMap = this.documentImageSizeMaps.get(doc);
        if (!sizeMap) {
            sizeMap = new Map();
            this.documentImageSizeMaps.set(doc, sizeMap);
        }
        return sizeMap;
    }

    private getImageUrl(image: ImageElement): string {
        const useDataSrc = image.getAttribute("data-preset-preview-url") == "true";
        if (isSvgImageElement(image)) {
            if (useDataSrc) {
                return image.getAttribute("data-src")
                    ?? image.getAttribute("xlink:href")
                    ?? image.getAttribute("href")
                    ?? "";
            }
            return image.getAttribute("xlink:href") ?? image.getAttribute("href") ?? "";
        }
        if (useDataSrc) {
            return image.getAttribute("data-src") ?? "";
        }
        return image.getAttribute("src") ?? "";
    }

    private async prefetchImageSize(doc: IHtmlDocument, image: ImageElement) {
        const imageUrl = this.getImageUrl(image);
        if (isNullOrWhiteSpace(imageUrl)) {
            return undefined;
        }

        const imageWidth = image.getAttribute("data-width");
        if (imageWidth != null) {
            const width = parseNumber(imageWidth, 0);
            const height = parseNumber(image.getAttribute("data-height"), 0);
            return this.addImageDescriptor(doc, imageUrl, width, height);
        }

        const cached = this.getImageSizeMap(doc).get(imageUrl);
        if (cached) {
            return cached;
        }

        let width = 0;
        let height = 0;
        try {
            if (checkIsAbsoluteUrl(imageUrl)) {
                const imageSize = await getImageSize(imageUrl);
                width = imageSize.width;
                height = imageSize.height;
            } else {
                const blob = await doc.fileParser.getFile(imageUrl, doc.url, "blob");
                const data = blob && blob.size > 0 ? blob : errorImageUrl;
                try {
                    const imageSize = await getImageSize(data);
                    width = imageSize.width;
                    height = imageSize.height;
                } catch {
                    // keep 0
                }
            }
        } catch (e) {
            this.logger.error(e);
        }

        return this.addImageDescriptor(doc, imageUrl, width, height);
    }

    private revokeObjectURL(imageUrl: string, doc?: IDocument) {
        if (!checkIsBlobUrl(imageUrl)) {
            return;
        }
        try {
            URL.revokeObjectURL(imageUrl);
        } catch {
            // ignore
        }
        if (doc) {
            this.removeTrackedBlobUrl(doc, imageUrl);
        }
    }

    private addImageDescriptor(doc: IDocument, imageUrl: string, width: number, height: number): ImageSizeDescriptor {
        const sizeMap = this.getImageSizeMap(doc);
        const descriptor = sizeMap.get(imageUrl) ?? { url: imageUrl, width, height };
        descriptor.url = imageUrl;
        descriptor.width = width;
        descriptor.height = height;
        sizeMap.set(imageUrl, descriptor);
        return descriptor;
    }

    private setWidthAndHeight(image: ImageElement, width: number, height: number) {
        if (width > 0 && height > 0) {
            const imageWidth = parseNumber(image.getAttribute("data-width"), 0, "parseInt");
            if (imageWidth <= 0) {
                image.setAttribute("data-width", `${width}`);
                image.setAttribute("data-height", `${height}`);
            }
        }
    }

    private getColumnMetrics(): { columnWidth: number; columnHeight: number } {
        const metrics = this.rendererViewport.getLayoutMetrics();
        return {
            columnWidth: metrics.columnWidth,
            columnHeight: metrics.columnHeight,
        };
    }

    private resetImageStyles(image: ImageElement, width: number, height: number) {
        if (width <= 0 || height <= 0 || !BrowserCapabilities.supportCssAspectRatio()) {
            return;
        }
        this.setWidthAndHeight(image, width, height);
        const targetElement: HTMLElement | null = isSvgImageElement(image)
            ? image.parentElement
            : image as HTMLElement;
        if (!targetElement) {
            return;
        }
        targetElement.setAttribute("width", `${width}`);
        targetElement.setAttribute("height", `${height}`);
        const widthValue = `calc(100% * var(${ContentLayoutCssVariableNames.MaxImageWidthRatio}))`;
        const maxHeightValue = `min(${height}px,var(${ContentLayoutCssVariableNames.ColumnHeight}),calc(var(${ContentLayoutCssVariableNames.ColumnWidth}) / ${width} * ${height}))`;
        applyStyles(targetElement, {
            width: widthValue,
            height: "auto",
            "max-width": widthValue,
            "max-height": maxHeightValue,
            "aspect-ratio": `${width} / ${height}`,
        });
    }

    private resetImageWidthHeight(image: ImageElement, columnWidth: number, columnHeight: number) {
        applyStyles(image, {
            width: "auto",
            "max-width": "100%",
            "max-height": "100%",
        }, true);
        this.resetImageHeight(image, columnWidth, columnHeight, this.htmlOptions.maxImageHeightRatio);
    }

    private async resetImageSize(doc: IDocument) {
        const ownerDocument = doc.getContentContainer()?.ownerDocument;
        if (!ownerDocument || !getDocumentBody(ownerDocument)) {
            return;
        }
        const { columnWidth, columnHeight } = this.getColumnMetrics();
        const onlyImage = this.getOnlyImageInDocument(ownerDocument);
        if (onlyImage) {
            this.handleOnlyOneImageInDocument(columnWidth, columnHeight, onlyImage);
            await this.loadSingleImage(doc as IHtmlDocument, onlyImage);
            return;
        }
        const images = collectImageElements(ownerDocument);

        if (!BrowserCapabilities.supportCssAspectRatio()) {
            for (const image of images) {
                if (this.isDisposed) {
                    return;
                }
                this.resetImageWidthHeight(image, columnWidth, columnHeight);
                await yieldToMain();
            }
        }

        for (let i = 0; i < Math.min(PRELOAD_IMAGE_COUNT, images.length); i++) {
            if (this.isDisposed) {
                return;
            }
            await this.loadSingleImage(doc as IHtmlDocument, images[i]);
        }
    }

    private resetInlineImageSize(element: ImageElement) {
        const width = parseNumber(element.getAttribute("data-width"), 0);
        const height = parseNumber(element.getAttribute("data-height"), 0);
        if (width <= 0 || height <= 0) {
            return;
        }

        if (height > 200) {
            const hasAdjacentText =
                (element.previousSibling?.nodeType == Node.TEXT_NODE && (element.previousSibling.textContent?.trim()?.length ?? 0) > 0)
                || (element.nextSibling?.nodeType == Node.TEXT_NODE && (element.nextSibling.textContent?.trim()?.length ?? 0) > 0);
            if (!hasAdjacentText) {
                return;
            }
        }
        if (!this.isInlineImage(element)) {
            return;
        }

        const targetElement = compareTagName(element.tagName, "IMG")
            ? (element as HTMLImageElement)
            : element.parentElement;
        if (!targetElement) {
            return;
        }

        applyStyles(element, {
            width: "auto",
            "max-width": "100%",
            height: "1em",
            "margin-block-start": "0",
            "margin-block-end": "0",
        }, true);
        targetElement.style.setProperty("vertical-align", "-0.2em", "important");
        targetElement.setAttribute("data-inline-image", "true");
    }

    private applyOnlyOneImageStyles(ownerDocument: Document) {
        const onlyImage = this.getOnlyImageInDocument(ownerDocument);
        if (!onlyImage) {
            return;
        }
        const { columnWidth, columnHeight } = this.getColumnMetrics();
        this.handleOnlyOneImageInDocument(columnWidth, columnHeight, onlyImage);
    }

    private handleOnlyOneImageInDocument(
        columnWidth: number,
        columnHeight: number,
        element: ImageElement
    ) {
        const ownerDocument = element.ownerDocument;
        const body = getDocumentBody(ownerDocument);
        if (!body) {
            return;
        }
        injectCssContent(ownerDocument, ONLY_ONE_IMAGE_STYLE, false, "only-one-image");
        body.setAttribute("data-handled-one-image", "true");
        applyStyles(body, {
            display: "flex",
            height: "100%",
            "justify-content": "center",
            "align-items": "center",
        }, true);

        this.clearPercentageSizeAttributes(element);
        let targetElement: HTMLElement = element as HTMLImageElement;
        if (compareTagName(element.parentElement?.tagName, "SVG")) {
            targetElement = element.parentElement;
            this.clearPercentageSizeAttributes(targetElement);
            applyStyles(element, {
                width: "auto",
                "max-width": "100%",
                "max-height": columnHeight + "px",
                display: "block",
            }, true);
        }
        applyStyles(targetElement, {
            width: "auto",
            "max-width": "100%",
            display: "block",
        }, true);
        if (targetElement.parentElement) {
            targetElement.parentElement.style.textAlign = "center";
        }
        this.resetImageHeight(element, columnWidth, columnHeight, 0.95, true);
    }

    private clearPercentageSizeAttributes(element: Element) {
        for (const name of ["width", "height"]) {
            const value = element.getAttribute(name);
            if (value && value.includes("%")) {
                element.removeAttribute(name);
            }
        }
    }

    private resetImageHeight(
        element: ImageElement,
        columnWidth: number,
        columnHeight: number,
        maxImageHeightRatio: number,
        preferRatioNumber?: boolean
    ) {
        const targetElement: HTMLElement | SVGElement | null = isSvgImageElement(element)
            ? element.parentElement
            : element;
        if (!targetElement) {
            return;
        }
        const { width, height } = this.getImageIntrinsicSize(element);
        if (width <= 0 || height <= 0) {
            return;
        }
        this.setWidthAndHeight(element, width, height);
        this.forceSetImageHeight(targetElement, columnWidth, columnHeight, width, height, maxImageHeightRatio, preferRatioNumber);
    }

    private forceSetImageHeight(
        element: HTMLElement | SVGElement,
        columnWidth: number,
        columnHeight: number,
        width: number,
        height: number,
        maxImageHeightRatio: number,
        preferRatioNumber?: boolean
    ) {
        if (BrowserCapabilities.supportCssMinMaxFunction()) {
            const ratio = preferRatioNumber && maxImageHeightRatio
                ? `${maxImageHeightRatio}`
                : `var(${ContentLayoutCssVariableNames.MaxImageHeightRatio})`;
            const styleValue = `min(calc(${height}px * ${ratio}),calc(var(${ContentLayoutCssVariableNames.ColumnHeight}) * ${ratio}),calc(var(${ContentLayoutCssVariableNames.ColumnWidth}) / ${width} * ${height} * ${ratio}))`;
            element.style.setProperty("height", styleValue, "important");
            return;
        }
        const actualHeight = this.calcImageHeight(columnWidth, columnHeight, width, height) * maxImageHeightRatio;
        element.style.setProperty("height", actualHeight + "px", "important");
    }

    private calcImageHeight(columnWidth: number, columnHeight: number, width: number, height: number) {
        if (columnHeight >= height && columnWidth >= width) {
            return height;
        }
        const columnRatio = columnWidth / columnHeight;
        const imageRatio = width / height;
        if (columnRatio <= imageRatio) {
            return (columnWidth / width) * height;
        }
        return columnHeight;
    }

    private getImageIntrinsicSize(element: ImageElement): { width: number; height: number } {
        const attrWidth = parseNumber(element.getAttribute("data-width"), 0);
        const attrHeight = parseNumber(element.getAttribute("data-height"), 0);
        if (attrWidth > 0 && attrHeight > 0) {
            return { width: attrWidth, height: attrHeight };
        }
        if (!isSvgImageElement(element)) {
            const image = element as HTMLImageElement;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                return { width: image.naturalWidth, height: image.naturalHeight };
            }
        }
        return { width: 0, height: 0 };
    }

    private hasNonImageText(root: Element): boolean {
        const ownerDocument = root.ownerDocument;
        if (!ownerDocument) {
            return !!root.textContent?.trim();
        }
        const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode();
        while (current) {
            if (current.textContent?.trim()) {
                return true;
            }
            current = walker.nextNode();
        }
        return false;
    }

    private getOnlyImageInDocument(ownerDocument: Document): ImageElement | undefined {
        const body = getDocumentBody(ownerDocument);
        if (!body) {
            return undefined;
        }
        const images = collectImageElements(body);
        if (images.length != 1) {
            return undefined;
        }
        if (!body.classList.contains("lhx-text-empty") && this.hasNonImageText(body)) {
            return undefined;
        }
        return images[0];
    }

    private checkIsOnlyOneImageInDocument(ownerDocument: Document): boolean {
        return !!this.getOnlyImageInDocument(ownerDocument);
    }

    private checkIsInlineTag(node: Node) {
        const nodeName = node.nodeName;
        if (isNullOrWhiteSpace(nodeName)) {
            return false;
        }
        return this.htmlOptions.htmlInlineTags.indexOf(nodeName.toLowerCase()) >= 0;
    }

    private isInlineImage(element: ImageElement): boolean {
        if (this.hasInlineSiblings(element)) {
            return true;
        }
        let parentElement = element.parentElement;
        let lastElement: Element = element;
        while (parentElement && !compareTagName(parentElement.tagName, "BODY")) {
            if (parentElement.children.length > 1 || (parentElement.children.length == 1 && parentElement.textContent.trim().length > 0)) {
                return this.hasInlineSiblings(lastElement);
            }
            lastElement = parentElement;
            parentElement = parentElement.parentElement;
        }
        return false;
    }

    private findSiblingNodes(element: Element) {
        let previousSiblingNode: Node = element.previousSibling;
        let nextSiblingNode: Node = element.nextSibling;
        while (previousSiblingNode != null) {
            if (!isNullOrWhiteSpace(previousSiblingNode.textContent)) {
                break;
            }
            if (previousSiblingNode.nodeType == Node.ELEMENT_NODE) {
                break;
            }
            previousSiblingNode = previousSiblingNode.previousSibling;
        }
        while (nextSiblingNode != null) {
            if (!isNullOrWhiteSpace(nextSiblingNode.textContent)) {
                break;
            }
            if (nextSiblingNode.nodeType == Node.ELEMENT_NODE) {
                break;
            }
            nextSiblingNode = nextSiblingNode.nextSibling;
        }
        return { previousSiblingNode, nextSiblingNode };
    }

    private hasInlineSiblings(element: Element) {
        const { previousSiblingNode, nextSiblingNode } = this.findSiblingNodes(element);
        if (!previousSiblingNode && !nextSiblingNode) {
            return false;
        }
        if (previousSiblingNode?.nodeType == Node.TEXT_NODE && !isNullOrWhiteSpace(previousSiblingNode.nodeValue)) {
            return true;
        }
        if (nextSiblingNode?.nodeType == Node.TEXT_NODE && !isNullOrWhiteSpace(nextSiblingNode.nodeValue)) {
            return true;
        }
        return (previousSiblingNode && this.checkIsInlineTag(previousSiblingNode))
            || (nextSiblingNode && this.checkIsInlineTag(nextSiblingNode));
    }

    async loadImages(doc: IDocument, visibleElements: Element[]): Promise<void> {
        const htmlDocument = doc as IHtmlDocument;
        if (!htmlDocument || !visibleElements?.length) {
            return;
        }
        for (const element of visibleElements) {
            if (this.isDisposed || !element) {
                return;
            }
            const currentWindow = element.ownerDocument.defaultView;
            if (!currentWindow) {
                continue;
            }
            if (element instanceof currentWindow.HTMLImageElement || element instanceof currentWindow.SVGImageElement) {
                const originElement = this.queryOriginElement(element.ownerDocument, element);
                if (originElement) {
                    await this.loadSingleImage(htmlDocument, originElement);
                }
                continue;
            }
            const imgs = element.getElementsByTagName("img");
            for (let i = 0; i < imgs.length; i++) {
                await this.loadSingleImage(htmlDocument, imgs[i]);
            }
            const svgHost = this.queryOriginElement(doc.getContentContainer(), element) ?? element;
            const svgImages = (svgHost != element
                ? svgHost.getElementsByTagName("image")
                : element.getElementsByTagName("image")) as HTMLCollectionOf<SVGImageElement>;
            for (let i = 0; i < svgImages.length; i++) {
                await this.loadSingleImage(htmlDocument, svgImages[i]);
            }
        }
    }

    private queryOriginElement(root: ParentNode | null | undefined, element: Element): ImageElement | null {
        const initialNumber = element.getAttribute(ElementInitialNumberName);
        if (!root || isNullOrWhiteSpace(initialNumber)) {
            return element as ImageElement;
        }
        return (root.querySelector(`[${ElementInitialNumberName}='${initialNumber}']`) as ImageElement | null)
            ?? (element as ImageElement);
    }

    private async loadSingleImage(doc: IHtmlDocument, element: ImageElement): Promise<void> {
        if (!element || !doc || this.isDisposed) {
            return;
        }
        const loadState = element.getAttribute("data-load-state");
        if (loadState == "loaded" || loadState == "loading" || loadState == "fail") {
            return;
        }
        const originUrl = this.getImageUrl(element);
        if (isNullOrWhiteSpace(originUrl)) {
            element.setAttribute("data-load-state", "fail");
            return;
        }
        element.setAttribute("data-load-state", "loading");
        element.onload = () => {
            element.setAttribute("data-load-state", "loaded");
            this.applyOnlyOneImageStyles(element.ownerDocument);
        };
        element.onerror = () => {
            element.setAttribute("data-load-state", "fail");
        };

        const imageUrl = await this.resolveLoadUrl(doc, originUrl, element);
        if (this.isDisposed) {
            this.revokeObjectURL(imageUrl, doc);
            return;
        }

        if (compareTagName(element.tagName, "IMG")) {
            const imgElement = element as HTMLImageElement;
            imgElement.src = imageUrl;
            if (imgElement.decode) {
                try {
                    await imgElement.decode();
                } catch (e) {
                    this.logger.error("image decode failed", "imageUrl", imageUrl, e);
                    this.revokeObjectURL(imageUrl, doc);
                    this.retryLoadAfterDecodeFailure(doc, imgElement, originUrl);
                    return;
                }
            }
            this.applyOnlyOneImageStyles(element.ownerDocument);
            return;
        }
        this.setImageSource(element, imageUrl);
        this.applyOnlyOneImageStyles(element.ownerDocument);
    }

    private retryLoadAfterDecodeFailure(doc: IHtmlDocument, imgElement: HTMLImageElement, originUrl: string) {
        setTimeout(async () => {
            if (this.isDisposed) {
                return;
            }
            try {
                const blob = await doc.fileParser.getFile(originUrl, doc.url, "blob");
                if (this.isDisposed) {
                    return;
                }
                if (blob && blob.size > 0) {
                    const retryUrl = URL.createObjectURL(blob);
                    this.addBlobUrl(doc, retryUrl);
                    imgElement.src = retryUrl;
                } else {
                    imgElement.src = errorImageUrl;
                }
            } catch (retryError) {
                this.logger.error(retryError);
                if (!this.isDisposed) {
                    imgElement.src = errorImageUrl;
                }
            }
        }, 500);
    }

    private async resolveLoadUrl(doc: IHtmlDocument, originUrl: string, element: ImageElement): Promise<string> {
        if (checkIsAbsoluteUrl(originUrl)) {
            return originUrl;
        }
        const blob = await doc.fileParser.getFile(originUrl, doc.url, "blob");
        if (!blob || blob.size <= 0) {
            return errorImageUrl;
        }
        if (blob.type?.toLowerCase() == "image/svg+xml") {
            return await this.resolveSvgBlobUrl(doc, blob, element);
        }
        const blobUrl = URL.createObjectURL(blob);
        this.addBlobUrl(doc, blobUrl);
        return blobUrl;
    }

    private async resolveSvgBlobUrl(doc: IHtmlDocument, blob: Blob, element: ImageElement): Promise<string> {
        const svgXml = convertArrayBufferToString(await blob.arrayBuffer());
        const svgDoc = getFormatDocument(svgXml);
        const svgImage = svgDoc.querySelector("image");
        if (!svgImage) {
            return "data:image/svg+xml," + encodeURIComponent(svgXml);
        }
        const nestedUrl = svgImage.getAttribute("xlink:href") ?? svgImage.getAttribute("href") ?? "";
        if (isNullOrWhiteSpace(nestedUrl)) {
            return "data:image/svg+xml," + encodeURIComponent(svgXml);
        }

        let sizeSource: ImageBitmapSource | string = nestedUrl;
        let resolvedUrl = nestedUrl;
        if (!checkIsAbsoluteUrl(nestedUrl)) {
            const nestedBlob = await doc.fileParser.getFile(nestedUrl, doc.url, "blob");
            if (!nestedBlob || nestedBlob.size <= 0) {
                return errorImageUrl;
            }
            resolvedUrl = URL.createObjectURL(nestedBlob);
            this.addBlobUrl(doc, resolvedUrl);
            sizeSource = nestedBlob;
        }

        try {
            const imageSize = await getImageSize(sizeSource);
            element.setAttribute("data-width", imageSize.width.toString());
            element.setAttribute("data-height", imageSize.height.toString());
            const { columnWidth, columnHeight } = this.getColumnMetrics();
            this.forceSetImageHeight(
                element as HTMLElement,
                columnWidth,
                columnHeight,
                imageSize.width,
                imageSize.height,
                this.htmlOptions.maxImageHeightRatio
            );
        } catch (e) {
            this.logger.error(e);
        }

        return resolvedUrl;
    }

    async dispose(): Promise<void> {
        this.isDisposed = true;
        this.delayLoadOnImageElementsVisible.cancel();
        this.delayResetAllImageSize.cancel();
        this.unbindEvents();
        this.documentImageSizeMaps.clear();
        for (const doc of [...this.blobUrls.keys()]) {
            this.revokeDocumentBlobUrls(doc);
        }
        this.blobUrls.clear();
    }
}
