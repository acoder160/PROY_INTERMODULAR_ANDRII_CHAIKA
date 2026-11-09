/**
 * @stomp/stompjs builds a TextDecoder when the live-map socket opens, and not every Hermes build
 * ships one. This minimal UTF-8 decoder is only installed when the runtime has none.
 */
if (typeof (globalThis as { TextDecoder?: unknown }).TextDecoder === 'undefined') {
  class Utf8Decoder {
    readonly encoding = 'utf-8';

    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return '';
      const bytes = input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let out = '';
      for (let i = 0; i < bytes.length; ) {
        const b = bytes[i++];
        let cp: number;
        if (b < 0x80) cp = b;
        else if (b >= 0xc0 && b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        else if (b >= 0xe0 && b < 0xf0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else if (b >= 0xf0) {
          cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        } else cp = 0xfffd;
        out += String.fromCodePoint(cp);
      }
      return out;
    }
  }
  (globalThis as { TextDecoder?: unknown }).TextDecoder = Utf8Decoder;
}

export {};
