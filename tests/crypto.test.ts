import { describe, expect, it } from 'vitest';
import { canonicalizeJson, canonicalSha256, sha256Utf8 } from '../src/engine/crypto';

describe('RFC 8785 Canonical JSON & UTF-8 SHA-256 (Crypto Engine)', () => {
  it('matches standard NIST SHA-256 test vectors', () => {
    // Empty string
    expect(sha256Utf8('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // "abc"
    expect(sha256Utf8('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    // Standard 56-byte string
    expect(sha256Utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('handles multi-byte UTF-8 Unicode characters deterministically', () => {
    const unicodeText = 'Symphony: Chibombo & Chisamba — Zambian Kwacha (ZMW) 🇿🇲 420,000';
    const hash = sha256Utf8(unicodeText);
    expect(hash).toHaveLength(64);
    // Deterministic repeat
    expect(sha256Utf8(unicodeText)).toBe(hash);
  });

  it('orders object keys lexicographically regardless of insertion order (RFC 8785)', () => {
    const objA = { b: 2, a: 1, c: { z: 26, y: 25 } };
    const objB = { c: { y: 25, z: 26 }, a: 1, b: 2 };

    expect(canonicalizeJson(objA)).toBe('{"a":1,"b":2,"c":{"y":25,"z":26}}');
    expect(canonicalizeJson(objB)).toBe('{"a":1,"b":2,"c":{"y":25,"z":26}}');
    expect(canonicalSha256(objA)).toBe(canonicalSha256(objB));
  });

  it('strips undefined object properties while preserving array nulls', () => {
    const obj = {
      keep: 'yes',
      omit: undefined,
      arr: [1, undefined, 3],
    };
    expect(canonicalizeJson(obj)).toBe('{"arr":[1,null,3],"keep":"yes"}');
  });

  describe('Gate G11: Canonical Hashing Known Vectors Suite', () => {
    it('matches independent SHA-256 for empty string', () => {
      expect(sha256Utf8('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('matches independent SHA-256 for single-byte string ("a")', () => {
      expect(sha256Utf8('a')).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
    });

    it('matches independent SHA-256 for embedded whitespace, tabs, and newlines', () => {
      const whitespaceVector = '\tHello\nWorld\r\n \t';
      expect(sha256Utf8(whitespaceVector)).toBe('8ab52d482c9b2a467eb3cf7b0769c7c6ded854fe3189bd9dcd39a1796f94faa2');
    });

    it('matches independent SHA-256 for non-BMP multi-byte Unicode characters (SMP emoji/symbols)', () => {
      const nonBmpVector = '🌍🚀🌾 🇿🇲';
      expect(sha256Utf8(nonBmpVector)).toBe('e4c42769fb77196ca365288bea24081f822c5f6a3a80b785dc3d14b607f0f681');
    });
  });
});
