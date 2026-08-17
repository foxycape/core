import { Direction, FlipMode, WritingMode } from "../../../../kernal";
import { IHtmlDocument } from "../IHtmlDocument";

export interface IHtmlRendererLayout {
    /**Apply styles to the renderer and documents */
    applyStyles(): Promise<void>;
    /**Apply styles to a document */
    applyDocStyles(doc: IHtmlDocument): Promise<void>;
    /**Change layout options (only provided fields are applied) */
    changeLayout(options: HtmlChangeLayoutOptions): Promise<void>;
}

export type ColumnOptions = {
    columns: number;
    autoColumns: boolean;
}

export type HtmlChangeLayoutOptions = {
    flipMode?: FlipMode;
    columns?: ColumnOptions;
    writingMode?: WritingMode;
    direction?: Direction;
}
