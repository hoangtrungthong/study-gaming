import hashlib
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import generate as g


class GenerateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.segments = [g.Segment("vi", "xin chào"), g.Segment("en", "hello"), g.Segment("ja", "ねこ")]
        self.voices = [
            {"id": "vi-a", "lang": "vi", "engine": "vieneu", "label": "A"},
            {"id": "ja-z", "lang": "ja", "engine": "voicevox", "label": "Z", "speaker": 3, "credit": "VOICEVOX:Z"},
        ]

    def tearDown(self):
        self.tmp.cleanup()

    def test_key_matches_content_package(self):
        self.assertEqual(g.Segment("ja", "ねこ").key, "ja|ねこ")

    def test_clip_name_changes_with_voice_config(self):
        seg = self.segments[0]
        a = g.clip_name(seg, "m4a", {"engine": "vieneu", "voice": "A"})
        self.assertEqual(a, g.clip_name(seg, "m4a", {"engine": "vieneu", "voice": "A", "label": "đổi nhãn không sao"}))
        self.assertNotEqual(a, g.clip_name(seg, "m4a", {"engine": "vieneu", "voice": "B"}))
        self.assertNotEqual(a, g.clip_name(g.Segment("vi", "câu khác"), "m4a", {"engine": "vieneu", "voice": "A"}))

    def test_clip_name_is_stable_hash(self):
        identity = '{"engine": null, "langCode": null, "speaker": null, "voice": null}'
        expected = hashlib.sha1(f"vi|xin chào|{identity}|{g.AUDIO_FORMAT_VERSION}".encode()).hexdigest()[:16]
        self.assertEqual(g.clip_name(self.segments[0], "ogg"), f"{expected}.ogg")

    def test_plan_only_matching_language_and_missing_files(self):
        jobs = g.plan(self.segments, self.voices, self.dir, "ogg")
        self.assertEqual([(j.voice["id"], j.segment.text) for j in jobs], [("vi-a", "xin chào"), ("ja-z", "ねこ")])
        existing = jobs[0].path
        existing.parent.mkdir(parents=True)
        existing.write_bytes(b"x")
        self.assertEqual(len(g.plan(self.segments, self.voices, self.dir, "ogg")), 1)

    def test_plan_skips_clip_already_made_in_another_format(self):
        wav = self.dir / "vi-a" / g.clip_name(self.segments[0], "wav", self.voices[0])
        wav.parent.mkdir(parents=True)
        wav.write_bytes(b"x")
        jobs = g.plan(self.segments, self.voices, self.dir, "m4a")
        self.assertEqual([j.segment.text for j in jobs], ["ねこ"])
        self.assertEqual(jobs[0].path.suffix, ".m4a")

    def test_plan_filters_lang_and_limit(self):
        many = [g.Segment("vi", f"câu {i}") for i in range(5)]
        self.assertEqual(len(g.plan(many, self.voices, self.dir, "ogg", limit=2)), 2)
        self.assertEqual(g.plan(many, self.voices, self.dir, "ogg", lang="ja"), [])

    def test_manifest_lists_only_existing_files_with_credit(self):
        f = self.dir / "ja-z" / g.clip_name(self.segments[2], "wav", self.voices[1])
        f.parent.mkdir(parents=True)
        f.write_bytes(b"x")
        manifest = g.build_manifest(self.segments, self.voices, self.dir)
        self.assertEqual(
            manifest,
            {
                "voices": [{"id": "ja-z", "lang": "ja", "engine": "voicevox", "label": "Z", "credit": "VOICEVOX:Z"}],
                "clips": {"ja-z": {"ja|ねこ": f"audio/ja-z/{f.name}"}},
            },
        )

    def test_load_files_skip_disabled_voices(self):
        speech = self.dir / "speech.json"
        speech.write_text(json.dumps({"segments": [{"lang": "vi", "text": "a"}]}), encoding="utf-8")
        voices = self.dir / "voices.json"
        voices.write_text(json.dumps({"voices": [{"id": "x", "enabled": False}, {"id": "y"}]}), encoding="utf-8")
        self.assertEqual(g.load_segments(speech), [g.Segment("vi", "a")])
        self.assertEqual([v["id"] for v in g.load_voices(voices)], ["y"])

    def test_every_clip_format_is_cached_for_offline(self):
        config = (g.ROOT / "apps" / "game" / "vite.config.ts").read_text(encoding="utf-8")
        # Dòng urlPattern của runtimeCaching: /\/audio\/.+\.(m4a|ogg|mp3|wav)$/
        exts = re.search(r"audio\\/\.\+\\\.\(([a-z0-9|]+)\)\$", config).group(1).split("|")
        for ext in g.CLIP_EXTS:
            self.assertIn(ext, exts, f".{ext} phải nằm trong runtimeCaching âm thanh (vite.config.ts) để chơi offline")

    def test_encode_failure_leaves_no_partial_clip(self):
        wav = self.dir / "in.wav"
        wav.write_bytes(b"x")
        target = self.dir / "v" / "clip.m4a"

        def broken_ffmpeg(cmd, check):
            Path(cmd[-1]).write_bytes(b"half")
            raise subprocess.CalledProcessError(1, cmd)

        with mock.patch.object(g.subprocess, "run", broken_ffmpeg), self.assertRaises(subprocess.CalledProcessError):
            g.encode(wav, target)
        self.assertEqual(list(target.parent.iterdir()), [])

    def test_encode_success_renames_into_place(self):
        wav = self.dir / "in.wav"
        wav.write_bytes(b"x")
        target = self.dir / "v" / "clip.m4a"
        with mock.patch.object(g.subprocess, "run", lambda cmd, check: Path(cmd[-1]).write_bytes(b"aac")):
            g.encode(wav, target)
        self.assertEqual([p.name for p in target.parent.iterdir()], ["clip.m4a"])

    def test_unknown_engine_rejected(self):
        with self.assertRaises(SystemExit):
            g.make_engines({"khong-co"}, "http://x")

    def test_dry_run_reports_without_writing(self):
        speech = self.dir / "speech.json"
        speech.write_text(json.dumps({"segments": [{"lang": "vi", "text": "a"}]}), encoding="utf-8")
        voices = self.dir / "voices.json"
        voices.write_text(json.dumps({"voices": self.voices}), encoding="utf-8")
        out = self.dir / "out"
        self.assertEqual(g.main(["--speech", str(speech), "--voices", str(voices), "--out", str(out), "--dry-run"]), 0)
        self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
