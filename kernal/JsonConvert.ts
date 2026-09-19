import { Base64 } from "js-base64";
export class JsonConvert {
  static stringify(data: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number) {
    return JSON.stringify(data, replacer ? replacer : this.replacer);
  }
  static parse(data: string, reviver?: (this: any, key: string, value: any) => any) {
    if (!data) {
      return null;
    }
    return JSON.parse(data, reviver ? reviver : this.reviver);
  }
  private static replacer(key: string, value: any) {
    if (value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries()), // or with spread: value: [...value]
      };
    }
    else if (value instanceof Date) {
      return value.toISOString(); // return ISO date string
    }
    else if (value instanceof ArrayBuffer) {
      return {
        dataType: 'ArrayBuffer',
        value: Base64.fromUint8Array(new Uint8Array(value))
      };
    } else {
      return value;
    }
  }
  private static reviver(key: string, value: any) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value.dataType === 'Map') {
        const entries = value.value;
        if (!Array.isArray(entries)) {
          return value;
        }
        try {
          return new Map(entries);
        } catch {
          return value;
        }
      }
      if (value.dataType === 'ArrayBuffer') {
        const b64 = value.value;
        if (typeof b64 !== 'string') {
          return value;
        }
        try {
          return Base64.toUint8Array(b64).buffer;
        } catch {
          return value;
        }
      }
    }
    return value;
  }
}
