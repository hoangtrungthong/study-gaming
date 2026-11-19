# Rule của dự án study-gaming

File này là nguồn rule duy nhất cho người và cho mọi công cụ AI (Claude Code, Codex, Cursor, Copilot, Kiro).
Các file `CLAUDE.md`, `.cursor/rules/project.mdc`, `.github/copilot-instructions.md`, `.kiro/steering/project.md`
chỉ trỏ về đây. Sửa rule thì sửa ở file này.

## 1. Dự án là gì

Game học tiếng Anh, tiếng Nhật và IT cho nhiều độ tuổi, chơi trên app và trình duyệt (điện thoại, máy tính).
Kịch bản và mọi quyết định đã chốt: [docs/game-design.md](docs/game-design.md), mục 12.
Bản đồ code: [docs/ai/00-overview.md](docs/ai/00-overview.md).

## 2. Nguyên tắc sản phẩm (không được phá)

1. **Chơi được khi không có mạng.** Mọi thứ game cần (code, phông, hình, âm thanh) phải có sẵn trên máy sau lần mở đầu.
   Thêm loại file mới thì kiểm `apps/game/vite.config.ts` (precache hoặc `runtimeCaching`).
2. **Nghe thay vì đọc.** Mọi giải thích (nghĩa, ví dụ, ngữ pháp, lời nhắc) phải được đọc thành tiếng. Chữ chỉ là phụ đề.
3. **Song ngữ.** Nội dung có cả ngôn ngữ đang học và tiếng Việt. Dòng dịch tiếng Việt dùng `translationSegment`
   (người học tắt tiếng Việt thì bỏ dòng này); lời hướng dẫn của Tomo dùng `viSegment` (luôn đọc).
4. **Dễ chơi cho mọi tuổi.** Ba nhóm Mầm (5–8) / Chồi (9–14) / Cây (15+) khác nhau ở tốc độ, số lượng, cỡ chữ
   (`apps/game/src/games/ageConfig.ts`). Nhóm Mầm không đếm giờ, không quảng cáo.
5. **Không phạt nặng.** Sai thì gợi ý và làm lại; không khoá màn.
6. **Tiếng Nhật nhận cả bộ gõ và romaji** (`nn` và `n` đều là ん). Kanji luôn có `reading` (かな) và `hanViet`.
7. **Dữ liệu trẻ em:** không gửi dữ liệu cá nhân ra ngoài khi chưa cần; không log email, số điện thoại, OTP,
   nội dung chuyển khoản.

## 3. Quy tắc quyết định

- **Điểm người dùng (chủ sản phẩm) chưa chọn thì hỏi lại, không tự quyết.** Ghi câu hỏi vào mục 12.2 của kịch bản,
  kèm đề xuất và lý do. Khi đã chốt, chuyển sang mục 12.1. Trong spec, mọi điểm chưa chọn nằm ở danh sách **"Chờ chốt"**;
  đề xuất được ghi nhưng phải gắn nhãn "đề xuất", không viết như đã quyết, không để "chốt khi review".
- **Tra cứu trước khi hỏi:** trước khi hỏi một câu thiết kế, xem code hiện có, kịch bản và nguồn ngoài (giá, giấy phép,
  giới hạn gói miễn phí); đưa kết quả (kèm `file:dòng` hoặc link) vào câu hỏi, lựa chọn theo hiện trạng đứng đầu.
- Không dựng lại game có sẵn của người khác (tên, nhân vật, hình, nhạc, màn chơi). Nhân vật Tomo và các trò là thiết kế riêng.
- Câu hỏi luyện thi chứng chỉ (AWS, Google Cloud, JLPT…) phải tự soạn, không dùng câu lộ từ đề thật.
- Giọng đọc, hình, phông phải có giấy phép dùng thương mại. Giọng VOICEVOX phải ghi công `VOICEVOX:<tên>`
  ([docs/voicevox-voices.md](docs/voicevox-voices.md)).

## 4. Lệnh

Chạy ở gốc repo, Node 22 + pnpm 11. Trên máy này Node mặc định là 16, phải dùng:
`export PATH="/c/Users/thonght/AppData/Local/nvm/v22.22.2:$PATH"`.

| Việc             | Lệnh                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Cài              | `pnpm install`                                                                            |
| Chạy thử         | `pnpm dev` (http://localhost:5173)                                                        |
| Lint / format    | `pnpm lint` · `pnpm format:check` (sửa: `pnpm format`)                                    |
| Kiểm kiểu        | `pnpm typecheck`                                                                          |
| Unit test        | `pnpm test` · độ phủ: `pnpm -r test:coverage`                                             |
| Build            | `pnpm build`                                                                              |
| E2E              | `pnpm e2e` (lần đầu: `pnpm --filter @study/game exec playwright install chromium`)        |
| Công cụ âm thanh | `pnpm speech-list`, rồi `cd tools/tts && python generate.py` · test: `python -m unittest` |
| Dữ liệu nét kana | `pnpm kana-strokes` (sinh `data/kana-strokes.json` từ SVG KanjiVG ở `vendor/kanjivg/`)    |

Không có lệnh nào khác được cấu hình. Đừng tự chạy lệnh dự án không khai báo.

**Docker (đã chốt 2026-11-18):** máy chủ chạy trên máy ảo Ubuntu bằng Docker Compose, và phát triển cũng dùng Docker (như medicine-management). Đã có service `game` (`docker-compose.yml`, `docker/dev.Dockerfile`): mọi lệnh ở bảng trên chạy được trong container bằng `docker compose exec -T game <lệnh>` (vd. `docker compose exec -T game pnpm test`), sau khi `docker compose up -d --build game`. Máy chủ + PostgreSQL thêm vào trong spec `mvp-accounts`. Các bước ở [docs/deploy.md](docs/deploy.md) mục 2. Không chạy `docker compose down -v` (xoá volume là mất dữ liệu).

## 5. Làm một tính năng

Theo quy trình của medicine-management:

1. **Spec trước** ở `.kiro/specs/<tên>/`:
   - `requirements.md`: giới thiệu + hiện trạng đã rà trong code (kèm `file:dòng`), **"Quyết định đã thống nhất"**,
     **"Chờ chốt"**, thuật ngữ, các yêu cầu (user story + tiêu chí đánh số).
   - `design.md`: tổng quan các lớp, mô hình dữ liệu, API / màn hình, offline, test.
   - `tasks.md`: nhánh, thứ tự theo phụ thuộc, việc có ô `- [ ]`, mỗi việc kèm test; việc cuối là tài liệu và DoD.
     Hỏi hết "Chờ chốt" trước khi code phần phụ thuộc vào chúng.
2. **Nhánh** từ `main` mới nhất (mục 8), làm theo `tasks.md`, đánh dấu `- [x]` khi xong.
3. **Test + cổng:** mục 7. **DoD:** skill `dod-report`, báo cáo ở `docs/dod/`.
4. **Tài liệu cùng commit:** spec, `docs/feature-checklist.md`, `docs/ai/` khi lệch với code. Bước vận hành (build, deploy,
   tạo âm thanh, khoá ký app) ghi vào tài liệu tương ứng (`docs/audio.md`, `docs/deploy.md` khi có), không chỉ nói trong chat.

## 6. Viết code

- Đọc [docs/ai/40-conventions.md](docs/ai/40-conventions.md) và [docs/ai/50-stack-patterns.md](docs/ai/50-stack-patterns.md)
  trước khi viết. Copy theo file mẫu trong bảng "file để copy".
- Luật chơi tách khỏi phần vẽ: luật ở class TS thuần (`MatchGame`, `RainGame`) có unit test; Phaser chỉ vẽ.
- Chữ giao diện và lời giải thích bằng tiếng Việt, câu ngắn, dễ nghe. Comment trong code bằng tiếng Việt, chỉ để giải
  thích ràng buộc mà code không tự nói được.
- **Tên file, thư mục, route bằng tiếng Anh**, không dùng tiếng Việt (kể cả không dấu): file code, tài liệu (`docs/*.md`),
  thư mục spec (`.kiro/specs/<tên>/`), báo cáo DoD, ảnh, route / đường dẫn URL, tên nhánh, id slug trong dữ liệu.
  Nội dung bên trong (chữ giao diện, tài liệu, comment) vẫn bằng tiếng Việt.
- Không thêm thư viện trùng chức năng với thư viện đã có. Thêm thư viện thì hỏi trước.
- Sửa warning như sửa lỗi: lint, typecheck, build, test phải sạch, không cảnh báo (kể cả cảnh báo Vue / console trong test).

## 7. Test và xong việc

- Mỗi thay đổi có test: logic → Vitest; luồng người dùng thấy → Playwright (`apps/game/e2e`, khổ máy tính + điện thoại).
- File code bị đổi phải đạt **100% dòng**, kiểm bằng `pnpm coverage:changed` (sau `pnpm -r test:coverage`), CI chặn khi thiếu. Dòng thật sự không test được bằng unit test (vẽ Phaser, điểm khởi động) thì
  `/* v8 ignore … -- lý do */` và phải có E2E phủ.
- Fix bug: viết test tái hiện lỗi (đỏ) trước, sửa cho xanh.
- Không xoá, không skip, không nới test để cho xanh.
- Thay đổi giao diện: xem ảnh chụp ở khổ điện thoại và máy tính (E2E lưu ở `apps/game/test-results/`).
- Code xong, mọi bước xanh thì chạy skill **`dod-report`** (`.claude/skills/dod-report/`): checklist 15 mục, ghi báo cáo
  vào `docs/dod/`.

## 8. Git

- Nhánh chính `main`, remote `origin` (GitHub). Mọi thay đổi làm trên nhánh `feat/…`, `fix/…`, `chore/…`, `docs/…`,
  `refactor/…`, `test/…` rồi mở PR vào `main`. Không commit, push thẳng hay force-push lên `main`.
- Commit message: `type(scope): tóm tắt` (≤ 100 ký tự), type ∈ feat fix chore docs refactor test perf style build ci revert.
- Không ghi dòng ghi công agent (`Co-authored-by` của AI, "Generated with …") vào commit hay PR.
- **Commit / push chỉ khi người dùng bảo.** Công cụ AI làm tới bước tạo PR; PR không cần người duyệt, chủ repo tự merge.
- Bật git hook một lần cho mỗi clone: `git config core.hooksPath .githooks`
  (chặn commit thẳng lên `main`, file bí mật, file > 5 MB, nội dung bài học sai, ESLint, định dạng commit message).
- Không commit: `.env*` thật, khoá ký app, `google-services.json`, `tools/tts/speech-list.json` (sinh ra), `dist/`, `coverage/`.

## 9. Tài liệu

- Lệch giữa tài liệu và code thì sửa tài liệu cùng commit với code, ghi `file:dòng` khi trích.
- Danh mục tài liệu: [docs/README.md](docs/README.md). Trạng thái từng mục kịch bản: [docs/feature-checklist.md](docs/feature-checklist.md).
