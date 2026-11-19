# Kế hoạch triển khai — Tiến độ học MVP (mvp-progress)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

Nhánh `feat/mvp-progress` từ `main` mới nhất. Thứ tự theo phụ thuộc: hỏi chờ chốt → kiểu và luật thuần → nội dung bản đồ
→ lưu trên máy → màn hình → nối trò chơi → E2E → tài liệu → DoD.
Mỗi việc kèm test; file code bị đổi đạt 100% dòng (`pnpm -r test:coverage` rồi `pnpm coverage:changed`). Không thêm thư viện.

- [x] 0. Hỏi chủ sản phẩm toàn bộ CC-1…CC-21 (`requirements.md`), ghi câu trả lời vào `docs/game-design.md` mục 12.1,
      chuyển các điểm đã chốt sang "Quyết định đã thống nhất" của spec. Chưa có câu trả lời thì không làm việc bị chặn.
- [ ] 1. Kiểu dữ liệu và khoá ngày (CC-21)
  - [ ] 1.1 `packages/content/src/progress/types.ts`: `ProgressDocV1`, `DeviceCounters`, `Mission`, `LevelResult`,
        `MapRegion`, `MapLevel`, `SyncRequestV1`, `SyncResponseV1` (design §2, §3.1, §5.1, §6); xuất qua `index.ts`
  - [ ] 1.2 `day.ts`: `dayKey`, `addDays`, `diffDays` theo giờ máy; test qua nửa đêm, cuối tháng, năm nhuận, đổi giờ mùa hè
- [ ] 2. Luật thuần (CC-14, CC-15, CC-16, CC-17, CC-20)
  - [ ] 2.1 `record.ts` `recordLevel`; test sao chỉ tăng, ngày học, đếm theo máy, kết quả từng từ, cắt dữ liệu cũ
  - [ ] 2.2 `streak.ts` `computeStreak`; test bảng: liên tiếp, trống 1/2/3 ngày với 0/1/2 vé, nhận vé ngày 7/14, tối đa 2,
        hôm nay chưa chơi, kỷ lục
  - [ ] 2.3 `merge.ts` `mergeProgress`; test từng trường (design §5.2) và giao hoán / kết hợp / chạy lại không đổi
  - [ ] 2.4 `migrate.ts` `migrateProgress` + `emptyProgress`; test gói hỏng, thiếu trường, `schema` mới hơn
- [ ] 3. Bản đồ vùng / màn (CC-8, CC-9)
  - [ ] 3.1 `map.ts` `validateMap`; test từng lỗi (mã trùng, sai tiền tố, từ không có, số màn, `boss` sai chỗ, trò lạ)
  - [ ] 3.2 `data/map-{en,ja,it}.json` (2 vùng × 6 màn mỗi đảo), nạp như `decks.ts`; `content.test.ts` chạy `validateMap`;
        thêm vào hook pre-commit kiểm nội dung
  - [ ] 3.3 `data/released-level-ids.json` + test mã đã phát hành không mất
- [ ] 4. Luật mở và nhiệm vụ (CC-10, CC-11, CC-12, CC-13)
  - [ ] 4.1 `unlock.ts` `levelStates`, `nextLevelId`; test màn đầu, mở lần lượt, mở vùng, chèn màn, đổi nhóm tuổi
  - [ ] 4.2 `mission.ts` `makeMission`; test tất định, ưu tiên đảo gần nhất, thiếu màn, hồ sơ mới, Mầm 5 từ ôn tập
- [ ] 5. Lưu trên máy (CC-2, CC-4, CC-5)
  - [ ] 5.1 `apps/game/src/progress/kvStore.ts` (`localStorage`), `clock.ts`; test bằng kho giả
  - [ ] 5.2 `repo.ts`: `DeviceStateV1`, đọc / ghi gói, khoá `.corrupt`, `'newer'` chỉ đọc, `QuotaExceededError`, sự kiện
        `storage` gộp hai tab, `persist()` một lần; test từng nhánh
  - [ ] 5.3 `store.ts` + sửa `settings.ts` để `settings` là cài đặt của hồ sơ đang chơi (giữ tên xuất cho các màn đang
        dùng), chuyển `tomo.settings.v1` vào hồ sơ đầu; sửa `settings.test.ts`; test chuyển đổi
- [ ] 6. Hồ sơ (CC-2, CC-3, CC-19)
  - [ ] 6.1 `ProfilePickerView.vue`, `ProfileFormView.vue`, luồng trong `App.vue`; test giao diện (tạo, chọn, đổi, đủ 4)
  - [ ] 6.2 `ParentGate.vue` + xoá hồ sơ trong Cài đặt; test sai / đúng phép tính, xác nhận hai lần
- [ ] 7. Cảnh mở đầu (CC-7) — bỏ việc này nếu CC-7 chọn không
  - [ ] 7.1 `IntroView.vue`, "Bỏ qua", ghi `introSeen`, xem lại trong Cài đặt; test thứ tự đọc (`invocationCallOrder`)
- [ ] 8. Bản đồ đảo (CC-9, CC-10, CC-11)
  - [ ] 8.1 `IslandView.vue` thành bản đồ vùng / màn; chạm màn khoá thì Tomo nhắc; vùng xong có màu; `aria-label`; test
  - [ ] 8.2 `HomeView.vue`: tổng sao mỗi đảo, chip hồ sơ; test
- [ ] 9. Nối trò chơi với tiến độ (CC-16)
  - [ ] 9.1 `MatchView` / `RainView` nhận `level`, phát `finished: [LevelResult]` trước bảng kết quả; sửa `games.test.ts`
  - [ ] 9.2 `ResultPanel` có "Màn tiếp"; `App.vue` gọi `recordLevel`, mở màn tiếp, "Về đảo" cuộn tới màn vừa chơi; test
  - [ ] 9.3 Báo hợp đồng `LevelResult` cho spec `mvp-games` (ghi đường dẫn design §6 vào spec đó khi có)
- [ ] 10. Nhiệm vụ hôm nay (CC-13): `MissionCard.vue`, trận ôn tập Mưa Chữ với mã `review-<ngày>`, lời khen khi xong; test
- [ ] 11. Chuỗi ngày (CC-17): `StreakBadge.vue`, báo vé đã giữ chuỗi / chuỗi về 0 một lần mỗi lần mở; test với đồng hồ giả
- [ ] 12. Thời gian chơi và nhắc giữ tiến độ (CC-6, CC-18) — bỏ phần nào chủ sản phẩm chọn không
  - [ ] 12.1 `playTime.ts` + `playLimit`; nhắc nghỉ Chồi, cổng phụ huynh Mầm; test với hẹn giờ giả và `visibilitychange`
  - [ ] 12.2 Nhắc "Thêm vào màn hình chính" một lần trên Safari chưa cài; test nhận diện Safari / standalone
- [ ] 13. Câu đọc: thêm vào `phrases.ts`, `collectSpeech` gom tên vùng; test `content.test.ts`; `pnpm speech-list` chạy được
- [ ] 14. E2E (khổ máy tính + điện thoại)
  - [ ] 14.1 `apps/game/e2e/progress.spec.ts`: tạo hồ sơ → màn 1 → sao → màn 2 mở → tải lại còn sao; hai hồ sơ tách biệt;
        nhiệm vụ; chuỗi + vé với `page.clock`; ảnh chụp `shot()` các màn mới
  - [ ] 14.2 `offline.spec.ts` mở rộng: tắt mạng → tạo hồ sơ, chơi màn, tải lại vẫn còn sao và chuỗi
- [ ] **(làm trước E2E)** Kho Đèn Pin trong `ProgressDocV1` (khởi đầu 3, tặng Mầm 1/ngày học, cộng từ quảng cáo có thưởng, trừ khi dùng; gộp khi đồng bộ) và lớp `Db` SQLite (`sql.js` + IndexedDB trên web, `@capacitor-community/sqlite` trên Android, `migrate()`, chép dữ liệu `localStorage` cũ lần đầu, `.wasm` trong precache) theo mẫu medicine-management `frontend/src/offline/db/`; test với sql.js trong bộ nhớ
- [ ] 15. Tài liệu (cùng commit): `docs/feature-checklist.md` (hồ sơ, sao lưu, chuỗi, nhiệm vụ, bản đồ), `docs/ai/00-overview.md`
      (luồng màn mới, mục 7 cài đặt theo hồ sơ, khoá lưu), `docs/ai/40-conventions.md` (file mẫu cho luật tiến độ),
      `docs/content-authoring.md` (cách viết `map-<môn>.json`, quy tắc không đổi mã màn), `docs/game-design.md` mục 12
- [ ] 16. DoD: lint, format, typecheck, test, `coverage:changed`, build, E2E đều sạch không cảnh báo; skill `dod-report`, báo
      cáo `docs/dod/mvp-progress_<ngày>.md`; mở PR vào `main`
