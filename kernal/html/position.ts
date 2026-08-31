export class ElementPositionResult {
    /**
     * constructor
     * @param element The element in the document.
     * @param index The index of the element in the document.
     * @param offset The internal symbol offset of the element.
     */
    constructor(public readonly element: Element, public readonly index: number, public readonly offset: number) { }
}
