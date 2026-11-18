# Giọng đọc và âm thanh

## 1. Game đọc to thế nào

1. Màn chơi gọi `speaker.say([...đoạn])` (`apps/game/src/audio/index.ts`). Mỗi đoạn có `lang` (vi/en/ja) và `text`.
2. `Speaker` (`src/audio/speaker.ts`) tìm file tạo sẵn trong `audio/manifest.json`: ưu tiên giọng người chơi chọn,
   rồi giọng đầu tiên của ngôn ngữ đó có file.
3. Có file → phát bằng `<audio>`. Không có file, hoặc file không phát được (lỗi tải, trình duyệt không giải mã được,
   bị chặn tự phát) → đọc bằng giọng của máy (`speechSynthesis`), ưu tiên giọng chạy trên máy; giọng online chỉ dùng khi có mạng.
4. Lượt đọc mới huỷ lượt cũ. Màn chơi báo chỉ số đoạn đang đọc để tô sáng phụ đề.

Loại đoạn:

| Hàm | Dùng cho | Khi người chơi tắt tiếng Việt |
|---|---|---|
| `termSegment(deck, item)` | Từ đang học (tiếng Nhật đọc theo かな) | Vẫn đọc |
| `translationSegment(text)` | Nghĩa, dịch ví dụ, giải thích, Hán Việt | **Bỏ** |
| `viSegment(text)` | Lời hướng dẫn / khen / nhắc của Tomo | Vẫn đọc |

## 2. Bộ đọc đã chốt

| Ngôn ngữ | Bộ đọc | Ghi chú |
|---|---|---|
| Tiếng Việt | [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) (Apache-2.0) | Chạy CPU bằng ONNX, mô hình ~0,3–1 GB |
| Tiếng Nhật | [VOICEVOX](https://voicevox.hiroshiba.jp/) | Máy chủ đọc cổng 50021; ghi công bắt buộc — [giong-voicevox.md](giong-voicevox.md) |
| Tiếng Anh | VieNeu-TTS hoặc [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Chờ nghe so sánh (Q-17 trong kịch bản). Kokoro cần PyTorch |

Người chơi chọn giọng trong Cài đặt; mỗi ngôn ngữ 2–3 giọng, nhân vật giữ giọng cố định (kịch bản mục 10.3).

## 3. Tạo sẵn âm thanh (tools/tts)

```bash
pnpm speech-list                               # ở gốc repo: xuất tools/tts/speech-list.json
cd tools/tts
python -m venv .venv && .venv/Scripts/activate # Windows; Linux/macOS: source .venv/bin/activate
pip install vieneu soundfile imageio-ffmpeg
docker run --rm -p 50021:50021 voicevox/voicevox_engine:cpu-latest   # cho tiếng Nhật
python generate.py --dry-run                   # xem cần tạo bao nhiêu file
python generate.py                             # tạo phần còn thiếu, ghi apps/game/public/audio/manifest.json
python generate.py --lang en --limit 50        # 50 câu tiếng Anh đầu tiên, để nghe so sánh
python generate.py --voice en-kokoro-heart     # chỉ một giọng
python -m unittest                             # test của công cụ
```

Kokoro: dùng môi trường ảo riêng (`pip install kokoro soundfile`) vì kéo theo PyTorch.
Dung lượng cần: khoảng 5 GB trống cho cả ba bộ đọc.

- Giọng khai báo ở `tools/tts/voices.json` (`id`, `lang`, `engine`, `label`, tham số bộ đọc, `credit` cho VOICEVOX,
  `enabled`).
- File ra: `apps/game/public/audio/<giọng>/<mã>.m4a` (AAC 48 kbps, mono — phát được trên mọi trình duyệt kể cả Safari/iOS).
  Không có ffmpeg thì ghi `.wav` (nặng hơn nhiều).
- Tên file = băm của câu + cấu hình giọng + `AUDIO_FORMAT_VERSION`. Đổi giọng hay tham số thì tên file đổi, máy người chơi
  tải bản mới. **Đổi cách nén / chất lượng thì tăng `AUDIO_FORMAT_VERSION`** trong `generate.py`.
- File đã có (mọi định dạng) thì bỏ qua; ghi qua `*.part.m4a` rồi đổi tên, nên ffmpeg lỗi không để lại file hỏng.

## 4. Chơi không cần mạng

- Âm thanh **không** nằm trong precache của Workbox (precache không trả lời được yêu cầu Range mà Safari dùng cho `<audio>`).
- Service worker phục vụ `audio/*.m4a|ogg|mp3|wav` bằng CacheFirst có `rangeRequests` (cache `tomo-audio-v1`,
  `apps/game/vite.config.ts`).
- Khi có mạng, `warmAudioCache` (`src/audio/offlineCache.ts`) tải sẵn mọi file trong manifest vào cache đó và xoá file
  không còn trong manifest.
- Thêm định dạng mới vào `CLIP_EXTS` thì thêm vào `urlPattern`; test `test_every_clip_format_is_cached_for_offline` canh việc này.

## 5. Ghi công

Màn Cài đặt → "Ghi công giọng đọc" liệt kê `credit` của mọi giọng có trong manifest. Thêm cùng dòng đó vào mô tả trên
Google Play / App Store và trang giới thiệu bản web.
