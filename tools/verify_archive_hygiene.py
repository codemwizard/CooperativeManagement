"""Reject tracked or packaged environment secrets and private key material."""

from __future__ import annotations

import argparse
from collections import defaultdict
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable


ENV_EXAMPLE = ".env.example"
SECRET_ASSIGNMENT = re.compile(r"(?:PASSWORD|PASSWD|TOKEN|SECRET|CREDENTIAL|PRIVATE_KEY|PEPPER|ROOT_KEY)", re.I)
PLACEHOLDER = re.compile(r"(?:REPLACE_WITH|CHANGE_ME|YOUR_[A-Z0-9_]+|<[^>]+>|\$\{[A-Z0-9_]+\})", re.I)
PRIVATE_KEY_NAMES = {"id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"}
PRIVATE_KEY_SUFFIXES = {".pem", ".p12", ".pfx", ".key"}
SECRET_FILE_NAMES = {
    ".npmrc", ".pypirc", ".netrc", "credential", "credentials", "secret", "secrets",
}
DATABASE_DUMP_SUFFIXES = {".dump", ".backup", ".bak", ".sqlite", ".sqlite3", ".db"}


def _is_forbidden_name(name: str) -> bool:
    lower_name = name.lower()
    suffix = Path(lower_name).suffix
    return (
        lower_name == ".env"
        or (lower_name.startswith(".env.") and lower_name != ENV_EXAMPLE)
        or lower_name in PRIVATE_KEY_NAMES
        or lower_name in SECRET_FILE_NAMES
        or suffix in PRIVATE_KEY_SUFFIXES
        or suffix in DATABASE_DUMP_SUFFIXES
        or lower_name.endswith(".sql.gz")
    )


def forbidden_archive_paths(paths: Iterable[str]) -> list[str]:
    """Return unsafe archive member names without reading or reporting contents."""
    members = list(paths)
    rejected: set[str] = set()
    normalized_members: dict[str, list[str]] = defaultdict(list)

    for raw_path in members:
        if not raw_path or "\x00" in raw_path:
            rejected.add(raw_path)
            continue
        slash_path = raw_path.replace("\\", "/")
        if slash_path.startswith("/") or re.match(r"^[a-zA-Z]:", slash_path):
            rejected.add(raw_path)
            continue
        member_path = slash_path[:-1] if slash_path.endswith("/") else slash_path
        segments = member_path.split("/")
        if any(segment in {"", ".", ".."} for segment in segments):
            rejected.add(raw_path)
            continue
        normalized = "/".join(segments).casefold()
        normalized_members[normalized].append(raw_path)
        if any(_is_forbidden_name(segment) for segment in segments):
            rejected.add(raw_path)

    for aliases in normalized_members.values():
        if len(aliases) > 1:
            rejected.update(aliases)
    return [member for member in members if member in rejected]


def placeholder_errors(contents: str) -> list[str]:
    """Validate secret-bearing example variables without echoing their values."""
    errors: list[str] = []
    for line_number, raw_line in enumerate(contents.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        requires_placeholder = bool(SECRET_ASSIGNMENT.search(key)) or key.upper() == "DATABASE_URL"
        if requires_placeholder and value and not PLACEHOLDER.search(value):
            errors.append(f"line {line_number}: secret-bearing setting lacks a placeholder")
    return errors


def tracked_paths(repo_root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=repo_root, check=True, capture_output=True
    )
    return [entry.decode("utf-8", errors="surrogateescape") for entry in result.stdout.split(b"\0") if entry]


def archive_paths(archive: Path) -> list[str]:
    with zipfile.ZipFile(archive) as source:
        return [entry.filename for entry in source.infolist()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="also inspect a generated ZIP archive")
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help=argparse.SUPPRESS)
    args = parser.parse_args()

    failures: list[str] = []
    try:
        indexed = tracked_paths(args.repo)
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Archive hygiene check could not inspect Git index ({type(error).__name__}).", file=sys.stderr)
        return 2

    rejected = forbidden_archive_paths(indexed)
    if rejected:
        failures.append(f"Git index contains prohibited path(s): {', '.join(rejected)}")

    example_path = args.repo / ENV_EXAMPLE
    if not example_path.is_file():
        failures.append(f"Required placeholder template is missing: {ENV_EXAMPLE}")
    else:
        errors = placeholder_errors(example_path.read_text(encoding="utf-8"))
        failures.extend(f"{ENV_EXAMPLE} {error}" for error in errors)

    if args.archive is not None:
        try:
            rejected = forbidden_archive_paths(archive_paths(args.archive))
        except (OSError, zipfile.BadZipFile) as error:
            print(f"Archive hygiene check could not inspect ZIP ({type(error).__name__}).", file=sys.stderr)
            return 2
        if rejected:
            failures.append(f"ZIP contains prohibited path(s): {', '.join(rejected)}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1

    checked = "Git index and .env.example"
    if args.archive is not None:
        checked += f" and ZIP {args.archive.name}"
    print(f"PASS: {checked} contain no prohibited environment or private-key paths.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
