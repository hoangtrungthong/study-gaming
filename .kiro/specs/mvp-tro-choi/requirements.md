# Tài liệu yêu cầu — Các trò chơi của MVP (mvp-tro-choi)

> Viết ngày 2026-11-18. Nguồn: `docs/kich-ban-game.md` (v0.8) mục 4, 5, 6, 7, 11, 12.

## Giới thiệu

Giai đoạn 1 (MVP) theo kịch bản mục 11 gồm "G1–G5 + W1 + W2 + J1 + I1; mỗi đảo 2 vùng". G1 (Ghép Đôi) và W2 (Mưa Chữ)
đã có từ giai đoạn 0. Spec này làm **7 trò mới** — G2 Hứng Sao, G3 Xếp Câu, G4 Nghe Chọn, G5 Lật Thẻ Nhớ, W1 Viết Lại Từ,
J1 Vẽ Kana, I1 Đưa Bit Về Nhà — và **mô hình dữ liệu + nội dung cho 2 vùng mỗi đảo** mà các trò cần (câu cho Xếp Câu,
dữ liệu nét cho Vẽ Kana, mê cung cho Đưa Bit Về Nhà, danh sách vùng / màn).

**Ngoài phạm vi** (spec khác):
- `mvp-tien-do-hoc`: lưu sao và tiến độ, chuỗi ngày, màn bản đồ đảo / vùng / màn, mở khoá. Spec này chỉ **tính** sao của
  một lượt chơi và trả kết quả ra ngoài (Yêu cầu 9); không lưu.
- Tài khoản, máy chủ, quảng cáo, gói bỏ quảng cáo, đóng gói Android (các spec MVP khác).
- Màn trùm cuối vùng, G6–G8, J2–J3, E1–E3, I2–I9 (giai đoạn 2 theo `docs/feature-checklist.md`).

### Hiện trạng đã rà trong code

- Luật trò chơi là class TS thuần nhận `Rng`: `MatchGame` (`apps/game/src/games/match/MatchGame.ts:7`), `RainGame`
  (`apps/game/src/games/rain/RainGame.ts:18`, `tick(dt)` trả sự kiện `:51`). Bộ sinh số có hạt giống `seededRng`
  (`apps/game/src/games/random.ts:17`), `sample`/`shuffle` (`:3`, `:12`).
- Sao: Ghép Đôi 3/2/1 theo số lần sai (`MatchGame.ts:23-27`); Mưa Chữ theo tỉ lệ trúng ≥ 0,9 / ≥ 0,6 (`RainView.vue:51-60`).
  Kết quả chỉ hiện ở `ResultPanel` (`apps/game/src/components/ResultPanel.vue:4`), không phát sự kiện ra ngoài, không lưu.
- Cấu hình nhóm tuổi: `RAIN_CONFIG`, `MATCH_CONFIG` dạng `Record<AgeGroup, …>` (`apps/game/src/games/ageConfig.ts:23-33`).
- Chỉ Mưa Chữ dùng Phaser, tải lazy (`RainView.vue:113`); cảnh có `/* v8 ignore file */` (`RainScene.ts:1`), chạm hạt mưa
  bằng `pointerdown` (`RainScene.ts:102`). Ghép Đôi là DOM thuần (`MatchView.vue:79-112`).
- Chưa có kéo-thả ở đâu cả. Chưa có **bàn phím ảo** cho nhóm Mầm: Mưa Chữ dùng bàn phím của máy cho mọi nhóm
  (`RainView.vue:104-106`), lệch với kịch bản mục 4 ("Mầm: bàn phím ảo chữ to, chỉ hiện các chữ cái có trong từ").
- Ô gõ: `<input>` HTML, không chấm khi đang soạn bằng bộ gõ, chấm ở `compositionend` (`RainView.vue:162-165`);
  `isCorrectAnswer` / `japaneseReadings` / `romajiPreview` (`packages/content/src/answer.ts:44`, `:73`, `:83`).
- Giọng đọc: `speaker.say` (`apps/game/src/audio/speaker.ts:65`), `termSegment` / `viSegment` / `translationSegment`
  (`packages/content/src/speech.ts:5-16`), câu cố định ở `phrases.ts:1`, `collectSpeech` gom câu cho công cụ âm thanh
  (`speech.ts:37`) — hiện chỉ gom `phrases` và thẻ từ.
- Dữ liệu: một bộ bài mỗi môn `packages/content/data/{en,ja,it}.json` (16 / 16 / 20 từ), kiểu `LearnItem`, `Deck`
  (`packages/content/src/types.ts:9-36`). **Không có** khái niệm vùng / màn, câu, nét chữ, mê cung. `validateDeck`
  (`packages/content/src/validate.ts:7`).
- Điều hướng: `App.vue` giữ `screen` (`App.vue:12`), `IslandView` chỉ có hai nút Ghép Đôi / Mưa Chữ (`IslandView.vue:16-25`).
- Offline: precache `js, css, html, svg, png, woff2, json` (`apps/game/vite.config.ts:26`), nên JSON nội dung mới và chunk
  JS lazy được precache sẵn.
- E2E: `apps/game/e2e/play.spec.ts`, `helpers.ts` (`findItem`, `typedAnswer`, `muteSpeech`, `shot`), project desktop + phone.

### Quyết định đã thống nhất (ràng buộc đầu vào)

Chỉ gồm điều có trong kịch bản mục 12.1 hoặc ghi như đã quyết trong thân kịch bản (không gắn [CHỜ CHỌN]).

1. Engine: **Vue 3 + Phaser**, bản web là PWA (12.1, Q-1/Q-28). **Phải chơi được khi không có mạng** (12.1).
2. Mọi đề bài và mọi câu giải thích sau khi trả lời đều **được đọc bằng giọng máy**, tạo sẵn file âm thanh
   (mục 5, 6.1, 12.1). Chữ là phụ đề; có nút 🔁 Nghe lại; chạm vào từ thì nghe từ đó (6.1).
3. **Song ngữ**: dòng trên ngôn ngữ đang học, dòng dưới tiếng Việt; nút "Ẩn tiếng Việt" (6.3). Kanji kèm かな và Hán Việt.
4. **Gõ tiếng Nhật nhận cả bộ gõ và romaji** (12.1, 10.6).
5. **Ba nhóm tuổi** khác nhau ở cách trình bày và độ khó, nội dung kiến thức giữ nguyên; **Mầm không đếm giờ**;
   gõ từ ở nhóm Mầm dùng **bàn phím ảo chữ to, chỉ hiện các chữ cái có trong từ**; Chồi/Cây dùng bàn phím của máy (mục 4).
6. **Không phạt nặng**: sai thì gợi ý và làm lại, không mất mạng, không khoá màn (mục 1). Một màn không quá 3 phút.
7. Cách chơi từng trò (mục 5):
   - G2 Hứng Sao: sao rơi, **kéo giỏ** hứng sao mang đáp án đúng; đề được đọc.
   - G3 Xếp Câu: **kéo các khối chữ** vào đúng thứ tự.
   - G4 Nghe Chọn: nghe một từ/câu, chọn hình hoặc chữ đúng.
   - G5 Lật Thẻ Nhớ: lật hai thẻ giống nghĩa.
   - W1 Viết Lại Từ: bước **bắt buộc** sau khi học một nhóm từ mới (12.1 "Bổ sung"). Tomo đọc nghĩa rồi đọc từ; hiện hình
     và ô trống theo số chữ; gõ đúng chữ nào ô đó sáng xanh; sai thì chữ rung đỏ và Tomo đọc lại chậm hơn; **sai 2 lần hiện
     chữ đầu, sai 3 lần hiện cả từ để chép**; gõ xong Tomo đọc lại từ và câu ví dụ. Ba mức Chép / Nhớ / Nghe viết,
     **tự tăng theo tiến bộ** (5.2).
   - J1 Vẽ Kana: tô theo nét hiragana/katakana **đúng thứ tự nét, có mũi tên chỉ hướng** (5.3).
   - I1 Đưa Bit Về Nhà: xếp khối lệnh (⬆️ đi tới, ↩️ rẽ trái, 🔁 lặp lại) để mèo Bit đi hết mê cung; kiến thức tuần tự,
     vòng lặp, điều kiện (5.5).
8. Nội dung đổ từ dữ liệu, thêm bài không cần viết code mới (mục 5). Cấu trúc đảo: 1 vùng = 6–10 màn + 1 màn trùm (mục 3).
9. Bố cục dọc trên điện thoại, ngang trên máy tính; **chạm và chuột như nhau**; bàn phím ảo bật thì vùng chơi co lên trên (10.6).
10. Giọng, hình, phông phải có giấy phép dùng thương mại; không dựng lại game của người khác (`AGENTS.md` mục 3).

### Điểm chốt thêm (2026-11-18)

Chủ sản phẩm **đồng ý toàn bộ đề xuất** ngày 2026-11-18: mỗi điểm dưới đây chốt theo phần **Đề xuất** của nó (phần tra cứu
và lý do giữ lại để biết vì sao). Điểm nào gắn nhãn **Còn mở** thì chưa chốt — xem `.kiro/specs/mvp-cho-chot.md`.

- **Chốt thêm 2026-11-18 — Đèn Pin là "gợi ý" dùng ở mọi màn MVP** (`mvp-cho-chot.md` mục 6.1): mỗi lần dùng một gợi ý riêng của trò (W1 hiện 1 chữ cái tiếp theo; G3 đặt đúng 1 khối; G4 loại 1 đáp án sai; G5 lật sáng 1 cặp trong 1 giây; Ghép Đôi loé sáng nghĩa đúng của từ đang chọn; G2 / Mưa Chữ làm chậm rơi 5 giây; J1 hiện lại nét mẫu; I1 tô sáng khối lệnh tiếp theo). Đã dùng gợi ý thì vẫn qua màn nhưng **không được 3 sao**. Bắt đầu 3 Đèn Pin; quảng cáo có thưởng +3 (tối đa 3 lần/ngày); nhóm Mầm được tặng 1 Đèn Pin mỗi ngày học. Màn trùm (giai đoạn 2) dùng chung kho này.

- **CC-1 — Hai vùng nào mỗi đảo?** Đề xuất: vùng 1–2 theo kịch bản mục 7: Anh "Bến Cảng ABC" + "Khu Vườn Màu"; Nhật
  "Cổng Torii" (hiragana) + "Phố Đèn Lồng" (katakana); IT "Xưởng Lắp Ráp" + "Mê Cung Của Bit". Lý do: đúng thứ tự học,
  hợp nhóm Mầm/Chồi (đối tượng thử nghiệm đầu), J1 rơi đúng vào vùng hiragana/katakana và I1 đúng vào "Mê Cung Của Bit".
- **CC-2 — Số màn mỗi vùng và có màn trùm trong MVP không?** Kịch bản: 6–10 màn + 1 màn trùm (mục 3); mục 11 không nhắc màn
  trùm ở MVP, checklist ghi màn trùm "giai đoạn 2". Đề xuất: **6 màn mỗi vùng, chưa có màn trùm** (36 màn cả 3 đảo). Lý do:
  mức tối thiểu của kịch bản, giảm khối lượng soạn nội dung; màn trùm trộn nhiều khuôn nên làm sau khi đủ khuôn.
- **CC-3 — Ai soạn nội dung 2 vùng (liên quan Q-4)?** Ước tính cần thêm: mỗi đảo ~40–60 từ, ~20–30 câu Xếp Câu; 92 kana;
  6–8 mê cung. Đề xuất: AI soạn nháp theo `docs/noi-dung-bai-hoc.md`, chủ sản phẩm duyệt; chưa bám CEFR/JLPT ở MVP. Lý do:
  Q-4 còn mở (kịch bản 12.2 mục 4); nháp có `validate*` chặn lỗi định dạng, người chỉ cần duyệt nghĩa.
- **CC-4 — Ranh giới với `mvp-tien-do-hoc` về dữ liệu vùng / màn.** Đề xuất: spec này định nghĩa kiểu `Region` / `Level` và
  file dữ liệu ở `packages/content` (vì là nội dung); `mvp-tien-do-hoc` đọc dữ liệu đó để vẽ bản đồ và lưu sao theo `Level.id`.
  Lý do: một nguồn nội dung, công cụ âm thanh gom câu từ cùng chỗ.
- **CC-5 — Ghép "bài" với "màn": W1 bắt buộc nằm ở đâu?** Kịch bản: "Sau khi học một nhóm từ mới, người học phải tự gõ lại
  từng từ thì mới xong bài" (5.2). Đề xuất: màn nào **giới thiệu từ mới** (cờ `newWords` trong dữ liệu màn) thì sau trò chính
  tự chuyển sang W1 với các từ đó, xong W1 mới tính xong màn; sao của màn = sao trò chính (W1 không trừ sao). Màn J1 và I1
  không có W1 (không dạy từ để gõ). Lý do: đúng "bước bắt buộc", không bắt gõ lại ở mọi màn ôn.
- **CC-6 — Trò nào cho môn / nhóm tuổi nào?** Kịch bản nói G1–G5 dùng chung ba môn, nhưng nội dung Mầm là "từ đơn", IT Mầm là
  "tư duy logic qua hình" (mục 4). Đề xuất: G2, G4, G5, W1 cho cả 3 môn, 3 nhóm; G3 Xếp Câu cho Anh và Nhật ở Chồi/Cây, nhóm
  Mầm xếp 2–3 khối kèm hình (ví dụ `red / apple`), IT vùng 1–2 **không** có G3; J1 chỉ đảo Nhật; I1 chỉ đảo IT.
  Lý do: vùng 1–2 IT là phần cứng và khối lệnh, chưa có câu để xếp.
- **CC-7 — Định dạng dữ liệu câu cho G3 và G4 (câu).** Đề xuất: file `packages/content/data/sentences/{en,ja}.json`,
  mỗi câu `{ id, chunks: string[], textVi, emoji?, accept?: string[][], distractors?: string[] }`; tiếng Nhật chia khối theo
  cụm (`りんごを / ください`), khối có kanji kèm `reading`; `accept` liệt kê thứ tự khác cũng đúng (tiếng Nhật đảo trật tự
  được). Lý do: giống cách viết câu ví dụ hiện có (`ja.json`: `"りんごを ください。"`), kiểm được bằng `validate`.
- **CC-8 — Nguồn dữ liệu nét kana cho J1 và giấy phép.** Đã tra (2026-11-18):
  - **KanjiVG**: có cả hiragana và katakana (ví dụ `kanji/03042.svg` = あ, `kanji/030a2.svg` = ア), nét là đường tâm theo thứ
    tự, khung 109×109; giấy phép **CC BY-SA 3.0**: phải ghi công và dẫn link kanjivg.tagaini.net, file dữ liệu sửa đổi phải
    phát hành cùng giấy phép ([kanjivg.tagaini.net](https://kanjivg.tagaini.net/), header trong file SVG).
  - **AnimCJK**: thư mục `svgsJaKana` 86 hiragana + 91 katakana, có đường tâm (median); SVG kana dùng được theo **LGPL**
    vì không lấy từ phông Arphic ([github.com/parsimonhi/animCJK](https://github.com/parsimonhi/animCJK)).
  - Tự vẽ 92 chữ: không vướng giấy phép nhưng tốn công, dễ sai thứ tự nét.
  Đề xuất: **KanjiVG**, script chuyển SVG → JSON (chỉ giữ đường nét và thứ tự), file JSON giữ giấy phép CC BY-SA 3.0 và ghi
  công ở màn Cài đặt / Ghi công cạnh ghi công VOICEVOX. Lý do: nguồn chuẩn, phổ biến, ShareAlike chỉ ràng buộc file dữ liệu
  nét (không phải code game) — **cần chủ sản phẩm chấp nhận điều kiện ShareAlike** trước khi dùng thương mại.
- **CC-9 — Bộ kana trong MVP.** Đề xuất: 46 hiragana cơ bản (vùng 1) + 46 katakana cơ bản (vùng 2); chữ có dấu ゛゜ và âm ghép
  chưa tô ở MVP. Lý do: vừa với 2 vùng, dữ liệu nhỏ (~92 file).
- **CC-10 — Cách chấm một nét ở J1 và độ dễ theo nhóm tuổi.** Đề xuất: lấy mẫu nét người vẽ và nét chuẩn thành 16 điểm, đúng
  khi (a) điểm đầu gần điểm đầu chuẩn, (b) điểm cuối gần điểm cuối chuẩn (đúng hướng), (c) khoảng cách trung bình nhỏ hơn
  ngưỡng; ngưỡng theo phần cạnh khung: Mầm 20%, Chồi 15%, Cây 10%. Mầm/Chồi luôn thấy chữ mờ + mũi tên; Cây thấy chữ mờ,
  mũi tên chỉ hiện sau khi sai. Sai thì nét mờ đi, mũi tên nhấp nháy, Tomo đọc "Bắt đầu từ chấm xanh nhé", vẽ lại nét đó.
  Lý do: thuật toán đơn giản, test được bằng dữ liệu cố định; tay trẻ nhỏ run nên ngưỡng rộng.
- **CC-11 — Vẽ bằng gì cho từng trò.** Đề xuất: **chỉ G2 Hứng Sao dùng Phaser** (vật rơi liên tục, giống Mưa Chữ); G3, G4, G5,
  W1, I1 dùng DOM Vue; J1 dùng **SVG trong Vue + Pointer Events**. Lý do: không phải tải ~1,4 MB Phaser cho trò tĩnh; DOM có sẵn
  `lang`, đọc màn hình, chữ Nhật sắc nét; SVG dùng thẳng đường nét KanjiVG. Luật vẫn ở class TS thuần (`AGENTS.md` mục 6).
- **CC-12 — Cách kéo-thả trên điện thoại.** API kéo-thả HTML5 dựa trên sự kiện chuột nên phần lớn trình duyệt di động không hỗ
  trợ ([DragDropTouch README](https://github.com/drag-drop-touch-js/dragdroptouch)). Đề xuất: tự làm bằng **Pointer Events**
  (`pointerdown/move/up`, `setPointerCapture`, CSS `touch-action: none`) trong một composable dùng chung, **không thêm thư viện**;
  luôn có cách thứ hai **chạm khối rồi chạm chỗ** (dùng được bằng bàn phím và trình đọc màn hình, dễ cho Mầm). Lý do: một cách cho
  chuột và chạm, không phụ thuộc polyfill; `AGENTS.md` mục 6 yêu cầu hỏi trước khi thêm thư viện.
- **CC-13 — G2 Hứng Sao: luật chi tiết.** Kịch bản không nói hứng nhầm thì sao, khi nào kết thúc. Đề xuất: mỗi đề có 1 sao đúng
  + 1–3 sao sai rơi cùng lúc; hứng sao sai → Tomo nhắc, đọc lại đề, **không mất mạng**, tính một lỗi; sao đúng rơi mất → đề đọc
  lại và sao đúng rơi lại; xong khi hứng đủ số đề. Điều khiển: kéo giỏ (chuột / ngón tay) + phím ← → trên máy tính. Theo nhóm:
  Mầm 5 đề, 1 sao sai, rơi chậm; Chồi 8 đề, 2 sao sai; Cây 10 đề, 3 sao sai, nhanh hơn. Đề là nghĩa tiếng Việt (đọc + hiện chữ),
  sao mang từ đang học; khi bật "Ẩn tiếng Việt" đề là hình emoji. Lý do: giữ "không phạt nặng", mỗi màn dưới 3 phút.
- **CC-14 — G4 Nghe Chọn: số lựa chọn và dạng lựa chọn.** Đề xuất: Mầm 3 lựa chọn **hình**, Chồi 4 lựa chọn hình + chữ, Cây 4
  lựa chọn **chỉ chữ** (nghĩa tiếng Việt, hoặc từ đang học khi đề là câu); số đề 5 / 8 / 10; sai thì loại lựa chọn đó, đọc lại,
  chọn tiếp. MVP chỉ nghe **từ và cụm từ ngắn**, câu (từ dữ liệu CC-7) cho Cây. Lý do: Mầm chưa đọc được chữ.
- **CC-15 — G5 Lật Thẻ Nhớ: số cặp và dạng thẻ.** Đề xuất: cặp = thẻ từ đang học + thẻ nghĩa (emoji + tiếng Việt; ẩn tiếng Việt thì
  chỉ emoji); Mầm 3 cặp (6 thẻ), Chồi 6 cặp, Cây 8 cặp; lật thẻ từ thì đọc từ; hai thẻ không khớp úp lại sau 1,2 giây
  (Mầm 1,8 giây); sao 3/2/1 theo số lần lật sai vượt số cặp. Lý do: lưới vừa màn điện thoại (tối đa 4×4).
- **CC-16 — G3 Xếp Câu: số khối, khối nhiễu, phản hồi.** Đề xuất: Mầm 2–3 khối, Chồi tối đa 5, Cây tối đa 8 + 1 khối nhiễu; số câu
  mỗi màn 4 / 5 / 6; Tomo đọc câu (tiếng Việt cho Mầm/Chồi đọc trước, Cây nghe câu gốc) rồi người chơi xếp; bấm "Xong" mới chấm,
  khối sai vị trí rung đỏ và bật ra; đúng thì đọc câu gốc + bản dịch. Lý do: chấm cả câu dễ hiểu hơn chấm từng khối.
- **CC-17 — W1: mức nào cho từ nào khi chưa có dữ liệu tiến độ?** "Tự tăng theo tiến bộ" cần dữ liệu lưu của `mvp-tien-do-hoc`.
  Đề xuất: `WriteGame` nhận mức theo từng từ từ ngoài vào; quy tắc lên mức (đúng ngay lần đầu 2 lượt liên tiếp thì lên một mức,
  sai 3 lần thì xuống một mức) đặt ở `mvp-tien-do-hoc`; khi chưa có, mức mặc định theo nhóm: Mầm **Chép**, Chồi **Nhớ**,
  Cây **Nhớ**. Lý do: tách luật chấm (spec này) khỏi lưu trữ (spec kia).
- **CC-18 — W1 với tiếng Nhật: "ô chữ" là gì?** Đề xuất: mỗi ô là một chữ かな của cách đọc (`ふたつ` → 3 ô); gõ romaji thì đổi sang
  かな rồi so từng ô; đang soạn bằng bộ gõ thì chưa so (chấm ở `compositionend`). Từ có kanji: gõ xong hiện kanji + Hán Việt.
  Lý do: khớp `primaryAnswer` (`answer.ts:64`) và cách chấm của Mưa Chữ.
- **CC-19 — Bàn phím ảo nhóm Mầm.** Kịch bản đã chốt "chỉ hiện các chữ cái có trong từ". Câu hỏi: (a) tiếng Nhật thì hiện các
  かな của từ, đúng không; (b) chữ lặp (`apple` có hai `p`) hiện một phím hay hai; (c) có sửa luôn Mưa Chữ nhóm Mầm sang bàn
  phím ảo trong spec này không. Đề xuất: (a) có; (b) một phím mỗi chữ khác nhau, xáo thứ tự; (c) có, vì hiện đang lệch kịch bản
  (`RainView.vue:104-106`) và dùng chung component. Lý do: ít phím → nút to; một component cho hai trò.
- **CC-20 — I1: bộ khối lệnh, cỡ mê cung theo nhóm, có "điều kiện" ở MVP không.** Kịch bản liệt kê ⬆️ ↩️ 🔁 và nói kiến thức có
  "điều kiện". Đề xuất: Mầm: đi tới, rẽ trái, **rẽ phải** (thêm, vì chỉ rẽ trái thì trẻ phải rẽ 3 lần), lưới 4×4, tối đa 6 khối;
  Chồi: thêm 🔁 lặp lại n lần (một tầng), lưới 5×5, tối đa 8 khối; Cây: lưới 6×6, có 🔁 lồng, **khối "nếu phía trước có tường
  thì…" để giai đoạn 2**. Chạy: Bit đi từng bước có hoạt ảnh, Tomo đọc lệnh đang chạy; đụng tường thì Bit dừng, khối lỗi sáng đỏ,
  Tomo giải thích, chương trình giữ nguyên để sửa (không phạt). Sao: 3 sao khi đi tới đích lần chạy đầu với số khối ≤ tối ưu,
  2 sao khi tới đích trong 3 lần chạy, còn lại 1 sao. Lý do: 2 vùng đầu là Mầm/Chồi; điều kiện cần cảm biến, làm sau.
- **CC-21 — I1: định dạng dữ liệu mê cung.** Đề xuất: `packages/content/data/mazes.json`, mỗi màn
  `{ id, grid: string[] ("#" tường, "." đường, "S" Bit + hướng, "H" nhà, "*" cá để nhặt), blocks: BlockKind[], maxBlocks,
  optimal, hintVi }`; `validateMaze` chạy lời giải tìm kiếm (BFS trên chương trình) để chắc mê cung giải được trong `maxBlocks`
  và `optimal` đúng. Lý do: người soạn sửa bằng mắt được, test tự bắt mê cung không giải được.
- **CC-22 — Hình nhân vật và vật thể (Q-6 chưa chốt).** Đề xuất: MVP dùng emoji và hình CSS (🐱 Bit, 🏠 nhà, ⭐ sao, 🧺 giỏ,
  thẻ màu), thay bằng hình chính thức khi chốt Q-6. Lý do: không chặn MVP vì phong cách hình; emoji có sẵn, không vướng giấy phép.
- **CC-23 — Đếm giờ cho Chồi / Cây trong các trò mới.** Kịch bản mục 4: Chồi "đếm giờ tuỳ chọn (lấy thêm sao)", Cây "Thử thách tốc
  độ". Đề xuất: **chưa làm trong spec này** (không đồng hồ ở mọi nhóm cho 7 trò mới), làm cùng `mvp-tien-do-hoc` hoặc sau. Lý do:
  sao thêm cần lưu tiến độ; giữ phạm vi nhỏ.
- **CC-24 — Kết quả một lượt chơi trả cho `mvp-tien-do-hoc`.** Đề xuất: mọi màn phát sự kiện `finish` với
  `LevelResult { levelId?, game, stars, firstTry: string[], wrong: string[] }` (id từ / câu / kana / mê cung); `wrong` dùng cho ôn
  tập sau này. Lý do: một hợp đồng chung cho 9 trò, spec tiến độ chỉ cần nghe một sự kiện.
- **CC-25 — Lối vào các trò trước khi có bản đồ vùng.** Bản đồ thuộc `mvp-tien-do-hoc`. Đề xuất: tạm thời `IslandView` liệt kê mọi
  trò của đảo (J1 chỉ đảo Nhật, I1 chỉ đảo IT), mỗi trò chơi với toàn bộ nội dung của 2 vùng; khi có bản đồ thì trò mở theo màn.
  Lý do: chơi thử và E2E được ngay, không chờ spec kia.
- **CC-26 — Ai nói lời hướng dẫn trong trò.** Đề xuất: MVP chỉ Tomo nói (giọng Việt, `viSegment`); câu của cô Lily / ông Haru / Bit
  làm sau khi chọn giọng nhân vật (Q-18, Q-23). Lý do: giọng nhân vật cố định cần chọn giọng và điều khoản riêng.
- **CC-27 — Lưu file nguồn KanjiVG trong repo?** (chỉ khi chọn KanjiVG ở CC-8). Đề xuất: commit 92 file SVG gốc (~2 KB/file,
  tổng ~200 KB) vào `packages/content/vendor/kanjivg/` kèm file giấy phép, script `pnpm kana-strokes` sinh JSON; ghi lệnh vào
  `AGENTS.md` mục 4. Lý do: dựng lại được khi không có mạng, rõ nguồn gốc; dung lượng nhỏ.

## Thuật ngữ

- **Vùng (Region)**: chương của một đảo (kịch bản mục 3), mã `<môn>-r<số>` (`ja-r1`).
- **Màn (Level)**: một lượt chơi một trò với một tập nội dung, mã `<vùng>-l<số>` (`ja-r1-l3`).
- **Khối (chunk)**: một mảnh câu trong Xếp Câu. **Khối lệnh (block)**: một lệnh trong Đưa Bit Về Nhà.
- **Nét chuẩn**: đường tâm của một nét kana theo thứ tự, trong khung 109×109.
- **Lần đầu đúng (firstTry)**: mục được trả lời đúng ngay lần thử đầu, dùng tính sao.

## Yêu cầu

### Yêu cầu 1 — Dữ liệu vùng, màn và nội dung mới

**User story:** Là người soạn bài, tôi muốn thêm vùng, màn, câu, kana và mê cung bằng file dữ liệu để không phải viết code.

1. Có kiểu `Region`, `Level`, `Sentence`, `KanaStrokes`, `MazeLevel` trong `packages/content/src/types.ts` [CC-4, CC-7, CC-21].
2. Mỗi đảo có đúng 2 vùng [CC-1], mỗi vùng có số màn theo [CC-2]; mỗi màn trỏ tới một trò và nội dung có thật.
3. `validate*` báo lỗi khi: id trùng / sai tiền tố, màn trỏ tới từ / câu / kana / mê cung không tồn tại, câu thiếu `textVi`,
   khối tiếng Nhật có kanji thiếu `reading`, kana thiếu dữ liệu nét, mê cung không giải được trong `maxBlocks`. Chạy trong
   `content.test.ts` và hook pre-commit như `validateDeck`.
4. `collectSpeech` gom thêm: câu (gốc + dịch), tên kana, câu cố định mới của các trò, để công cụ âm thanh tạo sẵn.
5. Nội dung soạn theo [CC-3]; mọi câu tiếng Việt viết để nghe, không quá ~15 giây đọc.

### Yêu cầu 2 — G2 Hứng Sao

**User story:** Là người chơi, tôi nghe đề rồi kéo giỏ hứng ngôi sao mang đáp án đúng.

1. Mỗi đề Tomo đọc nghĩa (tiếng Việt) và hiện phụ đề; các sao rơi mang từ đang học [CC-13].
2. Kéo giỏ bằng chuột hoặc ngón tay; trên máy tính có phím ← →. Giỏ không bị bàn tay che (giỏ nằm trên điểm chạm).
3. Hứng đúng: sao vỡ, đọc từ + nghĩa, sang đề mới. Hứng sai hoặc lỡ sao đúng: gợi ý và đọc lại đề, không mất mạng.
4. Số đề, số sao sai, tốc độ theo nhóm tuổi; Mầm không đồng hồ.
5. Chạm vào sao đang rơi thì nghe từ trên sao.
6. Xong thì hiện kết quả 1–3 sao và phát `LevelResult` [CC-24].

### Yêu cầu 3 — G3 Xếp Câu

**User story:** Là người chơi, tôi kéo các khối chữ thành câu đúng và nghe lại câu.

1. Đầu mỗi câu Tomo đọc đề [CC-16]; các khối xáo trộn ở khay dưới, hàng chỗ trống ở trên.
2. Kéo khối vào chỗ, hoặc chạm khối rồi chạm chỗ [CC-12]; kéo khối đã đặt ra lại khay được. Chạm khối thì nghe khối đó.
3. "Xong": đúng (theo thứ tự chuẩn hoặc một thứ tự trong `accept`) thì đọc câu gốc + bản dịch và sang câu mới; sai thì khối
   sai rung đỏ, trở về khay, Tomo gợi ý, làm lại.
4. Khối tiếng Nhật hiện chữ + かな; ẩn tiếng Việt thì không đọc bản dịch.
5. Kết quả và `LevelResult` như Yêu cầu 2.6.

### Yêu cầu 4 — G4 Nghe Chọn

**User story:** Là người chơi, tôi nghe một từ / câu và chọn hình hoặc chữ đúng.

1. Mỗi đề tự đọc từ / câu bằng ngôn ngữ đang học; nút 🔁 Nghe lại luôn có.
2. Lựa chọn theo nhóm tuổi [CC-14]; lựa chọn nhiễu lấy từ cùng vùng, không trùng emoji.
3. Đúng: hiện thẻ kiến thức (`KnowledgeCard`) và đọc. Sai: lựa chọn đó mờ đi, đọc lại đề, chọn tiếp.
4. Kết quả và `LevelResult`.

### Yêu cầu 5 — G5 Lật Thẻ Nhớ

**User story:** Là người chơi, tôi lật hai thẻ cùng nghĩa để ghép cặp.

1. Lưới thẻ úp theo nhóm tuổi [CC-15]; lật thẻ từ thì đọc từ, lật thẻ nghĩa thì đọc nghĩa (dòng dịch).
2. Hai thẻ cùng nghĩa: giữ ngửa, đọc thẻ kiến thức ngắn. Khác nghĩa: úp lại sau một lúc. Không lật được thẻ thứ ba khi hai thẻ
   đang ngửa.
3. Dùng được bằng bàn phím (mỗi thẻ là nút) và có nhãn cho trình đọc màn hình.
4. Kết quả và `LevelResult`.

### Yêu cầu 6 — W1 Viết Lại Từ

**User story:** Là người học, sau khi học nhóm từ mới tôi gõ lại từng từ để nhớ.

1. Mỗi từ: Tomo đọc nghĩa rồi đọc từ; hiện hình và ô trống bằng số chữ (tiếng Nhật: số かな [CC-18]).
2. Mức Chép: chữ mờ trong ô, gõ đè. Mức Nhớ: chỉ hình + tiếng. Mức Nghe viết: chỉ tiếng. Mức lấy theo [CC-17].
3. Gõ đúng chữ nào ô đó xanh. Sai: chữ rung đỏ, Tomo đọc lại từ chậm hơn (tốc độ × 0,8). Sai 2 lần: hiện chữ đầu. Sai 3 lần:
   hiện cả từ để chép.
4. Tiếng Nhật nhận bộ gõ và romaji, không chấm khi đang soạn chữ bằng bộ gõ.
5. Nhóm Mầm gõ bằng bàn phím ảo chữ to chỉ có các chữ của từ [CC-19]; Chồi/Cây dùng bàn phím máy, ô gõ được focus trong lần chạm
   (iOS) và vùng chơi không bị bàn phím che.
6. Gõ xong: đọc lại từ và câu ví dụ (+ bản dịch nếu bật tiếng Việt); từ có kanji hiện kanji + Hán Việt.
7. Chạy được độc lập (từ `IslandView`) và nối sau trò chính của màn có từ mới [CC-5].
8. Kết quả và `LevelResult` (firstTry = từ gõ đúng không cần gợi ý).

### Yêu cầu 7 — J1 Vẽ Kana

**User story:** Là người học tiếng Nhật, tôi tô từng nét kana đúng thứ tự và đúng hướng.

1. Dữ liệu nét lấy từ nguồn ở [CC-8], bộ kana theo [CC-9]; ghi công nguồn dữ liệu ở màn Ghi công nếu giấy phép yêu cầu.
2. Vào chữ: Tomo đọc tên chữ (giọng Nhật) và một từ ví dụ; hiện chữ mờ, chấm bắt đầu và mũi tên của nét kế tiếp.
3. Người chơi vẽ bằng ngón tay / chuột / bút; nét vẽ hiện theo tay. Thả tay thì chấm nét [CC-10]: đúng thì nét chuẩn hiện
   rõ, sang nét sau; sai thì xoá nét vẽ, mũi tên nhấp nháy, Tomo nhắc, vẽ lại (không giới hạn lần).
4. Vẽ xong chữ: chạy hoạt ảnh cả chữ theo thứ tự nét, đọc lại tên chữ. Nút 🔁 xem lại thứ tự nét bất kỳ lúc nào.
5. Vẽ không làm cuộn trang hay phóng to trên điện thoại.
6. Kết quả (sao theo số nét sai) và `LevelResult`.

### Yêu cầu 8 — I1 Đưa Bit Về Nhà

**User story:** Là người chơi, tôi xếp khối lệnh để mèo Bit đi tới nhà, học tuần tự và vòng lặp.

1. Mê cung lấy từ dữ liệu [CC-21]; khối lệnh theo nhóm tuổi [CC-20]; Tomo đọc đề và gợi ý `hintVi`.
2. Kéo khối từ khay vào chương trình (hoặc chạm khối để thêm vào cuối); đổi thứ tự, xoá khối; khối 🔁 có số lần và chứa khối con.
   Mỗi khối có tên đọc được (chạm nghe "đi tới", "rẽ trái"…).
3. "Chạy": Bit đi từng bước, khối đang chạy sáng lên. Tới nhà: thắng. Đụng tường / hết lệnh chưa tới: Bit dừng, khối lỗi
   sáng đỏ, Tomo giải thích; chương trình giữ nguyên để sửa. Có nút "Về chỗ cũ".
4. Không cho thêm quá `maxBlocks` khối (báo bằng lời).
5. Kết quả (sao theo [CC-20]) và `LevelResult`.

### Yêu cầu 9 — Dùng chung cho mọi trò mới

1. Luật ở class TS thuần nhận `Rng` (nếu có ngẫu nhiên), không đụng DOM; giao diện chỉ vẽ trạng thái.
2. Mọi đề, phản hồi đúng/sai, gợi ý, kết quả đều đọc qua `speaker.say` với `viSegment` / `translationSegment` / `termSegment`;
   câu cố định mới nằm trong `phrases.ts`. Gỡ màn thì `speaker.stop()`.
3. Ẩn tiếng Việt: bỏ dòng dịch (chữ và tiếng), lời Tomo vẫn đọc.
4. Cỡ chữ / nút theo nhóm tuổi (Mầm to hơn), nút chạm ≥ 48px; chữ ngoại ngữ có `lang`.
5. Chạy được khi không có mạng (chunk lazy và JSON được precache); E2E offline mở được ít nhất một trò mới.
6. Mỗi màn dưới 3 phút với cấu hình mặc định của từng nhóm.
7. Kết thúc phát `LevelResult` [CC-24]; không lưu gì (thuộc `mvp-tien-do-hoc`).
8. Lối vào tạm theo [CC-25].
