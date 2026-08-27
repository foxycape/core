type NodeBufferLike = Uint8Array;

type NodeBufferCtor = {
  isBuffer: (obj: unknown) => obj is NodeBufferLike;
  from: (value: NodeBufferLike) => NodeBufferLike;
};

const nodeBuffer = (globalThis as { Buffer?: NodeBufferCtor }).Buffer;

/**
 * is it Buffer?
 *
 * @private
 */
export const isBuffer: NodeBufferCtor['isBuffer'] = nodeBuffer
  ? nodeBuffer.isBuffer.bind(nodeBuffer)
  : /**
     * return false every time if Buffer unsupported
     *
     * @private
     */
    (_obj: unknown): _obj is NodeBufferLike => false;

/**
 * clone Buffer
 *
 * @private
 */
export const cloneBuffer: NodeBufferCtor['from'] = nodeBuffer
  ? nodeBuffer.from.bind(nodeBuffer)
  : /**
     * return argument
     * use if Buffer unsupported
     *
     * @private
     * @param value
     */
    (value: NodeBufferLike): NodeBufferLike => value;
