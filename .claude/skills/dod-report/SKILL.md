---
name: dod-report
description: Kiểm checklist xong việc của study-gaming (chơi offline, song ngữ + giọng đọc, nhóm tuổi, nội dung bài học, quảng cáo và gói bỏ quảng cáo, dữ liệu trẻ em) cho một feature hoặc fix bug, rồi ghi kết quả vào docs/dod/ và mô tả PR. TỰ CHẠY khi task đã code xong và test xanh, trước khi hỏi commit. Cũng chạy khi người dùng nói "viết báo cáo DoD", "đối chiếu DoD", "/dod-report", hoặc cần sửa một báo cáo đã có.
---

# Checklist xong việc

Một task feature / fix bug chỉ "xong" khi qua checklist ở mục 2, mỗi dòng có bằng chứng. Kết quả
ghi vào một file ngắn ở `docs/dod/` và chép bảng checklist vào mô tả PR.

Không áp dụng cho: chỉ sửa tài liệu / spec, đổi cấu hình agent, câu hỏi tra cứu, hoặc người dùng
nói không cần.

## 1. Cách làm

1. Ở gốc repo: `sh .claude/skills/dod-report/dod-scope.sh main`. Script in các mục bị diff chạm
   tới (3–9) và lệnh phải chạy. Mục không được in thì ghi "Không đổi" kèm lý do một dòng.
2. Chạy thật từng mục ở gốc repo bằng Node 22 (`export PATH="/c/Users/thonght/AppData/Local/nvm/v22.22.2:$PATH"`),
   đọc kết quả, giữ lại con số (vd. `118 passed, 0 failed`). Log dài thì ghi ra file và chỉ đọc phần cuối.
3. Ghi file báo cáo (mục 3), rồi báo người dùng những dòng còn thiếu bằng chứng.
4. Không commit cho tới khi người dùng duyệt. Báo cáo đi cùng commit của task.

## 2. Checklist

| # | Mục | Đạt khi |
|---|---|---|
| 1 | Đúng yêu cầu | Mỗi điểm của kịch bản (`docs/kich-ban-game.md`) hoặc spec (`.kiro/specs/<tên>/`) mà task nhận làm có code và có test chạm tới. Fix bug: test chặn tái phát đỏ trước bản sửa, xanh sau bản sửa |
| 2 | Test xanh | `pnpm test` chạy hết, 0 đỏ, không thêm `skip` / `todo` |
| 2a | Độ phủ 100% file bị đổi | Mỗi file code bị đổi trong `packages/*/src/`, `apps/*/src/` đạt **100% dòng**, tính cả phần cũ của file. Đo bằng mục 4.1. Dòng thật sự không test được bằng unit test (vẽ Phaser, `<audio>`, `speechSynthesis`) phải có `/* v8 ignore … */` kèm lý do, được E2E phủ, và liệt kê ở phần "Còn lại" |
| 2b | Lint, typecheck | `pnpm lint` và `pnpm typecheck` sạch, không cảnh báo |
| 3 | Chơi không cần mạng | Tính năng chạy khi mất mạng; file mới (hình, âm thanh, phông) nằm trong precache (`vite.config.ts` → `workbox.globPatterns`). E2E offline (`apps/game/e2e/offline.spec.ts`) xanh |
| 4 | Song ngữ, giọng đọc | Chữ giải thích mới có cả ngôn ngữ đang học và tiếng Việt; mọi giải thích được đọc thành tiếng (`cardSegments` / `phrases`). Câu đọc mới có trong `pnpm speech-list`; đã chạy `tools/tts` hoặc ghi rõ đang dùng giọng của máy. Kanji có `reading` và `hanViet` |
| 5 | Nhóm tuổi | Mầm / Chồi / Cây đều chơi được: tốc độ, số lượng, cỡ chữ, không đếm giờ cho Mầm. Có test cho cấu hình từng nhóm |
| 6 | Nội dung bài học | `validateDeck` sạch. Không chép đề thi thật (AWS, Google Cloud, JLPT…), câu hỏi tự soạn. Hình, giọng có giấy phép dùng thương mại; giọng VOICEVOX có dòng ghi công `VOICEVOX:<tên>` |
| 7 | Quảng cáo, mua bán | `ADS_ENABLED=false` thì bản build không có thư viện quảng cáo. Không quảng cáo cho nhóm Mầm, lúc đang chơi / gõ / nghe, lúc mất mạng. Trong app Android/iOS không nhắc chuyển khoản. Giá và quyền "đã mua" do máy chủ quyết, không tin client; webhook xử lý lặp không hại |
| 8 | Dữ liệu trẻ em, bảo mật | Không gửi dữ liệu cá nhân ra dịch vụ ngoài khi chưa cần; không log email, số điện thoại, OTP, nội dung chuyển khoản. Không có secret trong code |
| 9 | Cấu hình, build | Biến mới có trong file `.example` (chỉ tên). `pnpm build` xanh (gồm PWA). Bước build app / chạy `tools/tts` ghi ở `README.md` |
| 10 | Chạy thật, E2E | Thay đổi người dùng nhìn thấy có test Playwright (`pnpm e2e`) cho luồng chính và ảnh chụp ở khổ điện thoại và máy tính. Đổi app native thì thử trên máy hoặc emulator |
| 11 | Tài liệu | Kịch bản (`docs/kich-ban-game.md`: mục 12 đã chốt / còn chờ), spec đánh dấu task xong, `README.md` cập nhật khi lệch với code |
| 12 | Self review | Trước khi review chính thức, tự đọc lại toàn bộ diff theo checklist này, sửa những gì thấy được. Ghi số chỗ đã tự sửa |
| 13 | Review + phản biện | Theo mục 4.2: tối đa 3 vòng, mỗi finding Critical / High có 3 phản biện độc lập. Không còn finding Critical / High mở |
| 14 | Bảo mật | Lượt review riêng theo mục 4.3, tách khỏi review chung. Không còn finding Critical / High mở |
| 15 | CI xanh | Run GitHub Actions của PR xanh ở mọi job. Chưa push thì ghi **Chưa đạt** kèm "chờ CI" |

Kết quả mỗi dòng chỉ dùng: **Đạt**, **Không đổi** (diff không chạm, ghi lý do), **Chưa đạt**
(ghi thiếu gì). Task xong khi không còn dòng **Chưa đạt**. Mục 2, 2a, 2b, 13, 14, 15 không bao giờ được ghi
**Không đổi** khi diff có file code.

## 3. File báo cáo

`docs/dod/<ten-chuc-nang-hoac-loi>_<yyyy-mm-dd>.md` (kebab-case, không dấu). Sửa báo cáo cũ thì
sửa ngay file đó và ghi ngày sửa ở dòng đầu.

```markdown
# <Tên chức năng hoặc lỗi>

<Một đoạn: ngày, feature hay fix bug, mục kịch bản / spec / issue nguồn, nhánh và commit (`git log --oneline main..HEAD`).>

## Đã làm

- <thay đổi chính, có màn hình / trò chơi / lệnh>
- <fix bug: triệu chứng, nguyên nhân `file:dòng`, bản sửa>

## Checklist

| # | Mục | Kết quả | Bằng chứng / thiếu gì |
|---|---|---|---|
| 1 | Đúng yêu cầu | | |
| … | | | |
| 15 | CI xanh | | |

## Review

| Vòng | Phạm vi | Critical | High | Medium | Low | Bị phản biện bác |
|---|---|---|---|---|---|---|
| 1 | `main...HEAD` | | | | | |

## Còn lại

- <việc chưa làm, rủi ro, việc người dùng phải tự làm (tài khoản, thử trên máy thật). Không có thì ghi "Không có.">
```

## 4. Cách kiểm các mục khó

### 4.1 Độ phủ (mục 2a)

```bash
pnpm -r test:coverage
```

Mỗi gói in bảng % dòng theo file (`@vitest/coverage-v8`). Đọc dòng của các file bị đổi
(`git diff --name-only $(git merge-base main HEAD)`), file nào dưới 100% thì ghi các dòng chưa phủ.

### 4.1b E2E (mục 3, 10)

```bash
pnpm --filter @study/game exec playwright install chromium   # lần đầu
pnpm e2e
```

Playwright tự build và chạy `vite preview`, chạy ở khổ máy tính và điện thoại, có kịch bản mất mạng.

### 4.2 Review và phản biện (mục 13)

Review chạy bằng subagent của Claude Code (Agent tool, loại `general-purpose`), không dùng skill ngoài.

1. Vòng 1: mở song song mỗi chiều một reviewer, cùng phạm vi `git diff $(git merge-base main HEAD)` (gồm cả
   thay đổi chưa commit): đúng sai, nội dung bài học, hiệu năng (khung hình, bộ nhớ trên điện thoại yếu),
   offline, test, thiết kế. Mỗi reviewer nhận: lệnh xem diff, mục đích của thay đổi (phần "Đã làm"),
   `docs/kich-ban-game.md`, và **một** chiều. Trả về danh sách finding: vị trí `file:dòng`, mức
   (Critical / High / Medium / Low), nhận định, cách tái hiện.
2. Mỗi finding Critical / High đưa cho **3 subagent phản biện độc lập**, chạy song song. Mỗi agent chỉ nhận
   vị trí, mức, nhận định và lệnh xem diff, **không** nhận lập luận đã sinh ra finding. Yêu cầu agent cố bác
   bỏ bằng bằng chứng trong code, trả về `STANDS` hoặc `REFUTED` kèm `file:dòng`, mặc định `REFUTED` khi
   không chắc. Đa số (≥ 2/3) `STANDS` thì finding đứng; còn lại là bị bác, ghi lý do.
3. Sửa mọi finding đứng. Vòng sau chỉ review `git diff <commit đã review>..HEAD` cộng chỗ gọi tới phần vừa
   sửa, rồi phản biện như bước 2.
4. Dừng khi một vòng không còn finding Critical / High mới. Hết **3 vòng** mà vẫn còn thì dừng, ghi
   **Chưa đạt** và báo người dùng, không lặp tiếp.

Ghi vào báo cáo: số vòng, mỗi vòng có bao nhiêu finding theo mức, bao nhiêu bị phản biện bác.

### 4.3 Bảo mật (mục 14)

Một reviewer riêng (cùng cách ở mục 4.2 bước 1), chiều duy nhất là bảo mật: dữ liệu trẻ em và dữ liệu cá
nhân, đăng nhập (OTP, đặt lại mật khẩu, gộp tài khoản khách), mua bán (giá do máy chủ tính, xác minh biên
nhận cửa hàng, webhook chuyển khoản: chữ ký, xử lý lặp, khớp số tiền), quảng cáo cho trẻ em, nội dung tải
về (đường dẫn, kích thước), secret trong code / log. Finding Critical / High đi qua phản biện như mục 4.2.

## 5. Quy tắc viết

- Chỉ ghi điều đã chạy và đọc kết quả; bằng chứng là lệnh + con số, `file:dòng` hoặc hash commit.
  Chưa chạy thì ghi **Chưa đạt**, không ghi "chắc là đạt".
- Không ghi giá trị cấu hình, key, token, mật khẩu, OTP, dữ liệu người dùng thật.
- Tiếng Việt, câu ngắn, giữ nguyên tên trong code.
