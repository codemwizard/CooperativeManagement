# REM-WP5.2 local password blocklist

Version: `phase1-ncsc-top100k-v1`.

The runtime corpus is vendored at `packages/domain/src/identity/password-blocklist-v1.json`; the application performs no network lookup. The checked-in source is the NCSC-derived `100k-most-used-passwords-NCSC.txt` file from Daniel Miessler's SecLists repository, pinned to commit `6b19c2f5088c45b5dadb4d8918d2ab4f7efb03a9` and retained beside this document. The source contains 99,839 nonempty lines. The pinned SecLists MIT license is retained as `SECLISTS-LICENSE.txt`.

Source SHA-256: `C2E5696882C603B76BB67A47EE970897E5A76FC4C3F5547ABE3D0CA340C576E0`.

The reproducible transformation strictly decodes UTF-8, removes an optional BOM, splits on LF, strips a trailing CR per line, drops empty entries, lowercases entries for case-insensitive blocklist matching, deduplicates, sorts by Unicode code-unit order, and serializes compact UTF-8 JSON followed by LF. Passwords supplied for hashing are not trimmed, normalized, lowercased, truncated or partially verified; case folding applies only to the blocklist lookup.

The generated corpus contains 97,746 unique normalized entries. Its SHA-256 is `F35ABFB8FAB6A152DFB26271C5A200BE2940C57EA5E0A7AA0395F527DB7D2734`. The structured details are in `manifest.json`. Rebuild with `node tools/prepare_wp5_2_password_blocklist.mjs`; verify without network access using `node tools/verify_wp5_2_password_blocklist.mjs`.

Provenance reference: [SecLists source file pinned to the recorded commit](https://github.com/danielmiessler/SecLists/blob/6b19c2f5088c45b5dadb4d8918d2ab4f7efb03a9/Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt).
