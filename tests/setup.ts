// scheduler-polyfill expects a browser-like global `self`.
;(globalThis as typeof globalThis & { self: typeof globalThis }).self = globalThis

// pdf.js constructs DOMMatrix while the module loads. Node has no DOMMatrix
// unless @napi-rs/canvas is installed, which these unit tests do not need.
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    is2D = true

    constructor(init?: string | number[] | DOMMatrixInit) {
      if (typeof init === 'string') {
        return
      }
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0] ?? 1
        this.b = init[1] ?? 0
        this.c = init[2] ?? 0
        this.d = init[3] ?? 1
        this.e = init[4] ?? 0
        this.f = init[5] ?? 0
        return
      }
      if (init && typeof init === 'object') {
        this.a = init.a ?? init.m11 ?? 1
        this.b = init.b ?? init.m12 ?? 0
        this.c = init.c ?? init.m21 ?? 0
        this.d = init.d ?? init.m22 ?? 1
        this.e = init.e ?? init.m41 ?? 0
        this.f = init.f ?? init.m42 ?? 0
      }
    }
  } as typeof DOMMatrix
}
