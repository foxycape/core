export const SUBSTANTIAL_WRAPPER_PX = 2;

export type EdgeRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width?: number;
    height?: number;
};

export const rectsIntersect = (a: EdgeRect, b: EdgeRect) =>
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;

export const isSubstantialWrapperRect = (rect?: EdgeRect | null) => {
    if (!rect) {
        return false;
    }
    const width = rect.width ?? Math.abs(rect.right - rect.left);
    const height = rect.height ?? Math.abs(rect.bottom - rect.top);
    return width > SUBSTANTIAL_WRAPPER_PX && height > SUBSTANTIAL_WRAPPER_PX;
};
