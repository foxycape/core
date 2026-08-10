import { FlipMode } from "../../../../kernal";
import { IHtmlDocument } from "../IHtmlDocument";

export interface IHtmlRendererLayout {
    applyCssVariables(): Promise<void>;
    injectColumnStyles(doc:IHtmlDocument): Promise<void>;
    changeFlipMode(flipMode: FlipMode): Promise<void>;
    changeColumns(columnOptions: ColumnOptions): Promise<void>;
}

export type ColumnOptions = {
    columns: number;
    autoColumns: boolean;
}