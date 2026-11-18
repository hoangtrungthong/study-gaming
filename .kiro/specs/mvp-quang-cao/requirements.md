# Tài liệu yêu cầu — Quảng cáo theo nhóm tuổi (mvp-quang-cao)

> Viết ngày 2026-11-18, trước khi code. Phần của giai đoạn 1 (MVP) trong `docs/kich-ban-game.md` mục 11:
> "quảng cáo (hai tầng công tắc, theo nhóm tuổi)".

## Giới thiệu

Đưa quảng cáo vào game theo đúng mục 10.5 của kịch bản: hai tầng công tắc (biến môi trường lúc build + file cấu hình từ
xa), vị trí theo nhóm tuổi, quảng cáo có thưởng đổi phần thưởng, thiết lập cho người dùng trẻ em. Một lớp `AdService` chung
cho app (AdMob qua plugin Capacitor) và web (AdSense / Ad Manager); tắt ở lúc build thì không có thư viện quảng cáo nào trong
bản build.

Spec này **dùng lại, không định nghĩa lại**:

- `mvp-mua-ban`: quyền "đã bỏ quảng cáo" (gắn tài khoản, lưu trên máy, đọc được khi offline). Spec này chỉ đọc quyền đó.
- `mvp-tien-do-hoc`: Đèn Pin gợi ý, đồ trang trí cuối vùng, bản đồ đảo, cách cộng phần thưởng vào tiến độ. Spec này chỉ gọi
  hàm cộng thưởng của spec đó.
- `mvp-android`: dự án Capacitor, bản Android, phiên bản Capacitor, khoá ký. Spec này chỉ thêm plugin quảng cáo và cấu hình
  của nó vào dự án đó.

### Hiện trạng đã rà trong code

- Chưa có gì liên quan tới quảng cáo: không có thư viện, không có biến môi trường (`apps/game/package.json:14-21`,
  `apps/game/src/env.d.ts:1-7` chỉ khai báo `vite/client`).
- Chưa có Capacitor (`apps/game/package.json`, không có `capacitor.config.*`); thuộc `mvp-android`.
- Màn hình điều hướng bằng biến `screen` trong `apps/game/src/App.vue:12-13` (`home | island | match | rain | settings`),
  không có router. Chưa có bản đồ đảo, màn trùm, góc phụ huynh (thuộc `mvp-tien-do-hoc` và giai đoạn sau).
- Màn tổng kết là `apps/game/src/components/ResultPanel.vue:12-24` (sao, lời nhắn, nút "Chơi lại" / "Về đảo"); Mưa Chữ đọc lại
  các từ bị lỡ ngay khi hiện tổng kết (`apps/game/src/games/rain/RainView.vue:131-138`), tức người chơi đang **nghe giải thích**
  khi màn tổng kết vừa hiện.
- Mưa Chữ kết thúc khi hết chậu hoa (`apps/game/src/games/rain/RainGame.ts:62-68`, `finish(events, 'lives')` ở `:101`);
  chưa có cách hồi chậu hoa.
- Nhóm tuổi lưu ở `apps/game/src/settings.ts:3-22`, mặc định `'choi'` khi chưa chọn (`:21`), đổi ở
  `apps/game/src/views/SettingsView.vue:21`. Chưa có màn hỏi tuổi lúc đầu.
- `Speaker` (`apps/game/src/audio/speaker.ts:51`) chưa có cờ công khai "đang đọc".
- PWA precache mọi file `json` trong bản build (`apps/game/vite.config.ts:26`): file cấu hình quảng cáo nếu đặt trong
  `public/` sẽ bị precache và không bao giờ đọc lại từ mạng.
- E2E chạy trên bản build thật có service worker (`apps/game/playwright.config.ts:19-25`), hai khổ máy tính + điện thoại.

### Quyết định đã thống nhất (ràng buộc đầu vào)

Chỉ gồm các điểm ở `docs/kich-ban-game.md` mục 12.1 (Q-11, Q-12, Q-16, Q-22) và phần thân mục 10.5 đã ghi là đã chốt.

1. **Hai tầng công tắc (Q-11).** Tầng 1: biến môi trường lúc build `ADS_ENABLED`; `false` thì **không đưa thư viện quảng cáo
   vào bản build**, giao diện không chừa chỗ trống. Tầng 2: **một file JSON tĩnh** trên máy chủ/CDN, chỉ có tác dụng khi tầng 1
   bật; tắt toàn bộ, tắt từng vị trí, chỉnh tần suất. Không cần máy chủ riêng, file đặt cùng chỗ với bản web là đủ.
2. **Không đọc được file thì giữ cấu hình lần trước; chưa từng đọc được thì không hiện quảng cáo.**
3. **Vị trí theo nhóm (Q-12):**

   | Nhóm | Quảng cáo |
   |---|---|
   | Mầm (5–8) | Không quảng cáo |
   | Chồi (9–14) | Chỉ quảng cáo có thưởng, người chơi tự bấm xem; chỉ nguồn được chứng nhận phù hợp trẻ em, không cá nhân hoá |
   | Cây (15+) | Có thưởng + toàn màn hình ở màn tổng kết, **tối đa 1 lần mỗi 3 màn** + banner nhỏ ở bản đồ đảo |
   | Góc phụ huynh | Không quảng cáo |

4. **Phần thưởng của quảng cáo có thưởng** (không bao giờ bắt buộc để qua màn): +3 Đèn Pin ở màn trùm; hồi 1 chậu hoa trong
   Mưa Chữ (**mỗi trận 1 lần**); nhân đôi đồ trang trí nhận được ở cuối vùng.
5. **Không bao giờ hiện quảng cáo** khi đang chơi một màn, đang gõ từ, đang nghe giải thích, đang mất mạng.
6. **Nền tảng:** app dùng AdMob qua plugin Capacitor, khai báo đúng thiết lập cho người dùng trẻ em. Web dùng Google AdSense
   hoặc Ad Manager, **chỉ ở bản đồ và màn tổng kết**; quảng cáo có thưởng trên web làm sau nếu cần (MVP không có).
7. **Gói bỏ quảng cáo (Q-16, Q-22):** có quyền "đã bỏ quảng cáo" thì không hiện quảng cáo nào, kể cả khi offline, và **vẫn
   nhận phần thưởng của quảng cáo có thưởng mà không phải xem**. Quyền đến từ `mvp-mua-ban`.
8. Nguyên tắc chung (`AGENTS.md` mục 2): chơi được khi không có mạng; nhóm Mầm không quảng cáo; không gửi dữ liệu cá nhân của
   trẻ ra ngoài khi chưa cần.

### Điểm chốt thêm (2026-11-18)

Chủ sản phẩm **đồng ý toàn bộ đề xuất** ngày 2026-11-18: mỗi điểm dưới đây chốt theo phần **Đề xuất** của nó (phần tra cứu
và lý do giữ lại để biết vì sao). Điểm nào gắn nhãn **Còn mở** thì chưa chốt — xem `.kiro/specs/mvp-cho-chot.md`.

- **Chốt thêm 2026-11-18 — Đèn Pin là "gợi ý" dùng ở mọi màn MVP** (`mvp-cho-chot.md` mục 6.1): mỗi lần dùng một gợi ý riêng của trò (W1 hiện 1 chữ cái tiếp theo; G3 đặt đúng 1 khối; G4 loại 1 đáp án sai; G5 lật sáng 1 cặp trong 1 giây; Ghép Đôi loé sáng nghĩa đúng của từ đang chọn; G2 / Mưa Chữ làm chậm rơi 5 giây; J1 hiện lại nét mẫu; I1 tô sáng khối lệnh tiếp theo). Đã dùng gợi ý thì vẫn qua màn nhưng **không được 3 sao**. Bắt đầu 3 Đèn Pin; quảng cáo có thưởng +3 (tối đa 3 lần/ngày); nhóm Mầm được tặng 1 Đèn Pin mỗi ngày học. Màn trùm (giai đoạn 2) dùng chung kho này.

- **CC-1 Plugin AdMob cho Capacitor.** Dùng plugin nào?
  - Tra cứu: [`@capacitor-community/admob`](https://github.com/capacitor-community/admob) (MIT) bản 8.2.0 chạy với Capacitor
    8.5+ (iOS 15+, Android API 24+); có banner, toàn màn hình, có thưởng, UMP (`requestConsentInfo`, `showConsentForm`,
    `showPrivacyOptionsForm`), tuỳ chọn khởi tạo `tagForChildDirectedTreatment`, `tagForUnderAgeOfConsent`,
    `maxAdContentRating`, `initializeForTesting`, và `npa` (không cá nhân hoá) cho từng quảng cáo. Lưu ý: SDK gốc của Google
    đã đánh dấu TFCD/TFUA là cũ, thay bằng `setAgeRestrictedTreatment(CHILD|TEEN)`
    ([AdMob targeting](https://developers.google.com/admob/android/targeting)); khi đặt cả hai thì Google áp mức chặt nhất,
    nên TFCD vẫn có tác dụng. Lựa chọn khác: AdMob Plus (`admob-plus`), hoặc tự viết plugin.
  - **Đề xuất:** `@capacitor-community/admob`, bản khớp phiên bản Capacitor mà `mvp-android` chọn. Lý do: plugin cộng đồng
    chính thức của Capacitor, đủ các dạng cần, có UMP và cờ trẻ em; SDK AdMob (`play-services-ads` 19.0.0+) nằm trong danh sách
    SDK tự chứng nhận Families. Theo dõi khi plugin hỗ trợ `setAgeRestrictedTreatment`.

- **CC-2 Nơi đặt file cấu hình từ xa.** **Cập nhật 2026-11-18 — Q-29 đã chốt:** máy chủ là một máy ảo **Ubuntu trên cloud**, chạy bằng **Docker** (Docker Compose), chạy liên tục — không có chuyện máy chủ ngủ. Chi tiết: `docs/deploy.md`, spec `mvp-tai-khoan`.
  - Tra cứu: file trong `public/` bị precache (`vite.config.ts:26`); app Capacitor chạy ở gốc `https://localhost` nên phải đọc
    bằng địa chỉ tuyệt đối.
  - **Đề xuất:** một file `ads-config.json` cùng tên miền với bản web (Cloudflare Pages theo đề xuất Q-29), **không** nằm trong
    `public/` của bản build (đưa lên riêng để sửa mà không build lại), địa chỉ đặt bằng biến build `VITE_ADS_CONFIG_URL`.
    Lý do: đúng "đặt cùng chỗ với bản web", sửa file là có hiệu lực, không cần máy chủ.

- **CC-3 Khi nào đọc lại file cấu hình.**
  - **Đề xuất:** đọc khi mở app và khi app quay lại từ nền nếu lần đọc trước đã quá **6 giờ**; không đọc trong lúc chơi màn.
    Lý do: "tắt được trong vài phút" chỉ cần lần mở app kế tiếp; đọc thưa thì không tốn pin, mạng.

- **CC-4 Giới hạn tần suất ngoài các mức đã chốt.** Đã chốt: toàn màn hình tối đa 1 lần mỗi 3 màn (Cây); hồi chậu hoa 1 lần
  mỗi trận. Chưa chốt:
  - (a) "màn" để đếm 1/3 là gì. **Đề xuất:** mỗi lần hiện màn tổng kết của một trò (Ghép Đôi, Mưa Chữ, màn trùm), kể cả chơi
    lại; bộ đếm lưu trên máy, không về 0 khi tắt app (để tắt mở app không lách được).
  - (b) Khoảng cách tối thiểu giữa hai lần toàn màn hình. **Đề xuất:** thêm tối thiểu 3 phút. Lý do: người chơi giỏi xong 3 màn
    Ghép Đôi trong khoảng 1 phút.
  - (c) Không hiện toàn màn hình ở lần tổng kết đầu tiên sau khi mở app. **Đề xuất:** có. Lý do: chính sách Families cấm quảng
    cáo toàn màn hình ngay khi mở app; tránh cảm giác "vừa vào đã bị quảng cáo".
  - (d) **Còn mở phần Đèn Pin** (MVP không có màn trùm theo `mvp-tro-choi` CC-2, xem `mvp-cho-chot.md` 2.3). Trần số lần xem có thưởng mỗi ngày. **Đề xuất:** +3 Đèn Pin tối đa 3 lần/ngày; nhân đôi đồ trang trí 1 lần mỗi lần
    nhận ở cuối vùng; tổng tối đa 10 quảng cáo có thưởng/ngày. Lý do: chặn lạm dụng (thưởng tính ở máy), giữ giá trị phần thưởng.
  - (e) File cấu hình từ xa có được nới lỏng hơn các mức trên không. **Đề xuất:** chỉ được **chặt hơn** (ví dụ 1/4 màn), không
    được nới dưới mức đã chốt 1/3; code kẹp giá trị.

- **CC-5 Banner ở bản đồ đảo: cỡ và vị trí.**
  - **Đề xuất:** app dùng banner thích ứng neo (anchored adaptive) ở **đáy** màn bản đồ đảo, chỉ hiện khi đứng yên ở bản đồ, gỡ
    khi rời; web dùng một khối AdSense cỡ đáp ứng ở cuối bản đồ. Có khoảng đệm với nút chạm gần nhất ≥ 16px. Lý do: chính sách
    cấm bố cục gây bấm nhầm; banner đáy không che nội dung chơi.

- **CC-6** — **Đã chốt 2026-11-18: khai báo mọi nhóm tuổi, gồm cả "5 tuổi trở xuống"** (như `mvp-android` CC-18; đề xuất "từ 6–8 trở lên" bên dưới **không** dùng). **Khai báo đối tượng trên Google Play ("Target audience and content") và chương trình Families.**
  - Tra cứu: chọn bất kỳ nhóm tuổi dưới 13 thì phải theo
    [Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335): chỉ dùng SDK quảng cáo tự chứng
    nhận Families, không quảng cáo cá nhân hoá cho trẻ, nội dung phù hợp, không gây bấm nhầm, không toàn màn hình khi mở app,
    quảng cáo đóng được sau 5 giây, không nhiều vị trí trên một trang. App cho cả trẻ em lẫn người lớn (mixed audience) **phải
    có màn hỏi tuổi trung lập** để quảng cáo không hợp trẻ chỉ đến người lớn
    ([Target audience](https://support.google.com/googleplay/android-developer/answer/9867159)). App trong chương trình gia
    đình được AdMob tự coi mọi yêu cầu là cho trẻ em
    ([AdMob targeting](https://developers.google.com/admob/android/targeting)); khi đó nhóm Cây cũng chỉ nhận quảng cáo cho trẻ
    (doanh thu thấp hơn). "Teacher Approved" do giáo viên Google chọn, không nộp đơn; chỉ xét app có nhắm trẻ em.
  - **Đề xuất:** khai báo **mọi nhóm từ 6–8 trở lên** (mixed audience), có màn hỏi tuổi trung lập (CC-7), không xin nhãn riêng
    "chỉ cho trẻ em". Lý do: đúng đối tượng thật (5 tuổi tới người đi làm); giữ được quảng cáo thường cho nhóm Cây; vẫn theo
    đủ Families Policy cho Mầm/Chồi.

- **CC-7 Màn hỏi tuổi trung lập (age gate) và cách gán nhóm.**
  - Tra cứu: hiện app không hỏi tuổi, mặc định `'choi'` (`settings.ts:21`). Chính sách yêu cầu hỏi tuổi "không khuyến khích khai
    gian": nhập tự do ngày/năm sinh là đạt; đặt sẵn tuổi hay cho biết "cần đủ X tuổi để mở" là sai.
  - **Đề xuất:** lần đầu mở (và khi tạo hồ sơ của `mvp-tien-do-hoc`) hỏi "Bạn sinh năm nào?" bằng ô chọn năm **không chọn sẵn**,
    không nhắc tới quảng cáo; tự gán Mầm (≤ 8), Chồi (9–14), Cây (≥ 15). Chưa trả lời thì coi như **Mầm về quảng cáo** (không
    quảng cáo). Đổi nhóm trong Cài đặt từ thấp lên Cây phải qua khoá phụ huynh (phép tính) như Góc phụ huynh. Lời màn hỏi tuổi:
    "Tomo muốn biết bạn bao nhiêu tuổi để chọn trò cho vừa sức." (đọc thành tiếng).

- **CC-8 Mức nội dung quảng cáo tối đa và cách đối xử theo nhóm.**
  - **Đề xuất:** Chồi: `tagForChildDirectedTreatment = true`, `maxAdContentRating = G`, `npa = true`, không hỏi đồng ý (UMP) vì
    yêu cầu đã là cho trẻ em. Cây: không gắn cờ trẻ em, `maxAdContentRating = T` (Cây gồm cả 15–17 tuổi). Web: Chồi không có
    quảng cáo ở MVP (web chưa có quảng cáo có thưởng); Cây không gắn `data-tag-for-age-treatment`. Lý do: Chồi 13–14 tuổi
    không phải "trẻ em" theo COPPA (< 13) nhưng xử lý chặt nhất cho cả nhóm thì đơn giản và an toàn.

- **CC-9 Hỏi đồng ý quảng cáo (UMP / GDPR) và Nghị định 13/2023.**
  - Tra cứu: UMP chỉ hiện form ở vùng cần (EEA, Anh, Thuỵ Sĩ); `canRequestAds()` trả `false` tới khi gọi
    `requestConsentInfoUpdate()` ([AdMob privacy](https://developers.google.com/admob/android/privacy)). Q-5 (đồng ý của phụ
    huynh, Nghị định 13/2023) còn chờ ở kịch bản.
  - **Đề xuất:** chỉ chạy UMP cho nhóm Cây trên app, theo kết quả `canRequestAds()`; có nút "Tuỳ chọn quyền riêng tư quảng cáo"
    trong Cài đặt khi UMP báo cần. Web: dùng thông báo đồng ý có sẵn của AdSense (Privacy & messaging). Câu Q-5 trả lời riêng ở
    kịch bản, không chặn spec này vì Chồi chỉ nhận quảng cáo không cá nhân hoá.

- **CC-10 Mạng quảng cáo trên web: AdSense hay Ad Manager; toàn màn hình ở màn tổng kết trên web.**
  - Tra cứu: AdSense thường không cho gọi quảng cáo toàn màn hình theo ý mình; quảng cáo toàn màn hình / có thưởng cho game web
    là [H5 Games Ads (Ad Placement API)](https://developers.google.com/ad-placement/apis), đang **beta kín**, phải xin. AdSense có
    thẻ trẻ em theo từng yêu cầu `data-tag-for-age-treatment="1"`
    ([AdSense child-directed](https://support.google.com/adsense/answer/3248194)). Ad Manager cần tài khoản riêng, hợp nơi có
    nhiều nguồn quảng cáo.
  - **Đề xuất:** **AdSense** khối hiển thị thường: ở màn tổng kết là một khối nằm trong trang (không toàn màn hình), cùng luật 1
    lần mỗi 3 màn; ở bản đồ là khối ở cuối. Xin H5 Games Ads sau khi có lượng người chơi. Lý do: AdSense không cần duyệt beta,
    đủ cho MVP; Ad Manager chưa cần.

- **CC-11 Quảng cáo AdSense trong app Capacitor (WebView).**
  - Tra cứu: AdSense trong WebView chỉ được khi dùng "WebView API for Ads" hoặc cách được liệt kê
    ([AdSense program policies](https://support.google.com/publisherpolicies/answer/48182)).
  - **Đề xuất:** **không** dùng AdSense trong app; app chỉ dùng AdMob. Lý do: tránh vi phạm, một nguồn trong app dễ kiểm.

- **CC-12 Mã đơn vị quảng cáo (ad unit ID) đặt ở đâu.**
  - **Đề xuất:** biến build (`VITE_ADMOB_APP_ID`, `VITE_ADMOB_UNIT_*`, `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT_*`); bản dev và
    E2E dùng mã thử của Google. File cấu hình từ xa chỉ bật/tắt và tần suất, không chứa mã. Lý do: mã thật sai một lần có thể làm
    khoá tài khoản; đổi mã hiếm khi cần, build lại được.

- **CC-13 Giá trị mặc định khi không đặt `ADS_ENABLED`.**
  - **Đề xuất:** coi như `false` (không quảng cáo); bản phát hành phải đặt `ADS_ENABLED=true` rõ ràng. Lý do: quên đặt thì an toàn
    (không quảng cáo) hơn là vô tình bật.

- **CC-14 Xác minh phần thưởng ở máy chủ (SSV).**
  - Tra cứu: plugin hỗ trợ xác minh ở máy chủ cho quảng cáo có thưởng (CC-1).
  - **Đề xuất:** **không** dùng ở MVP; thưởng cộng ở máy khi nhận sự kiện "đã xem xong" từ SDK, có trần mỗi ngày (CC-4d). Lý do:
    phần thưởng chỉ là gợi ý / đồ trang trí, không có giá trị tiền; game phải chạy offline; máy chủ MVP chỉ lo phần mua.

- **CC-15 Nhóm Mầm và người đã mua có thấy nút "nhận thưởng" không.**
  - Tra cứu: Mầm không có quảng cáo; người mua được nhận thưởng không cần xem (quyết định 7).
  - **Đề xuất:** Mầm **không** thấy các lời mời thưởng của quảng cáo (không quảng cáo, không thêm cách nhận). Người đã mua (Chồi,
    Cây) thấy cùng chỗ nút "Nhận ngay" thay cho "Xem quảng cáo", cùng trần mỗi ngày. Lý do: giữ Mầm đơn giản; người mua không
    thiệt, cũng không có lợi hơn người xem.

- **CC-16 Thời điểm hiện toàn màn hình ở màn tổng kết.**
  - Tra cứu: khi hiện tổng kết, Mưa Chữ đang đọc lại từ bị lỡ (`RainView.vue:136-137`); "không quảng cáo khi đang nghe giải
    thích" đã chốt.
  - **Đề xuất:** hiện khi người chơi bấm "Chơi lại" hoặc "Về đảo" ở màn tổng kết (lúc chuyển màn), không hiện ngay khi tổng kết
    vừa mở. Lý do: không cắt lời đọc; người chơi đã xem xong kết quả.

- **CC-17 Lệnh kiểm "bản tắt quảng cáo không chứa thư viện quảng cáo".**
  - Tra cứu: `AGENTS.md` mục 4 chỉ cho dùng lệnh đã khai báo; thêm lệnh phải hỏi.
  - **Đề xuất:** thêm `pnpm ads:check` (chạy `scripts/check-no-ads.mjs` trên `apps/game/dist`) và gọi trong CI sau `pnpm build`.
    Lý do: tầng 1 hứa "không đưa thư viện vào bản build", cần một kiểm tra tự động để không vô tình phá.

## Thuật ngữ

- **Tầng 1 / tầng 2:** công tắc lúc build (`ADS_ENABLED`) / file cấu hình từ xa.
- **Vị trí (placement):** `rewarded` (có thưởng), `interstitial` (toàn màn hình ở tổng kết), `banner` (bản đồ đảo).
- **Lời mời thưởng:** nút cho người chơi tự chọn xem quảng cáo có thưởng (`hint`, `revive`, `doubleDecor`).
- **Bộ luật vị trí:** hàm TS thuần quyết định có được hiện quảng cáo không, từ ngữ cảnh (nhóm tuổi, màn, hoạt động, mạng, quyền,
  cấu hình, bộ đếm).
- **Nhà cung cấp (provider):** `noop` (không làm gì), `admob` (app), `adsense` (web), `fake` (chỉ cho E2E).
- **Đối xử trẻ em:** cờ TFCD / age treatment `CHILD`, mức nội dung tối đa, `npa` (không cá nhân hoá).

## Yêu cầu

### Yêu cầu 1 — Công tắc lúc build (tầng 1)

**User story:** Là người phát hành, tôi muốn build một bản không có quảng cáo mà không chứa bất kỳ thư viện quảng cáo nào.

1. `ADS_ENABLED` khác `true` (kể cả không đặt, CC-13): `AdService` dùng nhà cung cấp `noop`; bản build không chứa mã plugin AdMob
   hay đoạn tải `adsbygoogle.js`; không có khoảng trống giao diện cho quảng cáo; không gọi mạng tới file cấu hình.
2. `ADS_ENABLED=true`: nhà cung cấp được chọn theo nền tảng (app → `admob`, web → `adsense`) và **tải động** khi cần lần đầu.
3. Bản Android build với `ADS_ENABLED` khác `true` không chứa SDK AdMob gốc và không khai báo `APPLICATION_ID` của AdMob
   (phối hợp `mvp-android`).
4. Có kiểm tra tự động: build tắt quảng cáo, tìm trong `dist/` không thấy chuỗi nhận diện thư viện quảng cáo.

### Yêu cầu 2 — Cấu hình từ xa (tầng 2)

**User story:** Là người vận hành, tôi muốn tắt nhanh quảng cáo hay một vị trí mà không phát hành bản mới.

1. File JSON theo lược đồ ở `design.md` (bật chung, bật từng vị trí, từng phần thưởng, tần suất).
2. Đọc theo CC-2 / CC-3; đọc được và hợp lệ thì lưu trên máy kèm thời điểm đọc.
3. Lỗi mạng, lỗi JSON, sai lược đồ: giữ bản đã lưu; chưa từng có bản hợp lệ: **không hiện quảng cáo**.
4. Giá trị tần suất bị kẹp: không nới dưới mức đã chốt (CC-4e).
5. Không bao giờ chặn việc chơi: đọc cấu hình chạy nền, lỗi không hiện cho người chơi.

### Yêu cầu 3 — Bộ luật vị trí

**User story:** Là người chơi, tôi chỉ thấy quảng cáo ở đúng chỗ, đúng nhóm tuổi, không bao giờ lúc đang học.

1. Hàm thuần `decide(placement, context)` trả `{ allowed, reason, treatment }`; mọi màn, mọi nhà cung cấp đều hỏi hàm này trước.
2. Từ chối khi: tầng 1 tắt; chưa có cấu hình hợp lệ hoặc cấu hình tắt chung / tắt vị trí; có quyền "đã bỏ quảng cáo"; nhóm Mầm
   (hoặc chưa trả lời tuổi, CC-7); đang ở Góc phụ huynh; đang chơi màn, đang gõ, đang nghe giải thích; mất mạng; vị trí không hợp
   nhóm (Chồi chỉ `rewarded`); vị trí không có trên nền tảng (web không có `rewarded` ở MVP); vượt tần suất.
3. Cây, `interstitial`: chỉ ở màn tổng kết, tối đa 1 lần mỗi 3 màn và các giới hạn của CC-4 khi đã chốt.
4. Cây, `banner`: chỉ ở bản đồ đảo.
5. `treatment` theo nhóm (CC-8): cờ trẻ em, mức nội dung, `npa`.
6. Độ phủ unit test 100% dòng và nhánh cho bộ luật.

### Yêu cầu 4 — Quảng cáo có thưởng và cộng thưởng

**User story:** Là người chơi Chồi/Cây, tôi muốn tự chọn xem quảng cáo để lấy thêm gợi ý, hồi chậu hoa hay nhân đôi đồ trang trí.

1. Lời mời thưởng chỉ hiện khi bộ luật cho phép (hoặc khi có quyền đã mua, CC-15); không bao giờ là bước bắt buộc để qua màn;
   có nút "Thôi" ngang hàng.
2. **Hồi chậu hoa:** khi Mưa Chữ kết thúc vì hết chậu hoa, mời hồi 1 chậu; xem xong thì trận chơi tiếp từ trạng thái cũ với 1 chậu;
   mỗi trận 1 lần. Hết giờ thì không mời.
3. **+3 Đèn Pin:** ở màn trùm, khi người chơi mở bảng gợi ý (lúc màn đang dừng); cộng qua hàm của `mvp-tien-do-hoc`.
4. **Nhân đôi đồ trang trí:** ở màn nhận đồ cuối vùng (`mvp-tien-do-hoc`); nhân đôi đúng món vừa nhận.
5. Chỉ cộng thưởng khi SDK báo **đã xem đủ** (sự kiện thưởng); đóng sớm, lỗi tải, không có quảng cáo thì không cộng, báo nhẹ
   "Chưa có quảng cáo, thử lại sau nhé" (đọc thành tiếng) và người chơi tiếp tục bình thường.
6. Chống lạm dụng: trần mỗi ngày (CC-4d), một lượt thưởng chỉ cộng một lần (khoá theo mã lượt), nút bị khoá trong lúc đang tải /
   đang xem.
7. Trước khi hiện quảng cáo: dừng giọng đọc, tạm dừng âm thanh game; đóng quảng cáo thì trả lại như cũ, focus về nút vừa bấm.

### Yêu cầu 5 — Toàn màn hình và banner (nhóm Cây)

1. Toàn màn hình hiện theo CC-16 khi bộ luật cho phép; không hiện ở lần tổng kết đầu sau khi mở app (CC-4c, khi chốt).
2. Banner ở bản đồ đảo theo CC-5; rời bản đồ thì gỡ banner; mất mạng thì không chừa chỗ trống.
3. Web: khối AdSense ở màn tổng kết và bản đồ (CC-10); script AdSense chỉ tải khi lần đầu được phép hiện, không tải khi
   offline, không được service worker lưu.

### Yêu cầu 6 — Thiết lập cho trẻ em và đồng ý

1. App: khởi tạo AdMob với cờ và mức nội dung theo nhóm (CC-8); đổi nhóm tuổi thì áp lại trước yêu cầu quảng cáo kế tiếp.
2. Quảng cáo cho Chồi luôn `npa = true`.
3. UMP theo CC-9; khi UMP chưa cho phép thì bộ luật trả `allowed = false` (lý do `consent`).
4. Không gửi dữ liệu cá nhân (email, tên, tài khoản) vào yêu cầu quảng cáo; không ghi log mã quảng cáo kèm định danh người chơi.

### Yêu cầu 7 — Offline và an toàn khi lỗi

1. Mất mạng: không yêu cầu, không hiện quảng cáo, không chừa chỗ trống, lời mời thưởng ẩn (người đã mua vẫn thấy "Nhận ngay").
2. Mọi lỗi của SDK / script quảng cáo bị bắt, ghi cảnh báo không có dữ liệu cá nhân, không làm hỏng màn chơi.
3. Bộ đếm tần suất và trần thưởng lưu trên máy, đọc được khi offline.

### Yêu cầu 8 — Kiểm thử

1. Unit: bộ luật 100%; đọc / kẹp / dự phòng cấu hình; bộ đếm; luồng thưởng (xem đủ, đóng sớm, lỗi, trùng sự kiện).
2. E2E với nhà cung cấp `noop` (bản build mặc định): không có phần tử quảng cáo ở mọi màn, mọi nhóm.
3. E2E với nhà cung cấp `fake` (bản build riêng cho test): Mầm không có quảng cáo; offline không có; đang chơi / đang gõ / đang
   nghe không có; Chồi chỉ có lời mời thưởng; Cây có toàn màn hình đúng 1/3 màn và banner ở bản đồ; có quyền đã mua thì không
   có quảng cáo và vẫn nhận thưởng; cấu hình tắt hoặc chưa từng đọc được thì không có.
4. Thử thật trên máy Android với **mã đơn vị thử của Google**, không bấm quảng cáo thật.
