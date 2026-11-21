import { describe, expect, it } from 'vitest';
import { parseStrictJson } from '../routes/commands.js';

describe('command raw JSON parser', () => {
  it('rejects duplicate keys after decoding JSON escapes at every object depth', () => {
    expect(() => parseStrictJson(Buffer.from('{"a":1,"\\u0061":2}'))).toThrow();
    expect(() => parseStrictJson(Buffer.from('{"outer":{"key":1,"key":2}}'))).toThrow();
  });

  it('rejects malformed UTF-8 and unpaired surrogate escapes while accepting a valid pair', () => {
    expect(() => parseStrictJson(Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]))).toThrow();
    expect(() => parseStrictJson(Buffer.from('{"value":"\\ud800"}'))).toThrow();
    expect(() => parseStrictJson(Buffer.from('{"value":"\\udc00"}'))).toThrow();
    expect(parseStrictJson(Buffer.from('{"value":"\\ud83d\\ude00"}'))).toEqual({ value: '😀' });
  });

  it('rejects invalid JSON numeric forms and trailing data before materializing the request', () => {
    expect(() => parseStrictJson(Buffer.from('{"value":01}'))).toThrow();
    expect(() => parseStrictJson(Buffer.from('{"value":true} trailing'))).toThrow();
  });
});
