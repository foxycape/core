import { convertBase64ToArrayBuffer } from "../common/buffer";
import { digestStream } from "./hash";
import { CryptoOptions, HashAlgorithm, ICrypto } from "./ICrypto";

const getCryptoSubtle = () => {
    const crypto = globalThis.crypto || globalThis["msCrypto"];
    return crypto.subtle || crypto.webkitSubtle;
};

/** Convert string (UTF-8) or ArrayBuffer to bytes. */
const toUtf8Bytes = (value: string | ArrayBuffer): Uint8Array | ArrayBuffer => {
    return typeof value === 'string' ? new TextEncoder().encode(value) : value;
};

const toAesIvBytes = (iv: string | ArrayBuffer | undefined, keyLength: number): Uint8Array | ArrayBuffer => {
    if (iv == null) {
        throw new Error('iv is required for AES');
    }
    if (typeof iv === 'string') {
        return new TextEncoder().encode(iv.substring(0, keyLength));
    }
    return iv.byteLength > keyLength ? iv.slice(0, keyLength) : iv;
};

const parsePemToBuffer = (pem: string, header: string, footer: string, requireHeader = false): ArrayBuffer => {
    let pemContents = pem.trim();
    if (pemContents.startsWith("-----")) {
        if (requireHeader && !pemContents.includes(header)) {
            throw new Error('RSA decrypt requires PKCS#8 private key (BEGIN PRIVATE KEY)');
        }
        const headerIndex = pemContents.indexOf(header);
        pemContents = pemContents.substring(headerIndex >= 0 ? headerIndex + header.length : 0).trim();
        const footerIndex = pemContents.indexOf(footer);
        pemContents = (footerIndex >= 0 ? pemContents.substring(0, footerIndex) : pemContents).trim();
    }
    return convertBase64ToArrayBuffer(pemContents);
};

const importRsaPublicKey = async (key: string | ArrayBuffer) => {
    const buffer = typeof key === 'string' ? parsePemToBuffer(key, "-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----") : key;
    return await globalThis.crypto.subtle.importKey(
        "spki",
        buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["encrypt"],
    );
};

/**
 * Import an RSA private key (PKCS#8 PEM/base64 string, or raw ArrayBuffer).
 * Pairs with the SPKI public key used by encrypt.
 */
const importRsaPrivateKey = async (key: string | ArrayBuffer) => {
    const buffer = typeof key === 'string'
        ? parsePemToBuffer(key, "-----BEGIN PRIVATE KEY-----", "-----END PRIVATE KEY-----", true)
        : key;
    return await globalThis.crypto.subtle.importKey(
        "pkcs8",
        buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["decrypt"],
    );
};

export class WebCrypto implements ICrypto {
    async digest(data: string | Blob | Uint8Array | ArrayBuffer, hashAlgorithm?: HashAlgorithm) {
        return digestStream(data, hashAlgorithm ?? 'SHA-256');
    }

    async encrypt(data: string | ArrayBuffer, options: CryptoOptions): Promise<ArrayBuffer> {
        const cryptoSubtle = getCryptoSubtle();
        const { key, iv, mode, algorithm } = options;
        if (!algorithm || algorithm == 'aes') {
            const keyBytes = toUtf8Bytes(key);
            if (!keyBytes || keyBytes.byteLength < 16 || keyBytes.byteLength % 16 > 0) {
                throw new Error('key must greater than 16');
            }
            const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
            const ivBytes = toAesIvBytes(iv, keyBytes.byteLength);
            const name = mode === 'CBC' ? 'AES-CBC' : (mode as string);
            const cryptoKey = await cryptoSubtle.importKey('raw', keyBytes, name, true, ['encrypt']);
            return await cryptoSubtle.encrypt({ name: name, iv: ivBytes }, cryptoKey, buffer);
        }
        else {
            const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
            const encryptKey = await importRsaPublicKey(key);
            return await cryptoSubtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                encryptKey,
                buffer
            );
        }
    }

    async decrypt(data: ArrayBuffer, options: CryptoOptions) {
        const { key, iv, mode, algorithm } = options;
        const cryptoSubtle = getCryptoSubtle();
        if (!algorithm || algorithm == 'aes') {
            const keyBytes = toUtf8Bytes(key);
            if (!keyBytes || keyBytes.byteLength < 16 || keyBytes.byteLength % 16 > 0) {
                throw new Error('key must greater than 16');
            }
            const ivBytes = toAesIvBytes(iv, keyBytes.byteLength);
            const name = mode === 'CBC' ? 'AES-CBC' : (mode as string);
            const cryptoKey = await cryptoSubtle.importKey('raw', keyBytes, name, true, ['decrypt']);
            return await cryptoSubtle.decrypt({ name: name, iv: ivBytes }, cryptoKey, data);
        }
        // RSA-OAEP: encrypt with public key, decrypt with private key (no iv)
        const decryptKey = await importRsaPrivateKey(key);
        return await cryptoSubtle.decrypt(
            { name: "RSA-OAEP" },
            decryptKey,
            data,
        );
    }
}
