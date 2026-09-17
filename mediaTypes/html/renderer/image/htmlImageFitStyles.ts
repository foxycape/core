import { ContentLayoutCssVariableNames as Var } from "../style/ContentLayoutCssVariableNames";

const boxWidth = `var(${Var.ColumnBoxWidth})`;
const boxHeight = `var(${Var.ColumnBoxHeight})`;
const widthRatio = `var(${Var.MaxImageWidthRatio})`;
const heightRatio = `var(${Var.MaxImageHeightRatio})`;

/**
 * Fit an image into the physical column box.
 *
 * `--column-width` is the CSS `column-width` (inline size). In vertical page
 * mode that is page height, so it must not be used as a physical max-width —
 * that overshoots the column and overflow:hidden clips the image.
 */
export const getImageFitStyles = (width: number, height: number) => {
    const widthValue = `calc(${boxWidth} * ${widthRatio})`;
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
