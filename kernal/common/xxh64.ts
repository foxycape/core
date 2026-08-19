import { convertStringToUint8Array } from './encoding';

const MASK_64 = 0xFFFFFFFFFFFFFFFFn;

/**
 * xxhashjs `UINT64(number)` only keeps the low 32 bits.
 * Keep this seed so existing `computeUniqueId` values stay stable.
 */
const DEFAULT_SEED = BigInt(20220919101915 >>> 0);

const PRIME64_1 = 0x9E3779B185EBCA87n;
const PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;
const PRIME64_3 = 0x165667B19E3779F9n;
const PRIME64_4 = 0x85EBCA77C2B2AE63n;
const PRIME64_5 = 0x27D4EB2F165667C5n;

const toU64 = (value: bigint): bigint => value & MASK_64;

const rotateLeft = (value: bigint, shift: number): bigint => {
    const bits = BigInt(shift);
    return toU64((value << bits) | (value >> (64n - bits)));
};

const readUint64LE = (bytes: Uint8Array, offset: number): bigint => (
    BigInt(bytes[offset])
    | (BigInt(bytes[offset + 1]) << 8n)
    | (BigInt(bytes[offset + 2]) << 16n)
    | (BigInt(bytes[offset + 3]) << 24n)
    | (BigInt(bytes[offset + 4]) << 32n)
    | (BigInt(bytes[offset + 5]) << 40n)
    | (BigInt(bytes[offset + 6]) << 48n)
    | (BigInt(bytes[offset + 7]) << 56n)
);

const readUint32LE = (bytes: Uint8Array, offset: number): bigint => (
    BigInt(bytes[offset])
    | (BigInt(bytes[offset + 1]) << 8n)
    | (BigInt(bytes[offset + 2]) << 16n)
    | (BigInt(bytes[offset + 3]) << 24n)
);

const round = (accumulator: bigint, input: bigint): bigint => {
    accumulator = toU64(accumulator + toU64(input * PRIME64_2));
    accumulator = rotateLeft(accumulator, 31);
    return toU64(accumulator * PRIME64_1);
};

const mergeRound = (accumulator: bigint, value: bigint): bigint => {
    accumulator = toU64(accumulator ^ round(0n, value));
    return toU64(accumulator * PRIME64_1 + PRIME64_4);
};

const hashBytes = (bytes: Uint8Array, seed: bigint): bigint => {
    const length = bytes.length;
    let offset = 0;
    let remaining = length;
    let hash: bigint;

    if (remaining >= 32) {
        let v1 = toU64(seed + PRIME64_1 + PRIME64_2);
        let v2 = toU64(seed + PRIME64_2);
        let v3 = seed;
        let v4 = toU64(seed - PRIME64_1);

        do {
            v1 = round(v1, readUint64LE(bytes, offset));
            offset += 8;
            v2 = round(v2, readUint64LE(bytes, offset));
            offset += 8;
            v3 = round(v3, readUint64LE(bytes, offset));
            offset += 8;
            v4 = round(v4, readUint64LE(bytes, offset));
            offset += 8;
            remaining -= 32;
        } while (remaining >= 32);

        hash = toU64(
            rotateLeft(v1, 1)
            + rotateLeft(v2, 7)
            + rotateLeft(v3, 12)
            + rotateLeft(v4, 18)
        );
        hash = mergeRound(hash, v1);
        hash = mergeRound(hash, v2);
        hash = mergeRound(hash, v3);
        hash = mergeRound(hash, v4);
    }
    else {
        hash = toU64(seed + PRIME64_5);
    }

    hash = toU64(hash + BigInt(length));

    while (remaining >= 8) {
        const lane = round(0n, readUint64LE(bytes, offset));
        offset += 8;
        remaining -= 8;
        hash = toU64(rotateLeft(toU64(hash ^ lane), 27) * PRIME64_1 + PRIME64_4);
    }

    if (remaining >= 4) {
        const lane = toU64(readUint32LE(bytes, offset) * PRIME64_1);
        offset += 4;
        remaining -= 4;
        hash = toU64(rotateLeft(toU64(hash ^ lane), 23) * PRIME64_2 + PRIME64_3);
    }

    while (remaining > 0) {
        const lane = toU64(BigInt(bytes[offset]) * PRIME64_5);
        offset += 1;
        remaining -= 1;
        hash = toU64(rotateLeft(toU64(hash ^ lane), 11) * PRIME64_1);
    }

    hash = toU64(hash ^ (hash >> 33n));
    hash = toU64(hash * PRIME64_2);
    hash = toU64(hash ^ (hash >> 29n));
    hash = toU64(hash * PRIME64_3);
    return toU64(hash ^ (hash >> 32n));
};

/**
 * XXH64 hex digest of a UTF-8 string. Output matches xxhashjs `h64(seed).update(content).digest().toString(16)`.
 */
export const hash64Hex = (content: string, seed: bigint = DEFAULT_SEED): string => {
    return hashBytes(convertStringToUint8Array(content), seed).toString(16);
};
