# KanjiVG — file nguồn nét kana

- **Nguồn:** [KanjiVG](https://kanjivg.tagaini.net) ([github.com/KanjiVG/kanjivg](https://github.com/KanjiVG/kanjivg)),
  thư mục `kanji/`, commit `9d7220dfca09107dca2e0b0e45f90f696185e3c3` (tải ngày 2026-11-18).
- **Gồm:** 92 file SVG gốc, không sửa: 46 hiragana + 46 katakana cơ bản (CC-9), tên file là mã Unicode (`03042.svg` = あ).
- **Giấy phép:** Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0), bản đầy đủ ở [COPYING](COPYING).
  Copyright (C) 2009/2010/2011 Ulrich Apel.
- **Ghi công (bắt buộc):** "Nguồn nét chữ: KanjiVG (CC BY-SA 3.0), https://kanjivg.tagaini.net" — hiện ở màn Cài đặt
  (`apps/game/src/views/SettingsView.vue`) và nằm trong trường `license` của `data/kana-strokes.json`.
- **ShareAlike:** `data/kana-strokes.json` là dữ liệu dẫn xuất nên phát hành cùng giấy phép CC BY-SA 3.0 (chỉ file dữ liệu
  nét, không phải code game).
- **Sinh lại JSON:** `pnpm kana-strokes` (script `packages/content/scripts/build-kana-strokes.ts`). Thêm chữ: tải file
  `https://raw.githubusercontent.com/KanjiVG/kanjivg/<commit>/kanji/<mã>.svg` vào đây rồi chạy lại lệnh.
