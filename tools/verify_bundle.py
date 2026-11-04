import json
import os
import sys

PROTOTYPE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIST_DIR = os.path.join(PROTOTYPE_ROOT, 'dist')
SRC_DIR = os.path.join(PROTOTYPE_ROOT, 'src')
DATA_DIR = os.path.join(PROTOTYPE_ROOT, 'data')

def verify_bundle():
    print("[1/3] Checking dist/ directory existence and file exclusions...")
    if not os.path.exists(DIST_DIR):
        print("FAIL: dist/ directory does not exist. Run 'npm run build' first.")
        sys.exit(1)

    forbidden_files = [
        'forbidden_terms.json',
        'capture_questions.json',
        'session_notes_template.json',
        'reference_oracle.py',
        'validate_help.py',
    ]

    for root, dirs, files in os.walk(DIST_DIR):
        for f in files:
            if f in forbidden_files:
                print(f"FAIL: Forbidden file '{f}' leaked into dist/ at {os.path.join(root, f)}")
                sys.exit(1)
            if 'test' in f.lower() and f.endswith('.ts'):
                print(f"FAIL: Test file '{f}' found in dist/")
                sys.exit(1)

    print("[2/3] Checking for forbidden financial institution terms...")
    forbidden_terms_path = os.path.join(DATA_DIR, 'forbidden_terms.json')
    with open(forbidden_terms_path, 'r', encoding='utf-8') as f:
        forbidden_data = json.load(f)
    terms = forbidden_data.get('terms', [])

    import re

    violations = []
    for check_dir in [SRC_DIR, DIST_DIR]:
        for root, dirs, files in os.walk(check_dir):
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    # Strip hex color codes (e.g. #f8fafc) to avoid matching incidental substrings like 'afc'
                    sanitized_content = re.sub(r'#[0-9a-fA-F]{3,8}\b', '', content)
                    for term in terms:
                        # Match whole word to avoid false positives inside unrelated tokens
                        pattern = rf'\b{re.escape(term)}\b'
                        if re.search(pattern, sanitized_content, re.IGNORECASE):
                            violations.append((filepath, term))
                except Exception as e:
                    pass

    if violations:
        print(f"FAIL: Forbidden terms found ({len(violations)} occurrences):")
        for vpath, vterm in violations[:10]:
            print(f"  - Term '{vterm}' in {vpath}")
        sys.exit(1)

    print("[3/3] Checking bundle content cleanliness...")
    # Verify dist/index.html is valid
    index_html = os.path.join(DIST_DIR, 'index.html')
    if not os.path.exists(index_html):
        print("FAIL: dist/index.html not found.")
        sys.exit(1)

    print("OK: Bundle sanitized, zero forbidden files, zero forbidden terms.")
    sys.exit(0)

if __name__ == '__main__':
    verify_bundle()
