# Soạn nội dung bài học

Bộ bài nằm ở `packages/content/data/`: `en.json` (Đảo Chữ Cái), `ja.json` (Đảo Hoa Anh Đào), `it.json` (Đảo Mạch Điện).
Ngoài từ còn có vùng và màn (`regions/`, mục 6), câu cho Xếp Câu (`sentences/`, mục 7), mê cung (`mazes.json`, mục 8) và
nét kana (`kana-strokes.json`, mục 9). Kiểu dữ liệu: `packages/content/src/types.ts`.

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
pnpm --filter @study/content test   # validateDeck / validateRegions / câu / mê cung / nét kana, id không trùng
pnpm speech-list                    # xuất danh sách câu cần đọc
cd tools/tts && python generate.py  # tạo âm thanh cho câu mới (xem docs/audio.md)
```

Hook pre-commit cũng chạy kiểm nội dung khi `packages/content/data/` hoặc `src/` thay đổi.
Chưa tạo âm thanh thì game đọc bằng giọng có sẵn trên máy (nếu máy có giọng ngôn ngữ đó).

## 5. Câu cố định của Tomo

Lời chào, hướng dẫn, khen, nhắc ở `packages/content/src/phrases.ts`. Thêm câu mới vào đây (không viết thẳng trong màn)
để công cụ tạo sẵn âm thanh.

## 6. Vùng và màn

Mỗi đảo một file `packages/content/data/regions/<môn>.json`. Một vùng gồm các màn; mỗi màn là một trò chơi với nội dung riêng.

```json
{
  "id": "en-r1",
  "subject": "en",
  "order": 1,
  "titleVi": "Bến Cảng ABC",
  "titleTarget": "ABC Harbor",
  "levels": [
    {
      "id": "en-r1-l1",
      "game": "match",
      "items": ["en-apple", "en-cat", "en-dog", "en-fish", "en-bird", "en-sun"],
      "newWords": ["en-apple", "en-cat", "en-dog"]
    }
  ]
}
```

| Trường | Ý nghĩa |
|---|---|
| `id` vùng | Đúng dạng `<môn>-r<order>` |
| `id` màn | Bắt đầu bằng `<id vùng>-l` (`en-r1-l1`), không trùng trong cả đảo |
| `game` | `match`, `rain`, `star`, `listen`, `memory`, `write`, `sentence` (không dùng cho IT), `kana` (chỉ tiếng Nhật), `maze` (chỉ IT) |
| `items` | Id từ dùng trong màn (trò từ vựng) |
| `newWords` | Từ mới của màn, tối đa 5. Có từ mới thì xong trò chính sẽ có nút "Tiếp: Viết Lại Từ" để gõ lại các từ đó (CC-5, CK-6) |
| `sentences` | Id câu, cho màn `sentence` |
| `kana` | Chữ kana, cho màn `kana`; phải có dữ liệu nét (mục 9) |
| `maze` | Id mê cung, cho màn `maze` |

`validateRegions` kiểm mọi id trỏ tới nội dung có thật, trò được dùng cho môn đó, và màn có đủ nội dung cho trò của nó.
Từ có trong bộ từ nhưng chưa vào màn nào được giữ cho các vùng sau (CK-10).

`validateRegionShape` kiểm hình dạng: mỗi đảo đúng 2 vùng, mỗi vùng 6 màn, mỗi màn tối đa 5 từ mới, từ mới nằm trong `items`
(khi màn có `items`), và màn Viết Lại Từ chỉ hỏi từ đã là từ mới ở màn đó hoặc trước đó. Màn Xếp Câu chỉ nên dùng từ đã dạy
ở màn đó hoặc trước đó.

## 7. Câu (Xếp Câu)

`packages/content/data/sentences/<môn>.json` (tiếng Anh và tiếng Nhật; đảo IT không có Xếp Câu).

```json
{
  "id": "ja-s-mizu-nomimasu",
  "chunks": ["水を", "のみます"],
  "readings": ["みずを", null],
  "textVi": "Tôi uống nước.",
  "emoji": "💧"
}
```

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | Có | Dạng `<môn>-s-<slug>` |
| `chunks` | Có | Các khối chữ theo đúng thứ tự, ít nhất 2 khối, không khối rỗng |
| `readings` | Tiếng Nhật có kanji | Cách đọc từng khối, `null` cho khối không có kanji; đủ số khối |
| `textVi` | Có | Nghĩa tiếng Việt của câu (Mầm / Chồi nghe câu này; tắt tiếng Việt thì nghe câu gốc, CK-2) |
| `emoji` | Không | Hình gợi ý |
| `accept` | Không | Thứ tự khác cũng đúng, mỗi phần tử là một cách xếp gồm đúng các khối của câu |
| `distractors` | Không | Khối nhiễu (nhóm Cây), không trùng khối của câu |

Khối so khớp phân biệt hoa thường. Tiếng Anh: cụm có thể đổi chỗ (`after the rain`, `in the sky`) viết thường và đặt cuối
câu, để không có thứ tự đúng nào bị chấm sai chỉ vì chữ hoa; thứ tự khác vẫn tự nhiên thì thêm vào `accept`. Emoji chọn
trong Unicode ≤ 12 để máy cũ hiện được.

## 8. Mê cung (Đưa Bit Về Nhà)

`packages/content/data/mazes.json`.

```json
{
  "id": "it-m-01",
  "grid": ["S..#", "##.#", "##H#", "####"],
  "dir": ">",
  "blocks": ["forward", "left", "right"],
  "maxBlocks": 6,
  "optimal": 5,
  "hintVi": "Đi tới hai ô, rẽ phải, rồi đi tới hai ô nữa."
}
```

| Trường | Ý nghĩa |
|---|---|
| `grid` | Các hàng bằng nhau; `#` tường, `.` đường, `S` chỗ Bit đứng (đúng một), `H` nhà (đúng một) |
| `dir` | Hướng Bit lúc đầu: `^` lên, `>` phải, `v` xuống, `<` trái |
| `blocks` | Khối được dùng: `forward`, `left`, `right`, `repeat` |
| `maxBlocks` | Số khối tối đa người chơi được xếp |
| `optimal` | Số khối của lời giải ngắn nhất, dùng chấm sao |
| `solution` | Bắt buộc khi có `repeat`: lời giải mẫu dùng khối lặp, đếm đúng bằng `optimal` |
| `hintVi` | Lời gợi ý Tomo đọc |

`validateMaze` tự tìm chương trình ngắn nhất (`shortestProgram`, `packages/content/src/maze.ts`: chỉ dùng các khối mê cung cho
phép, tối đa một tầng lặp, số lần lặp 2–9) và đòi `optimal` bằng đúng số khối đó; có `solution` thì chạy để chắc Bit về nhà
và dùng đúng `optimal` khối. Khối lặp không đặt được trong khối lặp khác (nhóm Cây được lặp lồng, có thể ngắn hơn `optimal`:
vẫn 3 sao).

## 9. Kana (Vẽ Kana)

Dữ liệu nét lấy từ KanjiVG (CC BY-SA 3.0): file SVG gốc ở `packages/content/vendor/kanjivg/` kèm giấy phép.
Thêm chữ kana mới:

1. Chép file SVG của chữ đó từ KanjiVG vào `packages/content/vendor/kanjivg/` (tên theo mã Unicode, ví dụ `03042.svg`).
2. Chạy `pnpm kana-strokes`: sinh lại `data/kana-strokes.json` (khung 109 × 109).
3. Thêm chữ vào `kana` của màn trong `regions/ja.json`; test kiểm chữ đó có dữ liệu nét.

Ghi công KanjiVG hiện ở màn Cài đặt, mục "Nguồn dữ liệu"; giữ nguyên khi thêm chữ.
