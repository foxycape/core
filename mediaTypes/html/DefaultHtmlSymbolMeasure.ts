import { ElementInitialNumberName, ROOT_IDX } from "../../kernal/Constants"
import { getUuid } from "../../kernal/common/uuid"
import {
    checkIsOtherNonWhiteSpaceSymbol,
    compareTagName,
    getAllNodes,
    getDocumentBody,
    getElementByNameAndIndex,
    getElementIndex,
} from "../../kernal/html/finder"
import { ElementPositionResult } from "../../kernal/html/position"
import { getPureInnerTextLength } from "../../kernal/html/text"
import { SymbolOffset } from "../../kernal/html/types"
import type { SymbolType, TagDescriptor } from "../../kernal/types"
import type { IHtmlSymbolMeasure } from "./IHtmlSymbolMeasure"

const DEFAULT_MEDIA_SYMBOL_TAG_NAMES = ["object", "svg", "embed", "audio", "video", "canvas", "img"]

const symbolOffsetsIdMap = new Map<Document | Element, string>()
const symbolOffsetsMap = new Map<string, SymbolOffset[]>()

const toElement = (root: Document | Element) =>
    root.ownerDocument ? root as Element : getDocumentBody(root as Document)

const checkContainsPureTextNode = (rootElement: Document | Element) => {
    const element = toElement(rootElement)
    const nodes = element.childNodes
    for (const node of nodes) {
        if (node.nodeType == Node.TEXT_NODE && node.textContent?.trim()) {
            return true
        }
    }
    return false
}

const getOtherNonWhiteSpaceSymbolCount = (element: Element) => {
    let otherSymbolCount = 0
    for (const tagName of DEFAULT_MEDIA_SYMBOL_TAG_NAMES) {
        otherSymbolCount += element.getElementsByTagName(tagName).length
    }
    return otherSymbolCount
}

const calcSymbolOffsets = (rootElement: Document | Element, symbolType: SymbolType) => {
    let rootElementId = symbolOffsetsIdMap.get(rootElement)
    if (!rootElementId) {
        rootElementId = getUuid()
        symbolOffsetsIdMap.set(rootElement, rootElementId)
    }
    const key = `${symbolType}${rootElementId}`
    const element = toElement(rootElement)
    const existSymbolOffsets = symbolOffsetsMap.get(key)
    if (existSymbolOffsets) {
        if (existSymbolOffsets.length == element.getElementsByTagName("*").length + 1) {
            return existSymbolOffsets
        }
    }

    const symbolOffsets: SymbolOffset[] = []
    let startOffset = 0
    const nodes = getAllNodes(element)
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (node.nodeType == Node.ELEMENT_NODE) {
            const currentElement = node as Element
            symbolOffsets.push(new SymbolOffset(currentElement, startOffset))
            if (symbolType == "custom") {
                if (checkIsOtherNonWhiteSpaceSymbol(currentElement.tagName, DEFAULT_MEDIA_SYMBOL_TAG_NAMES)) {
                    startOffset += 1
                }
            }
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            startOffset += getPureInnerTextLength(node)
        }
    }
    const newSymbolOffsets = symbolOffsets.reverse()
    symbolOffsetsMap.set(key, newSymbolOffsets)
    return newSymbolOffsets
}

export class DefaultHtmlSymbolMeasure implements IHtmlSymbolMeasure {
    readonly defaultSymbolType: SymbolType = "custom"

    count = (root: Document | Element, symbolType?: SymbolType) => {
        const type = symbolType ?? this.defaultSymbolType
        const element = toElement(root)
        let totalCount = getPureInnerTextLength(element)
        if (type == "custom") {
            totalCount += getOtherNonWhiteSpaceSymbolCount(element)
        }
        return totalCount
    }

    getElementByProgress = (
        root: Document | Element,
        progress: number,
        symbolType?: SymbolType,
    ) => {
        const type = symbolType ?? this.defaultSymbolType
        const ratio = progress ?? 0
        const elementPosition = Math.ceil(this.count(root, type) * ratio)
        return this.getElementByPosition(root, elementPosition, type)
    }

    getProgressByElement = (
        root: Document | Element,
        element: TagDescriptor | Element,
        symbolType?: SymbolType,
        internalSymbolOffset?: number,
    ) => {
        const type = symbolType ?? this.defaultSymbolType
        const totalSymbolCount = this.count(root, type)
        const position = this.getPositionByElement(root, element, type, internalSymbolOffset)
        return position / totalSymbolCount
    }

    getPositionByElement = (
        root: Document | Element,
        tag: TagDescriptor | Element,
        symbolType?: SymbolType,
        internalSymbolOffset?: number,
    ) => {
        const type = symbolType ?? this.defaultSymbolType
        let element: Element
        if ((tag as TagDescriptor).tagIndex >= 0) {
            const tagObj = tag as TagDescriptor
            element = getElementByNameAndIndex(root, tagObj.tagName, tagObj.tagIndex ?? 0)
        }
        else {
            element = tag as Element
        }
        if (!element) {
            return -1
        }
        const symbolOffsets = calcSymbolOffsets(root, type)
        const symbolOffset = symbolOffsets.find(x => x.element == element)
        const symbolCount = symbolOffset ? symbolOffset.offset : -1
        return symbolCount + (internalSymbolOffset ?? 0)
    }

    getElementByPosition = (
        root: Document | Element,
        symbolPosition: number,
        symbolType?: SymbolType,
        preferEnd?: boolean,
    ) => {
        const type = symbolType ?? this.defaultSymbolType
        const symbolOffsets = calcSymbolOffsets(root, type)
        let symbolOffsetIndex = symbolOffsets.findIndex(x => symbolPosition >= x.offset)
        if (symbolOffsetIndex < 0) {
            return null
        }

        let symbolOffset = symbolOffsets[symbolOffsetIndex]
        if (!symbolOffset.element.getAttribute(ElementInitialNumberName)) {
            const maxSymbolOffsetsIndex = symbolOffsets.length - 1
            while (symbolOffsetIndex < maxSymbolOffsetsIndex) {
                symbolOffsetIndex++
                symbolOffset = symbolOffsets[symbolOffsetIndex]
                if (symbolOffset.element.getAttribute(ElementInitialNumberName)) {
                    break
                }
            }
        }
        let textOffset: number
        let diff = symbolPosition - symbolOffset.offset
        let currentElementSymbolCount = this.count(symbolOffset.element, type)
        if (diff == 0 && preferEnd) {
            if (symbolOffsetIndex < symbolOffsets.length - 1) {
                symbolOffset = symbolOffsets[symbolOffsetIndex + 1]
            }
        }
        diff = symbolPosition - symbolOffset.offset
        currentElementSymbolCount = this.count(symbolOffset.element, type)
        if (diff > currentElementSymbolCount) {
            if (symbolOffsetIndex == 0) {
                textOffset = currentElementSymbolCount
            }
            else {
                symbolOffset = symbolOffsets.find(x => x.element == symbolOffset.element.parentElement)
                if (!symbolOffset) {
                    if (checkContainsPureTextNode(root)) {
                        symbolOffset = new SymbolOffset(toElement(root), 0)
                    }
                    else {
                        symbolOffset = symbolOffsets[symbolOffsetIndex - 1]
                    }
                }

                if (!checkContainsPureTextNode(root)) {
                    if (type == "char" && compareTagName(symbolOffset.element.tagName, "BODY")) {
                        const previousSymbolOffset = symbolOffsets[symbolOffsetIndex - 1]
                        if (previousSymbolOffset && previousSymbolOffset.offset >= symbolPosition) {
                            symbolOffset = previousSymbolOffset
                        }
                    }
                }
            }
        }
        if (!checkContainsPureTextNode(root)) {
            if (type == "char" && compareTagName(symbolOffset.element.tagName, "BODY")) {
                const children = symbolOffset.element.children
                let validElement: Element
                for (let i = 0; i < children.length; i++) {
                    if (!DEFAULT_MEDIA_SYMBOL_TAG_NAMES.includes(children[i].tagName.toLowerCase())) {
                        validElement = children[i]
                        break
                    }
                }
                if (validElement) {
                    return new ElementPositionResult(validElement, 0, 0)
                }
            }
        }
        if (textOffset === undefined) {
            textOffset = symbolPosition - symbolOffset.offset
            if (textOffset < 0) {
                textOffset = 0
            }
            else if (type == "char") {
                currentElementSymbolCount = getPureInnerTextLength(symbolOffset.element)
                let parentWalkGuard = 0
                while (textOffset > currentElementSymbolCount && parentWalkGuard < 256) {
                    parentWalkGuard++
                    const parentSymbolOffset = symbolOffsets.find(x => x.element === symbolOffset.element.parentElement)
                    if (!parentSymbolOffset) {
                        textOffset = currentElementSymbolCount
                        break
                    }
                    symbolOffset = parentSymbolOffset
                    currentElementSymbolCount = getPureInnerTextLength(symbolOffset.element)
                    textOffset = symbolPosition - symbolOffset.offset
                    if (textOffset < 0) {
                        textOffset = 0
                        break
                    }
                }
                if (textOffset > currentElementSymbolCount) {
                    textOffset = currentElementSymbolCount
                }
            }
        }
        let tagIndex = getElementIndex(root, symbolOffset.element)
        if (tagIndex == -1 && compareTagName(symbolOffset.element.tagName, "BODY")) {
            tagIndex = ROOT_IDX
        }
        return new ElementPositionResult(symbolOffset.element, tagIndex, textOffset)
    }
}

export const defaultHtmlSymbolMeasure = new DefaultHtmlSymbolMeasure()
