# Rule của dự án study-gaming

File này là nguồn rule duy nhất cho người và cho mọi công cụ AI (Claude Code, Codex, Cursor, Copilot, Kiro).
Các file `CLAUDE.md`, `.cursor/rules/project.mdc`, `.github/copilot-instructions.md`, `.kiro/steering/project.md`
chỉ trỏ về đây. Sửa rule thì sửa ở file này.

## 1. Dự án là gì

Game học tiếng Anh, tiếng Nhật và IT cho nhiều độ tuổi, chơi trên app và trình duyệt (điện thoại, máy tính).
Kịch bản và mọi quyết định đã chốt: [docs/kich-ban-game.md](docs/kich-ban-game.md), mục 12.
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
  kèm đề xuất và lý do. Khi đã chốt, chuyển sang mục 12.1.
- Không dựng lại game có sẵn của người khác (tên, nhân vật, hình, nhạc, màn chơi). Nhân vật Tomo và các trò là thiết kế riêng.
- Câu hỏi luyện thi chứng chỉ (AWS, Google Cloud, JLPT…) phải tự soạn, không dùng câu lộ từ đề thật.
- Giọng đọc, hình, phông phải có giấy phép dùng thương mại. Giọng VOICEVOX phải ghi công `VOICEVOX:<tên>`
  ([docs/giong-voicevox.md](docs/giong-voicevox.md)).

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

Không có lệnh nào khác được cấu hình. Đừng tự chạy lệnh dự án không khai báo.

## 5. Viết code

- Đọc [docs/ai/40-conventions.md](docs/ai/40-conventions.md) và [docs/ai/50-stack-patterns.md](docs/ai/50-stack-patterns.md)
  trước khi viết. Copy theo file mẫu trong bảng "file để copy".
- Luật chơi tách khỏi phần vẽ: luật ở class TS thuần (`MatchGame`, `RainGame`) có unit test; Phaser chỉ vẽ.
- Chữ giao diện và lời giải thích bằng tiếng Việt, câu ngắn, dễ nghe. Comment trong code bằng tiếng Việt, chỉ để giải
  thích ràng buộc mà code không tự nói được.
- Không thêm thư viện trùng chức năng với thư viện đã có. Thêm thư viện thì hỏi trước.
- Sửa warning như sửa lỗi: lint, typecheck, build, test phải sạch, không cảnh báo.

## 6. Test và xong việc

- Mỗi thay đổi có test: logic → Vitest; luồng người dùng thấy → Playwright (`apps/game/e2e`, khổ máy tính + điện thoại).
- File code bị đổi phải đạt **100% dòng**. Dòng thật sự không test được bằng unit test (vẽ Phaser, điểm khởi động) thì
  `/* v8 ignore … -- lý do */` và phải có E2E phủ.
- Fix bug: viết test tái hiện lỗi (đỏ) trước, sửa cho xanh.
- Không xoá, không skip, không nới test để cho xanh.
- Thay đổi giao diện: xem ảnh chụp ở khổ điện thoại và máy tính (E2E lưu ở `apps/game/test-results/`).
- Code xong, mọi bước xanh thì chạy skill **`dod-report`** (`.claude/skills/dod-report/`): checklist 15 mục, ghi báo cáo
  vào `docs/dod/`.

## 7. Git

- Nhánh chính `main`, remote `origin` (GitHub). Mọi thay đổi làm trên nhánh `feat/…`, `fix/…`, `chore/…`, `docs/…`,
  `refactor/…`, `test/…` rồi mở PR vào `main`. Không commit, push thẳng hay force-push lên `main`.
- Commit message: `type(scope): tóm tắt` (≤ 100 ký tự), type ∈ feat fix chore docs refactor test perf style build ci revert.
- Không ghi dòng ghi công agent (`Co-authored-by` của AI, "Generated with …") vào commit hay PR.
- **Commit / push chỉ khi người dùng bảo.** Công cụ AI làm tới bước tạo PR; PR không cần người duyệt, chủ repo tự merge.
- Bật git hook một lần cho mỗi clone: `git config core.hooksPath .githooks`
  (chặn commit thẳng lên `main`, file bí mật, file > 5 MB, nội dung bài học sai, ESLint, định dạng commit message).
- Không commit: `.env*` thật, khoá ký app, `google-services.json`, `tools/tts/speech-list.json` (sinh ra), `dist/`, `coverage/`.

## 8. Tài liệu

- Lệch giữa tài liệu và code thì sửa tài liệu cùng commit với code, ghi `file:dòng` khi trích.
- Danh mục tài liệu: [docs/README.md](docs/README.md).
