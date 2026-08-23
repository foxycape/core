export const DOCUMENT_HIDDEN_FLAG = "foxycape_document_hidden";
export const DOCUMENT_REQUIRE_RESIZE_FLAG = "foxycape_document_require_resize";

export const isCollapsedSize = (width: number, height: number, treatZeroHeight: boolean): boolean => {
    if (width == 0) {
        return true;
    }
    return treatZeroHeight && height == 0;
};

export const isHostContainerCollapsed = (
    container: HTMLElement | null | undefined,
    treatZeroHeight: boolean
): boolean => {
    if (!container) {
        return false;
    }
    return isCollapsedSize(container.clientWidth, container.clientHeight, treatZeroHeight);
};

export const markDocumentHidden = (container: HTMLElement) => {
    if (container[DOCUMENT_HIDDEN_FLAG]) {
        container[DOCUMENT_REQUIRE_RESIZE_FLAG] = "true";
    }
    container[DOCUMENT_HIDDEN_FLAG] = "true";
};

/**
 * Clear hide flags after the container is shown again.
 * @returns true when this is a hide/show cycle and layout/reload should be skipped.
 */
export const consumeDocumentHiddenRestore = (container: HTMLElement): boolean => {
    if (!container[DOCUMENT_HIDDEN_FLAG]) {
        return false;
    }
    container[DOCUMENT_HIDDEN_FLAG] = undefined;
    if (!container[DOCUMENT_REQUIRE_RESIZE_FLAG]) {
        return true;
    }
    container[DOCUMENT_REQUIRE_RESIZE_FLAG] = undefined;
    return false;
};
