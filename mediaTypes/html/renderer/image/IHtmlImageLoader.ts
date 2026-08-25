import { IDocument, IDisposable } from "../../../../kernal";

export interface IHtmlImageLoader extends IDisposable {
    /** Preprocess document images (placeholder, size probing, inline styles). Hook into documentPreprocesses. */
    preprocessImages(doc: IDocument): Promise<void>;
    /** Load images for the given visible elements. */
    loadImages(doc: IDocument, visibleElements: Element[]): Promise<void>;

    /** Persist image sizes to storage. */
    persistImageSizes(doc: IDocument,sizes: ImageSizeDescriptor[]): Promise<void>;

    /** Load image sizes from storage. */
    loadImageSizes(doc: IDocument): Promise<ImageSizeDescriptor[]>;
}

export type ImageSizeDescriptor = {
    url: string;
    width: number;
    height: number;
};

export type ImageElement = HTMLImageElement | SVGImageElement;
