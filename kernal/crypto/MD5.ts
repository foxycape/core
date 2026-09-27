import { computeUniqueId } from '../common/uuid';
import { digestStream, SIMPLE_ID_BYTE_LENGTH, type DigestSource } from './hash';

/** MD5 hex digest. Blob and File inputs are read in chunks. */
export const computeMd5 = async (data: DigestSource): Promise<string> => {
    return digestStream(data, 'MD5');
};

/**
 * simpleId of a file: MD5 of the first 5MB.
 * A string is not file bytes; it keeps the previous unique-id behavior.
 */
export const computeSimpleId = async (file: string | Blob | Uint8Array | ArrayBuffer | Promise<Blob> | FileSystemFileHandle): Promise<string> => {
    if (typeof file === 'string') {
        return computeUniqueId(file);
    }
    return digestStream(file, 'MD5', { maxBytes: SIMPLE_ID_BYTE_LENGTH });
};
