"""Tạo sẵn file âm thanh cho mọi câu trong game.

Đọc danh sách câu (`pnpm speech-list` → tools/tts/speech-list.json) và danh sách giọng (voices.json),
gọi bộ đọc của từng giọng, ghi file vào apps/game/public/audio/<giọng>/ và cập nhật manifest.json.
File đã có thì bỏ qua, nên chạy lại chỉ tạo phần còn thiếu.

    python generate.py --dry-run                 # xem sẽ tạo bao nhiêu file
    python generate.py                           # tạo tất cả giọng đang bật
    python generate.py --voice en-kokoro-heart   # chỉ một giọng
    python generate.py --lang en --limit 50      # 50 câu tiếng Anh đầu tiên (để nghe so sánh)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = Path(__file__).resolve().parent
DEFAULT_SPEECH = TOOL_DIR / "speech-list.json"
DEFAULT_VOICES = TOOL_DIR / "voices.json"
DEFAULT_OUT = ROOT / "apps" / "game" / "public" / "audio"
# Ưu tiên theo thứ tự. AAC (.m4a) phát được trên mọi trình duyệt, kể cả Safari/iOS cũ (không phát được Ogg Opus).
CLIP_EXTS = ("m4a", "ogg", "wav")


@dataclass(frozen=True)
class Segment:
    lang: str
    text: str

    @property
    def key(self) -> str:
        """Phải khớp speechKey() ở packages/content/src/speech.ts."""
        return f"{self.lang}|{self.text}"


@dataclass(frozen=True)
class Job:
    voice: dict
    segment: Segment
    path: Path  # đường dẫn file đích (đuôi .m4a hoặc .wav)


# Đổi khi đổi cách nén / tham số tạo âm thanh, để tên file mới khác tên cũ và máy người chơi tải lại.
AUDIO_FORMAT_VERSION = "1"
VOICE_IDENTITY_KEYS = ("engine", "voice", "speaker", "langCode")


def clip_name(segment: Segment, ext: str, voice: dict | None = None) -> str:
    """Tên file theo nội dung câu + cấu hình giọng: đổi giọng hay tham số thì tên đổi, bộ nhớ đệm không giữ bản cũ."""
    identity = json.dumps({k: (voice or {}).get(k) for k in VOICE_IDENTITY_KEYS}, sort_keys=True)
    raw = f"{segment.key}|{identity}|{AUDIO_FORMAT_VERSION}"
    return f"{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:16]}.{ext}"


def load_segments(path: Path) -> list[Segment]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Segment(s["lang"], s["text"]) for s in data["segments"]]


def load_voices(path: Path) -> list[dict]:
    return [v for v in json.loads(path.read_text(encoding="utf-8"))["voices"] if v.get("enabled", True)]


def plan(
    segments: Iterable[Segment],
    voices: Iterable[dict],
    out_dir: Path,
    ext: str,
    lang: str | None = None,
    limit: int | None = None,
) -> list[Job]:
    """Các file còn thiếu cần tạo, theo từng giọng."""
    segments = [s for s in segments if lang is None or s.lang == lang]
    jobs: list[Job] = []
    for voice in voices:
        mine = [s for s in segments if s.lang == voice["lang"]]
        if limit is not None:
            mine = mine[:limit]
        for seg in mine:
            if any((out_dir / voice["id"] / clip_name(seg, e, voice)).exists() for e in CLIP_EXTS):
                continue  # đã có file (kể cả định dạng khác) thì không tạo lại
            jobs.append(Job(voice, seg, out_dir / voice["id"] / clip_name(seg, ext, voice)))
    return jobs


def build_manifest(segments: Iterable[Segment], voices: Iterable[dict], out_dir: Path) -> dict:
    """Manifest cho game (AudioManifest ở apps/game/src/audio/speaker.ts): chỉ ghi file thật sự có."""
    segments = list(segments)
    manifest: dict = {"voices": [], "clips": {}}
    for voice in voices:
        clips: dict[str, str] = {}
        for seg in segments:
            if seg.lang != voice["lang"]:
                continue
            for ext in CLIP_EXTS:
                if (out_dir / voice["id"] / clip_name(seg, ext, voice)).exists():
                    clips[seg.key] = f"audio/{voice['id']}/{clip_name(seg, ext, voice)}"
                    break
        if clips:
            entry = {k: voice[k] for k in ("id", "lang", "engine", "label") if k in voice}
            if voice.get("credit"):
                entry["credit"] = voice["credit"]
            manifest["voices"].append(entry)
            manifest["clips"][voice["id"]] = clips
    return manifest


# ---- Bộ đọc --------------------------------------------------------------------------------------
# Mỗi bộ đọc nhận (voice, text, đường dẫn .wav) và ghi file WAV.

Synth = Callable[[dict, str, Path], None]


def vieneu_engine() -> Synth:
    from vieneu import Vieneu  # pip install vieneu (CPU dùng ONNX, không cần torch)

    tts = Vieneu()

    def synth(voice: dict, text: str, wav: Path) -> None:
        audio = tts.infer(text, voice=voice["voice"]) if voice.get("voice") else tts.infer(text)
        tts.save(audio, str(wav))

    return synth


def kokoro_engine() -> Synth:
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline  # pip install kokoro soundfile

    pipelines: dict[str, KPipeline] = {}

    def synth(voice: dict, text: str, wav: Path) -> None:
        code = voice.get("langCode", "a")
        if code not in pipelines:
            pipelines[code] = KPipeline(lang_code=code)
        chunks = [audio for _, _, audio in pipelines[code](text, voice=voice["voice"])]
        sf.write(str(wav), np.concatenate(chunks), 24000)

    return synth


def voicevox_engine(base_url: str) -> Synth:
    import urllib.parse
    import urllib.request

    def post(path: str, params: dict, body: bytes | None = None) -> bytes:
        url = f"{base_url}{path}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, data=body or b"", method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.read()

    def synth(voice: dict, text: str, wav: Path) -> None:
        speaker = voice["speaker"]
        query = post("/audio_query", {"text": text, "speaker": speaker})
        wav.write_bytes(post("/synthesis", {"speaker": speaker}, query))

    return synth


def make_engines(names: set[str], voicevox_url: str) -> dict[str, Synth]:
    factories: dict[str, Callable[[], Synth]] = {
        "vieneu": vieneu_engine,
        "kokoro": kokoro_engine,
        "voicevox": lambda: voicevox_engine(voicevox_url),
    }
    unknown = names - factories.keys()
    if unknown:
        raise SystemExit(f"Bộ đọc không hỗ trợ: {', '.join(sorted(unknown))}")
    return {name: factories[name]() for name in names}


def ffmpeg_path() -> str | None:
    """ffmpeg trong PATH, hoặc bản đi kèm gói imageio-ffmpeg (pip install imageio-ffmpeg)."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def encode(wav: Path, target: Path) -> None:
    """Nén sang AAC nếu đích là .m4a (cần ffmpeg), không thì giữ WAV."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.suffix == ".wav":
        shutil.move(str(wav), target)
        return
    # Ghi ra file tạm rồi mới đổi tên: ffmpeg lỗi giữa chừng không để lại file hỏng bị coi là đã tạo.
    partial = target.with_name(f"{target.stem}.part{target.suffix}")
    try:
        subprocess.run(
            [ffmpeg_path() or "ffmpeg", "-loglevel", "error", "-y", "-i", str(wav)]
            + ["-c:a", "aac", "-b:a", "48k", "-ac", "1", str(partial)],
            check=True,
        )
        partial.replace(target)
    finally:
        partial.unlink(missing_ok=True)


def run(jobs: list[Job], engines: dict[str, Synth]) -> int:
    done = 0
    with tempfile.TemporaryDirectory() as tmp:
        for i, job in enumerate(jobs, 1):
            wav = Path(tmp) / f"{i}.wav"
            print(f"[{i}/{len(jobs)}] {job.voice['id']}: {job.segment.text[:60]}")
            try:
                engines[job.voice["engine"]](job.voice, job.segment.text, wav)
                encode(wav, job.path)
                done += 1
            except Exception as err:  # một câu lỗi không làm dừng cả lượt
                print(f"  ✗ lỗi: {err}", file=sys.stderr)
    return done


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--speech", type=Path, default=DEFAULT_SPEECH)
    p.add_argument("--voices", type=Path, default=DEFAULT_VOICES)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--voice", action="append", help="chỉ tạo cho giọng này (lặp lại được)")
    p.add_argument("--lang", choices=["vi", "en", "ja"])
    p.add_argument("--limit", type=int)
    p.add_argument("--voicevox-url", default="http://127.0.0.1:50021")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)

    if not args.speech.exists():
        raise SystemExit(f"Chưa có {args.speech}. Chạy ở gốc repo: pnpm speech-list")
    segments = load_segments(args.speech)
    voices = load_voices(args.voices)
    if args.voice:
        voices = [v for v in voices if v["id"] in args.voice]

    ext = "m4a" if ffmpeg_path() else "wav"
    jobs = plan(segments, voices, args.out, ext, args.lang, args.limit)
    print(f"{len(segments)} câu, {len(voices)} giọng, cần tạo {len(jobs)} file (.{ext}).")
    if ext == "wav":
        print("⚠ Không thấy ffmpeg: ghi WAV (nặng gấp ~10 lần). Cài ffmpeg (hoặc pip install imageio-ffmpeg) để nén AAC.")

    if not args.dry_run and jobs:
        engines = make_engines({j.voice["engine"] for j in jobs}, args.voicevox_url)
        print(f"Đã tạo {run(jobs, engines)}/{len(jobs)} file.")

    all_voices = load_voices(args.voices)
    if not args.dry_run:
        manifest = build_manifest(segments, all_voices, args.out)
        (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Đã ghi {args.out / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
