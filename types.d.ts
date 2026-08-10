
declare module '*.html';
declare module "*.scss";
declare module "*.css" {}
declare module "*.png";
declare module "*.js";
declare module '*.html?raw';
declare module '*.js?raw';
declare module '*.mjs?raw';
declare module '*.js?url';
declare module '*.mjs?url';
declare module '*/?url';
declare module '*.css?raw';
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw' {
  const source: string
  export default source
}

declare module 'upng-js' {
    type UpngImage = {
        width: number;
        height: number;
    };

    const UPNG: {
        decode(buffer: ArrayBuffer): UpngImage;
        toRGBA8(img: UpngImage): ArrayBuffer[];
        encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
    };

    export default UPNG;
}