import unittest
import tempfile
import zipfile
from pathlib import Path
import subprocess
import sys
from io import BytesIO

from tools.verify_archive_hygiene import archive_paths, forbidden_archive_paths, placeholder_errors


class ArchiveHygieneTests(unittest.TestCase):
    def test_rejects_environment_and_private_key_paths(self):
        paths = [
            ".env",
            ".env.local",
            "Prototype/.env",
            "nested/.env.production",
            "nested/.ENV.Staging",
            "keys/service.pem",
            "id_ed25519",
            ".npmrc",
            "secrets/service-account.json",
            "database/snapshot.dump",
            "database/backup.sql.gz",
        ]
        self.assertEqual(forbidden_archive_paths(paths), paths)

    def test_allows_placeholder_template_and_unrelated_dotfiles(self):
        paths = [
            ".env.example",
            ".editorconfig",
            "src/app.ts",
            "packages/domain/src/identity/credential-lifecycle.ts",
            "tests/secret-redaction.integration.test.ts",
        ]
        self.assertEqual(forbidden_archive_paths(paths), [])

    def test_rejects_secret_named_path_segments_without_rejecting_source_names(self):
        paths = ["credential", "nested/credentials", "secret", "secrets/service-account.json"]
        self.assertEqual(forbidden_archive_paths(paths), paths)

    def test_rejects_unsafe_and_duplicate_archive_member_paths(self):
        paths = [
            "../outside.txt",
            "C:\\outside.txt",
            "C:drive-relative.txt",
            "/outside.txt",
            "src/../outside.txt",
            "src//app.ts",
            "nested//",
            "src\\app.ts",
            "src/app.ts",
        ]
        rejected = forbidden_archive_paths(paths)
        self.assertEqual(rejected, paths)

    def test_accepts_placeholder_only_secret_settings(self):
        contents = """DATABASE_URL=postgresql://symphony:REPLACE_WITH_PASSWORD@localhost/db
SYMPHONY_ROOT_KEY_HEX=REPLACE_WITH_64_HEX_CHARACTERS
NODE_ENV=development
"""
        self.assertEqual(placeholder_errors(contents), [])

    def test_rejects_concrete_secret_setting_without_echoing_value(self):
        errors = placeholder_errors("API_TOKEN=do-not-print-this-value")
        self.assertEqual(len(errors), 1)
        self.assertNotIn("do-not-print-this-value", errors[0])

    def test_inspects_generated_zip_members(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "source.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("project/.env", "sentinel")
                output.writestr("project/src/app.ts", "source")
            self.assertEqual(archive_paths(archive), ["project/.env", "project/src/app.ts"])
            self.assertEqual(forbidden_archive_paths(archive_paths(archive)), ["project/.env"])

    def test_source_archive_builder_excludes_environment_files_and_opaque_nested_archives(self):
        repo = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "fixture-repo"
            fixture.mkdir()
            subprocess.run(["git", "init", "-q", str(fixture)], check=True)
            (fixture / "src").mkdir()
            (fixture / "src" / "app.ts").write_text("export const safe = true;\n", encoding="utf-8")
            (fixture / ".env").write_text("SHOULD_NOT_BE_READ=synthetic\n", encoding="utf-8")
            (fixture / "Prototype").mkdir()
            (fixture / "Prototype" / ".env").write_text("ALSO_SYNTHETIC=sentinel\n", encoding="utf-8")
            nested_archive = BytesIO()
            with zipfile.ZipFile(nested_archive, "w") as nested:
                nested.writestr("nested/.env.production", "synthetic nested archive secret")
            (fixture / "docs").mkdir()
            (fixture / "docs" / "phase1.zip").write_bytes(nested_archive.getvalue())
            subprocess.run(["git", "-C", str(fixture), "add", "-f", "."], check=True)
            subprocess.run(
                ["git", "-C", str(fixture), "-c", "user.name=Archive Test", "-c", "user.email=archive@example.invalid", "commit", "-qm", "fixture"],
                check=True,
            )
            archive = Path(directory) / "source.zip"
            result = subprocess.run(
                [sys.executable, str(repo / "tools" / "create_source_review_archive.py"), "--repo", str(fixture), "--output", str(archive)],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("PASS: Git index and .env.example", result.stdout)
            with zipfile.ZipFile(archive) as source:
                members = source.namelist()
                self.assertEqual(members, ["src/app.ts"])
                self.assertNotIn("docs/phase1.zip", members)
                self.assertNotIn("SHOULD_NOT_BE_READ", source.read("src/app.ts").decode())

    def test_verifier_rejects_contaminated_archive_with_unsafe_members(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory) / "repo"
            repo.mkdir()
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            (repo / ".env.example").write_text("", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", ".env.example"], check=True)
            archive = Path(directory) / "contaminated.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("project/.env.local", "synthetic only")
                output.writestr("../outside.txt", "synthetic only")
            rejected = forbidden_archive_paths(archive_paths(archive))
            self.assertEqual(rejected, ["project/.env.local", "../outside.txt"])
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve().parents[2] / "tools" / "verify_archive_hygiene.py"), "--repo", str(repo), "--archive", str(archive)],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("project/.env.local", result.stdout)
            self.assertIn("../outside.txt", result.stdout)
            self.assertNotIn("synthetic only", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
