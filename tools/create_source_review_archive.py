"""Create a source-review ZIP from safe files in the exact committed Git tree."""

from __future__ import annotations

import argparse
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.verify_archive_hygiene import archive_paths, forbidden_archive_paths

OPAQUE_ARCHIVE_SUFFIXES = {
    ".7z", ".apk", ".bz2", ".cab", ".ear", ".gz", ".jar", ".rar",
    ".tar", ".tgz", ".war", ".whl", ".xz", ".zip", ".zst",
}


def is_opaque_archive(path: str) -> bool:
    """Exclude packaged containers so nested members cannot bypass path checks."""
    return Path(path).suffix.casefold() in OPAQUE_ARCHIVE_SUFFIXES


def git_output(repo: Path, *arguments: str) -> bytes:
    return subprocess.run(
        ["git", "-C", str(repo), *arguments], check=True, capture_output=True
    ).stdout


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    repo = args.repo.resolve()
    output = args.output.resolve()
    try:
        commit = git_output(repo, "rev-parse", "--verify", "HEAD").decode().strip()
        entries = git_output(repo, "ls-tree", "-r", "-z", "HEAD").split(b"\0")
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError) as error:
        print(f"Source archive could not inspect the committed Git tree ({type(error).__name__}).", file=sys.stderr)
        return 2

    safe_paths: list[str] = []
    excluded: list[tuple[str, str]] = []
    object_ids: dict[str, tuple[str, str]] = {}
    for entry in entries:
        if not entry:
            continue
        try:
            metadata, encoded_path = entry.split(b"\t", maxsplit=1)
            mode, object_type, object_id = metadata.decode("ascii").split()
            path = encoded_path.decode("utf-8", errors="surrogateescape")
        except (ValueError, UnicodeDecodeError):
            print("Source archive encountered an unreadable Git tree entry.", file=sys.stderr)
            return 2
        if object_type != "blob":
            continue
        if forbidden_archive_paths([path]):
            excluded.append((path, "prohibited member name"))
            continue
        if is_opaque_archive(path):
            excluded.append((path, "opaque packaged archive"))
            continue
        safe_paths.append(path)
        object_ids[path] = (mode, object_id)

    if output.exists() and output.is_dir():
        print("Source archive output must be a file path.", file=sys.stderr)
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in safe_paths:
                mode, object_id = object_ids[path]
                content = git_output(repo, "cat-file", "blob", object_id)
                if mode == "120000":
                    info = zipfile.ZipInfo(path)
                    info.create_system = 3
                    info.external_attr = (0o120777 << 16)
                    archive.writestr(info, content)
                else:
                    archive.writestr(path, content)
        produced_paths = archive_paths(output)
    except (OSError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        output.unlink(missing_ok=True)
        print(f"Source archive could not be created or verified ({type(error).__name__}).", file=sys.stderr)
        return 2

    violations = forbidden_archive_paths(produced_paths)
    if violations or produced_paths != safe_paths:
        output.unlink(missing_ok=True)
        print(
            "Source archive member verification failed; generated ZIP was removed. "
            f"Expected {len(safe_paths)} safe paths; found {len(produced_paths)} members; "
            f"prohibited paths: {', '.join(violations) if violations else 'none'}.",
            file=sys.stderr,
        )
        return 1

    verifier = Path(__file__).resolve().with_name("verify_archive_hygiene.py")
    verification_repo = Path(__file__).resolve().parent.parent
    verification = subprocess.run(
        [
            sys.executable,
            str(verifier),
            "--repo",
            str(verification_repo),
            "--archive",
            str(output),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if verification.stdout:
        sys.stdout.write(verification.stdout)
    if verification.returncode != 0:
        output.unlink(missing_ok=True)
        if verification.stderr:
            sys.stderr.write(verification.stderr)
        print("Independent source archive verification failed; generated ZIP was removed.", file=sys.stderr)
        return verification.returncode or 1

    print(f"Created {output.name} from commit {commit}: {len(safe_paths)} safe tracked files; {len(excluded)} member(s) excluded.")
    for path, reason in excluded:
        print(f"Excluded {reason}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
