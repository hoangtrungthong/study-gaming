# Kế hoạch triển khai — Quảng cáo theo nhóm tuổi (mvp-quang-cao)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-cho-chot.md`).

Nhánh `feat/mvp-quang-cao` từ `main` mới nhất. Thứ tự theo phụ thuộc: bộ luật thuần → cấu hình từ xa → công tắc build +
provider `noop` → `AdService` → giao diện → provider thật → E2E → tài liệu, DoD.

**Hỏi hết "Chờ chốt" trước khi code phần phụ thuộc** (`requirements.md`). Việc 1–3 chỉ cần quyết định đã thống nhất và có thể
làm trước; giá trị phụ thuộc CC để thành hằng có tên, đổi một chỗ khi chốt.

Phụ thuộc spec khác: `mvp-mua-ban` (store quyền "đã bỏ quảng cáo"), `mvp-tien-do-hoc` (bản đồ đảo, màn trùm, màn nhận đồ, hàm
cộng Đèn Pin / đồ trang trí, có thể màn hỏi tuổi), `mvp-android` (dự án Capacitor). Chưa có thì dùng giao diện giả trong test và
làm phần đó sau khi spec kia hợp nhất.

- [ ] 1. Bộ luật vị trí (`apps/game/src/ads/rules.ts`, `types.ts`)
  - [ ] 1.1 Kiểu `Placement`, `AdScreen`, `RewardKind`, `AdContext`, `AdCounters`, `AdDecision`, `AdTreatment` (design §Bộ luật)
  - [ ] 1.2 `decide()` theo thứ tự kiểm và bảng vị trí × nhóm × màn × nền tảng; `treatmentFor()` (CC-8); `canGrantWithoutAd()` (CC-15)
  - [ ] 1.3 Hàm bộ đếm thuần: `recordResult`, `recordInterstitial`, `recordReward`, `rollDay`; giới hạn tần suất (CC-4)
  - [ ] 1.4 Test `rules.test.ts`: mọi `reason`, Mầm / chưa trả lời tuổi luôn từ chối, Chồi chỉ `rewarded`, Cây 1/3 màn, offline,
        đang chơi / gõ / nghe, có quyền đã mua, revive mỗi trận, trần ngày, đổi ngày; **100% dòng và nhánh**
- [ ] 2. Cấu hình từ xa (`ads/remoteConfig.ts`) — cần CC-2, CC-3, CC-4e
  - [ ] 2.1 `parseConfig` viết tay + kẹp giá trị; lưu / đọc `tomo.ads.config.v1`
  - [ ] 2.2 `refresh()`: `fetch` `no-store`, hết giờ 5 giây, bỏ qua khi offline / đang chơi, chu kỳ khi quay lại từ nền
  - [ ] 2.3 `vite.config.ts`: `runtimeCaching` `NetworkOnly` cho file cấu hình cùng nguồn; kiểm file không nằm trong precache
  - [ ] 2.4 Test `remoteConfig.test.ts`: hợp lệ, sai lược đồ, JSON hỏng, lỗi mạng, hết giờ, giữ bản cũ, chưa từng có → `null`,
        kẹp, đồng hồ giả cho chu kỳ; 100% dòng
- [ ] 3. Tầng 1: công tắc build và provider `noop` — cần CC-13, CC-17
  - [ ] 3.1 `define` `__ADS_ENABLED__`, `__ADS_FAKE__` trong `vite.config.ts`, khai báo trong `env.d.ts`; `.env.example`
        (`ADS_ENABLED`, `VITE_ADS_CONFIG_URL`, mã thử CC-12)
  - [ ] 3.2 `providers/index.ts` (`loadProvider` với `import()` sau nhánh hằng), `providers/noop.ts`; test
  - [ ] 3.3 `scripts/check-no-ads.mjs` (+ lệnh `ads:check` nếu CC-17 được đồng ý) và bước CI; test: build mặc định qua, chèn
        chuỗi giả thì báo lỗi
- [ ] 4. `AdService` và cộng thưởng (`ads/adService.ts`, `ads/rewards.ts`)
  - [ ] 4.1 Gom ngữ cảnh: `settings.ageGroup` + cờ đã trả lời tuổi (CC-7), `adActivity`, `online/offline`, store quyền của
        `mvp-mua-ban`, cấu hình, bộ đếm `tomo.ads.counters.v1`
  - [ ] 4.2 Cờ `speaking` trong `Speaker` (`audio/speaker.ts`); test bật / tắt khi `say`, `stop`, lỗi
  - [ ] 4.3 `showRewarded`, `claimFree`, `onResultShown`, `maybeInterstitial`, `mountBanner`; dừng giọng đọc + `ads:pause` /
        `ads:resume`, trả focus; một lượt đang chạy; `grantId` chống cộng trùng; trần ngày
  - [ ] 4.4 `rewards.grant` gọi hàm cộng của `mvp-tien-do-hoc` (Đèn Pin +3, đồ trang trí ×2) và `RainGame.revive`
  - [ ] 4.5 Test `adService.test.ts` với provider giả: thưởng chỉ khi xem đủ, đóng sớm / lỗi / không có quảng cáo không cộng,
        sự kiện trùng cộng 1 lần, bấm hai lần, offline, người đã mua; 100% dòng
- [ ] 5. Giao diện — cần CC-5, CC-15, CC-16
  - [ ] 5.1 `RainGame.revive()` (+1 chậu, tiếp tục, chỉ sau kết thúc vì `lives`, 1 lần mỗi trận); test `RainGame.test.ts`
  - [ ] 5.2 `RewardOffer.vue` (Xem quảng cáo / Nhận ngay / Thôi, đọc thành tiếng, câu mới trong `phrases.ts`, nút ≥ 48px); test
        `components.test.ts`; `pnpm speech-list` cập nhật danh sách câu đọc
  - [ ] 5.3 `RainView.vue`: lời mời hồi chậu khi hết chậu, không khi hết giờ; đặt `adActivity`; test `games.test.ts`
  - [ ] 5.4 `ResultPanel.vue`: `onResultShown`, `maybeInterstitial` khi bấm "Chơi lại" / "Về đảo", slot khối web; `App.vue`:
        `init()`, `adActivity.screen`; test
  - [ ] 5.5 `AdBanner.vue` (chừa chiều cao theo `SizeChanged`, gỡ khi rời) và gắn vào bản đồ đảo, màn trùm, màn nhận đồ của
        `mvp-tien-do-hoc`; test
  - [ ] 5.6 Màn hỏi tuổi trung lập và khoá phụ huynh khi lên Cây (CC-7), nếu `mvp-tien-do-hoc` chưa làm; test + ảnh chụp 2 khổ
- [ ] 6. Provider web `adsense` — cần CC-10, CC-12
  - [ ] 6.1 Chèn script 1 lần khi lần đầu được phép, `ins` đáp ứng, `data-adtest="on"` khi dev, không Auto ads; khối trong trang ở
        tổng kết
  - [ ] 6.2 Test: không chèn khi offline / bị từ chối, chèn đúng 1 lần, thẻ đúng thuộc tính
- [ ] 7. Provider app `admob` — cần CC-1, CC-5, CC-8, CC-9, CC-11, CC-12, và `mvp-android` đã có dự án Capacitor
  - [ ] 7.1 Cài plugin (hỏi trước khi thêm thư viện, AGENTS.md mục 6); `capacitor.config.ts` `includePlugins` loại plugin khi tắt;
        `APPLICATION_ID` qua placeholder Gradle
  - [ ] 7.2 `providers/admob.ts`: `initialize` với cờ trẻ em / mức nội dung, `npa`, rewarded / interstitial / banner, UMP cho Cây,
        nút tuỳ chọn quyền riêng tư trong Cài đặt
  - [ ] 7.3 Test với mock plugin (cờ theo nhóm, đổi nhóm áp lại, `npa` cho Chồi, mã thử khi dev, UMP từ chối → không quảng cáo);
        build Android tắt quảng cáo không chứa SDK AdMob, bật thì app mở không thoát
  - [ ] 7.4 Thử trên máy Android thật với mã thử: Chồi có thưởng, Cây đủ 3 vị trí, Mầm không có, máy bay không có; ghi kết quả
- [ ] Phần thưởng +3 Đèn Pin cộng vào kho của `mvp-tien-do-hoc` (dùng ở mọi màn, không chỉ màn trùm); test
- [ ] 8. E2E Playwright (khổ máy tính + điện thoại)
  - [ ] 8.1 `e2e/ads-off.spec.ts` trên bản mặc định (`noop`): mọi màn, 3 nhóm, không phần tử quảng cáo, không request quảng cáo /
        cấu hình
  - [ ] 8.2 `playwright.config.ts`: `webServer` thứ hai cổng 4174 build `ADS_ENABLED=true ADS_PROVIDER=fake`, project riêng
  - [ ] 8.3 `e2e/ads.spec.ts`: Mầm không có; offline không có; đang chơi / gõ / nghe không có; Chồi chỉ lời mời thưởng, xem xong
        hồi chậu và chơi tiếp, đóng sớm không hồi; Cây toàn màn hình đúng 1/3 màn, banner bản đồ; quyền đã mua → không quảng cáo,
        "Nhận ngay"; cấu hình tắt / chưa từng đọc được → không có; ảnh chụp `shot()`
- [ ] 9. Tài liệu và DoD
  - [ ] 9.1 `docs/quang-cao.md` (mới): biến build, mã thử, cách sửa / đưa `ads-config.json`, tắt khẩn cấp, thử trên máy Android,
        khai báo Play Console (CC-6), danh sách kiểm Families Policy; thêm vào `docs/README.md`
  - [ ] 9.2 `docs/ai/00-overview.md` (thư mục `ads/`, luồng), `docs/ai/40-conventions.md` (gọi quảng cáo chỉ qua `AdService`),
        `docs/feature-checklist.md`; kịch bản mục 12.1 nhận các CC đã chốt
  - [ ] 9.3 Cổng: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm -r test:coverage` + `pnpm coverage:changed`
        (100% dòng file bị đổi), `pnpm build`, `pnpm e2e`, kiểm bản tắt quảng cáo; không cảnh báo
  - [ ] 9.4 DoD bằng skill `dod-report`, báo cáo ở `docs/dod/`
