# Soạn nội dung bài học

Bộ bài nằm ở `packages/content/data/`: `en.json` (Đảo Chữ Cái), `ja.json` (Đảo Hoa Anh Đào), `it.json` (Đảo Mạch Điện).
Kiểu dữ liệu: `packages/content/src/types.ts`.

## 1. Một từ (LearnItem)

```json
{
  "id": "ja-mizu",
  "term": "水",
  "reading": "みず",
  "hanViet": "THỦY",
  "emoji": "💧",
  "meaningVi": "nước",
  "example": "水を のみます。",
  "exampleVi": "Tôi uống nước.",
  "explainVi": "Chữ này đọc Hán Việt là Thủy, như trong thủy triều.",
  "accept": []
}
```

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | Có | Duy nhất, dạng `<môn>-<slug>` (`en-apple`, `ja-mizu`, `it-cpu`) |
| `term` | Có | Từ đang học, hiện to nhất |
| `reading` | Tiếng Nhật có kanji | Cách đọc bằng かな. Dùng để đọc to và làm đáp án khi gõ |
| `hanViet` | Tiếng Nhật có kanji | Âm Hán Việt, viết hoa (`THỦY`, `TIÊN SINH`) |
| `emoji` | Có | Hình minh hoạ. Không trùng với từ khác trong cùng bộ (khi ẩn tiếng Việt, chỉ còn hình) |
| `meaningVi` | Có | Nghĩa tiếng Việt, ngắn |
| `example` + `exampleVi` | Đi cùng nhau | Câu ví dụ bằng ngôn ngữ đang học và bản dịch |
| `explainVi` | Không | Giải thích ngắn, được đọc to — tối đa khoảng 15 giây đọc, câu đơn, dễ nghe |
| `accept` | Không | Cách gõ khác cũng được chấp nhận (`thanks`, `wi-fi`, `こんにちわ`) |

## 2. Quy tắc từng môn

**Tiếng Anh** — đáp án là `term`, không phân biệt hoa thường, bỏ dấu câu.

**Tiếng Nhật**
- Đáp án là `reading ?? term`, phải **chỉ gồm かな/カナ** (kiểm bởi `validateDeck`).
- Người chơi gõ bộ gõ tiếng Nhật hoặc romaji (Hepburn `konnichiha`, kiểu bộ gõ `konnnichiha`, `shi`/`si`, `tsu`/`tu` đều nhận).
- Katakana có dấu kéo dài (`コーヒー`) nhận cả `koohii`, `ko-hi-`.
- Chữ が/は đọc khác cách viết (`こんにちは` đọc "wa") thì thêm cách gõ theo âm vào `accept`.
- Kanji: luôn có `reading` và `hanViet`; giải thích nên nối âm Hán Việt với từ tiếng Việt quen thuộc.

**IT** — thuật ngữ giữ nguyên tiếng Anh (đọc bằng giọng tiếng Anh), giải thích bằng tiếng Việt với ví dụ đời thường.
Câu hỏi luyện thi chứng chỉ (AWS, Google Cloud) phải **tự soạn**, không dùng câu lộ từ đề thật.

## 3. Viết cho trẻ nghe

- Câu ngắn, từ phổ thông. Viết để **nghe** chứ không để đọc: tránh ký hiệu, viết tắt, ngoặc đơn.
- Không nội dung chính trị, tôn giáo, bạo lực, quảng cáo (cũng là điều khoản của giọng VOICEVOX).
- Mỗi bộ cần ít nhất 6 từ (đủ một màn Ghép Đôi nhóm Cây).

## 4. Kiểm và tạo âm thanh

```bash
pnpm --filter @study/content test   # validateDeck cho cả 3 bộ, id không trùng
pnpm speech-list                    # xuất danh sách câu cần đọc
cd tools/tts && python generate.py  # tạo âm thanh cho câu mới (xem docs/am-thanh.md)
```

Hook pre-commit cũng chạy kiểm nội dung khi `packages/content/data/` hoặc `src/` thay đổi.
Chưa tạo âm thanh thì game đọc bằng giọng có sẵn trên máy (nếu máy có giọng ngôn ngữ đó).

## 5. Câu cố định của Tomo

Lời chào, hướng dẫn, khen, nhắc ở `packages/content/src/phrases.ts`. Thêm câu mới vào đây (không viết thẳng trong màn)
để công cụ tạo sẵn âm thanh.
