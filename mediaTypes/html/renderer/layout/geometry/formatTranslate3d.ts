import type { LayoutAxis, LayoutSign } from "./ILayoutGeometry";

export const formatTranslate3d = (
    length: number,
    axis: LayoutAxis,
    pageSign: LayoutSign = 1
) => {
    const value = parseFloat(length.toFixed(10));
    if (axis == "y") {
        return `translate3d(0,-${value}px,0)`;
    }
    return `translate3d(${-pageSign * value}px,0,0)`;
};

export const signedTranslateLength = (
    length: number,
    axis: LayoutAxis,
    pageSign: LayoutSign
) => (axis == "y" ? -length : -pageSign * length);
