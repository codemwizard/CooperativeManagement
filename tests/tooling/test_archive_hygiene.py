import unittest
import tempfile
import zipfile
from pathlib import Path

from tools.verify_archive_hygiene import archive_paths, forbidden_archive_paths, placeholder_errors


class ArchiveHygieneTests(unittest.TestCase):
    def test_rejects_environment_and_private_key_paths(self):
        paths = [".env", "app/.env.production", "keys/service.pem", "id_ed25519"]
        self.assertEqual(forbidden_archive_paths(paths), paths)

    def test_allows_placeholder_template_and_unrelated_dotfiles(self):
        paths = [".env.example", ".editorconfig", "src/app.ts"]
        self.assertEqual(forbidden_archive_paths(paths), [])

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


if __name__ == "__main__":
    unittest.main()
