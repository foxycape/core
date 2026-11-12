import { ContentLayoutCssVariableNames as Var } from "../style/ContentLayoutCssVariableNames";

const boxWidth = `var(${Var.ColumnBoxWidth})`;
const boxHeight = `var(${Var.ColumnBoxHeight})`;
const widthRatio = `var(${Var.MaxImageWidthRatio})`;
const heightRatio = `var(${Var.MaxImageHeightRatio})`;

/**
 * Fit an image into the smaller of its containing block and the physical column box.
 *
 * Percentage width tracks a fixed-width parent, so a nested div cannot be overflowed.
 * The column box is still required: in multi-column layout `100%` is the whole
 * container, and in vertical page mode a percentage can resolve wider than the
 * physical column. `--column-width` is the CSS inline size and must not be used —
 * vertical page mode remaps it to page height, which overshoots and gets clipped.
 */
export const getImageFitStyles = (width: number, height: number) => {
    const widthValue = `min(calc(100% * ${widthRatio}),calc(${boxWidth} * ${widthRatio}))`;
    const maxHeightValue = `min(${height}px,${boxHeight},calc(${boxWidth} / ${width} * ${height}))`;
    return {
        width: widthValue,
        height: "auto",
        "max-width": widthValue,
        "max-height": maxHeightValue,
        "aspect-ratio": `${width} / ${height}`,
        "object-fit": "contain",
    };
};

export const getImageForcedHeightCss = (width: number, height: number, ratioExpr: string) =>
    `min(calc(${height}px * ${ratioExpr}),calc(${boxHeight} * ${ratioExpr}),calc(${boxWidth} / ${width} * ${height} * ${ratioExpr}))`;

export const getImageHeightRatioExpr = (maxImageHeightRatio: number, preferRatioNumber?: boolean) =>
    preferRatioNumber && maxImageHeightRatio
        ? `${maxImageHeightRatio}`
        : heightRatio;
