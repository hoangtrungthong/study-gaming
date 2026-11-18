# Quy trình làm việc

## 1. Nhánh

- `main` là nhánh chính, chỉ nhận thay đổi qua Pull Request trên GitHub (`origin`).
- Tạo nhánh từ `main` mới nhất: `feat/<tên>`, `fix/<tên>`, `chore/<tên>`, `docs/<tên>`, `refactor/<tên>`, `test/<tên>`.
  Tên viết thường, gạch nối (`feat/rain-listen-mode`).
- Không commit thẳng, không push thẳng, không force-push lên `main`. Không viết lại lịch sử đã push.

## 2. Commit

- Định dạng: `type(scope): tóm tắt`, dòng đầu ≤ 100 ký tự, tiếng Việt.
  `type` ∈ feat fix chore docs refactor test perf style build ci revert; `scope` viết thường, không bắt buộc.
  Ví dụ: `feat(rain): đọc lại các từ đang rơi ở chế độ chỉ nghe`.
- Không ghi dòng ghi công AI (`Co-authored-by: Claude…`, "Generated with…"). Hook `commit-msg` tự xoá.
- Không commit file bí mật (`.env*` thật, khoá ký app, `google-services.json`), file > 5 MB, file sinh ra
  (`dist/`, `coverage/`, `tools/tts/speech-list.json`).
- Công cụ AI chỉ commit / push khi người dùng bảo.

## 3. Git hook

Bật một lần cho mỗi clone:

```bash
git config core.hooksPath .githooks
```

| Hook | Kiểm |
|---|---|
| `pre-commit` | Không commit lên `main` (trừ commit đầu tiên của repo); file bí mật, file > 5 MB, dòng giống secret; nội dung bài học hợp lệ; ESLint trên file đã stage |
| `commit-msg` | Xoá dòng ghi công AI; dòng đầu đúng `type(scope): tóm tắt`, ≤ 100 ký tự |
| `pre-push` | Không push lên `main`, không force-push |

## 4. Pull Request

1. Trước khi mở PR: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm -r test:coverage`, `pnpm build`, `pnpm e2e`,
   và `python -m unittest` trong `tools/tts` nếu đổi công cụ âm thanh. Tất cả xanh, không cảnh báo.
2. Chạy skill `dod-report`, chép bảng checklist vào mô tả PR, báo cáo ở `docs/dod/`.
3. Review theo `dod-report` mục 4.2: tối đa 3 vòng; finding Critical/High qua 3 phản biện độc lập; không còn Critical/High mở.
4. CI (`.github/workflows/ci.yml`) phải xanh: job `check` (lint, format, typecheck, test + độ phủ, build), `tts-tool`, `e2e`.
5. **Không cần người duyệt:** chủ repo tự xem và merge. Công cụ AI chỉ làm tới bước tạo PR, không tự merge.

## 5. Quyết định sản phẩm

Điểm chủ sản phẩm chưa chọn thì hỏi lại, không tự quyết: ghi vào mục 12.2 của `docs/kich-ban-game.md` kèm đề xuất,
chuyển sang 12.1 khi đã chốt. Tính năng lớn viết spec ở `.kiro/specs/<tên>/` (requirements, design, tasks) trước khi làm.
