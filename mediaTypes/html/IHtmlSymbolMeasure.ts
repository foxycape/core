import type { ElementPositionResult } from "../../kernal/html/position"
import type { SymbolType, TagDescriptor } from "../../kernal/types"

/**
 * Stateless chapter symbol measure (parse-time and runtime share one instance).
 * Default implementation hardcodes media tags; hosts may replace the whole algorithm.
 */
export type IHtmlSymbolMeasure = {
    readonly defaultSymbolType: SymbolType
    count: (root: Document | Element, symbolType?: SymbolType) => number
    getElementByPosition: (
        root: Document | Element,
        position: number,
        symbolType?: SymbolType,
        preferEnd?: boolean,
    ) => ElementPositionResult
    getElementByProgress: (
        root: Document | Element,
        progress: number,
        symbolType?: SymbolType,
    ) => ElementPositionResult
    getPositionByElement: (
        root: Document | Element,
        element: TagDescriptor | Element,
        symbolType?: SymbolType,
        internalSymbolOffset?: number,
    ) => number
    getProgressByElement: (
        root: Document | Element,
        element: TagDescriptor | Element,
        symbolType?: SymbolType,
        internalSymbolOffset?: number,
    ) => number
}
