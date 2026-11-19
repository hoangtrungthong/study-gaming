# Tài liệu thiết kế — Quảng cáo theo nhóm tuổi (mvp-ads)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

> Các chỗ phụ thuộc một câu "Chờ chốt" ghi rõ `(CC-n)`; giá trị trong ngoặc là **đề xuất**, đổi theo câu trả lời.

## Tổng quan

Bốn lớp, tất cả trong `apps/game/src/ads/`:

1. **Bộ luật vị trí** (`rules.ts`): hàm thuần `decide(placement, ctx)`, không đụng DOM, SDK hay `localStorage`. Copy kiểu viết
   của `games/rain/RainGame.ts` (TS thuần, nhận `now` để test).
2. **Cấu hình từ xa** (`remoteConfig.ts`): đọc, kiểm lược đồ, kẹp giá trị, lưu bản cuối cùng hợp lệ.
3. **`AdService`** (`adService.ts`): một cổng duy nhất cho màn hình. Gom ngữ cảnh (nhóm tuổi, màn, hoạt động, mạng, quyền đã
   mua, cấu hình, bộ đếm), hỏi bộ luật, gọi nhà cung cấp, cập nhật bộ đếm, cộng thưởng.
4. **Nhà cung cấp** (`providers/`): `noop`, `admob` (Capacitor), `adsense` (web), `fake` (E2E). Cùng một interface; nạp bằng
   `import()` động, sau một hằng lúc build để Rollup bỏ hẳn nhánh không dùng.

Thành phần giao diện: `AdBanner.vue` (chỗ banner ở bản đồ đảo / khối web ở tổng kết) và `RewardOffer.vue` (lời mời thưởng).

```
Màn hình ──► AdService.can()/show()/offerReward()
               │  ctx ◄── settings.ageGroup, screen, activity, navigator.onLine,
               │          entitlement (mvp-purchases), remoteConfig, counters
               ├──► rules.decide()  (thuần)
               └──► provider (noop | admob | adsense | fake, nạp động)
                       └─ thưởng ──► rewards.grant() ──► hàm cộng của mvp-progress
```

## Tầng 1: công tắc lúc build

- `vite.config.ts` thêm `define`:
  - `__ADS_ENABLED__`: `process.env.ADS_ENABLED === 'true'` (CC-13: không đặt = `false`).
  - `__ADS_FAKE__`: `process.env.ADS_PROVIDER === 'fake'` (chỉ build E2E đặt).
  Khai báo kiểu trong `src/env.d.ts`. Không dùng `import.meta.env.VITE_*` cho công tắc này vì cần hằng thay thẳng để Rollup bỏ mã.
- `providers/index.ts`:

  ```ts
  export async function loadProvider(platform: Platform): Promise<AdProvider> {
    if (!__ADS_ENABLED__) return noopProvider;
    if (__ADS_FAKE__) return (await import('./fake')).fakeProvider;
    return platform === 'web' ? (await import('./adsense')).adsenseProvider : (await import('./admob')).admobProvider;
  }
  ```

  `__ADS_ENABLED__ = false` thì hai nhánh `import()` là mã chết, Rollup không tạo chunk `admob` / `adsense`.
- **Android (phối hợp `mvp-android`):** plugin Capacitor cài qua npm tự được `cap sync` đưa vào dự án Android dù JS không import.
  Vì vậy `capacitor.config.ts` dùng `includePlugins` để **loại** `@capacitor-community/admob` (CC-1) khi `ADS_ENABLED !== 'true'`,
  và `APPLICATION_ID` của AdMob trong `AndroidManifest.xml` lấy từ placeholder Gradle chỉ khi bật. Có quảng cáo mà thiếu
  `APPLICATION_ID` thì SDK AdMob làm app thoát khi mở, nên kiểm tra ở task 2.3.
- `scripts/check-no-ads.mjs`: sau build tắt quảng cáo, quét `apps/game/dist/**/*.js` tìm `adsbygoogle`, `pagead2.googlesyndication`,
  `AdMob` (tên plugin đăng ký); có thì thoát mã 1. Chạy trong CI sau `pnpm build`. Cần hỏi trước khi thêm lệnh này vào
  `package.json` (AGENTS.md mục 4: không tự thêm lệnh); đề xuất tên `ads:check`.

## Tầng 2: cấu hình từ xa

### Lược đồ `ads-config.json`

```jsonc
{
  "schema": 1,
  "enabled": true,                       // tắt chung
  "placements": {
    "rewarded": { "enabled": true },
    "interstitial": { "enabled": true, "everyLevels": 3, "minGapSeconds": 180 },  // CC-4a,b
    "banner": { "enabled": true }
  },
  "rewards": { "hint": true, "revive": true, "doubleDecor": true },
  "dailyCaps": { "hint": 3, "total": 10 },  // CC-4d
  "platforms": { "android": true, "ios": false, "web": true }
}
```

- Kiểu `AdsRemoteConfig` + hàm `parseConfig(unknown): AdsRemoteConfig | null` viết tay (không thêm thư viện kiểm lược đồ).
  `schema` lạ hoặc thiếu trường bắt buộc → `null`.
- Kẹp (CC-4e): `everyLevels = max(3, x)`, `minGapSeconds = max(đề xuất 180, x)`, `dailyCaps.* = min(mặc định, x)`. Cấu hình chỉ
  làm chặt hơn.
- Lưu: `localStorage` khoá `tomo.ads.config.v1` = `{ config, fetchedAt }`. Không có hạn dùng (quyết định 2: giữ bản cuối).

### Đọc

- Địa chỉ: `import.meta.env.VITE_ADS_CONFIG_URL` (CC-2). `fetch(url, { cache: 'no-store' })`, hết giờ 5 giây (`AbortController`).
- Không đặt trong `public/`, nên không vào precache (`vite.config.ts:26`). Là địa chỉ khác nguồn trên app, nên service worker không
  chặn. Trên web cùng nguồn: thêm `runtimeCaching` `NetworkOnly` cho `/ads-config.json` để Workbox không phục vụ bản cũ.
- Khi nào (CC-3): lúc khởi động (sau khi màn đầu đã hiện, không chờ) và khi `visibilitychange` → `visible` nếu
  `now - fetchedAt > 6 giờ`; bỏ qua khi `navigator.onLine === false` hoặc đang chơi màn.
- `__ADS_ENABLED__ = false` thì không có mã đọc cấu hình (cùng nằm sau nhánh hằng).

## Bộ luật vị trí (`rules.ts`)

```ts
type Placement = 'rewarded' | 'interstitial' | 'banner';
type AdScreen = 'home' | 'island-map' | 'playing' | 'result' | 'boss-hint' | 'region-reward' | 'settings' | 'parent';
type RewardKind = 'hint' | 'revive' | 'doubleDecor';

interface AdContext {
  buildEnabled: boolean;              // __ADS_ENABLED__
  platform: 'android' | 'ios' | 'web';
  ageGroup: AgeGroup | null;          // null = chưa trả lời màn hỏi tuổi (CC-7)
  screen: AdScreen;
  activity: { playing: boolean; typing: boolean; listening: boolean };
  online: boolean;
  noAdsEntitlement: boolean;          // từ mvp-purchases
  consentOk: boolean;                 // UMP (CC-9); web và Chồi = true
  config: AdsRemoteConfig | null;
  counters: AdCounters;
  sessionResultCount: number;         // số lần tổng kết từ lúc mở app (CC-4c)
  now: number;
  reward?: RewardKind;
}

interface AdCounters {
  levelsSinceInterstitial: number;
  lastInterstitialAt: number | null;
  day: string;                        // 'YYYY-MM-DD' giờ máy
  rewardsToday: Record<RewardKind, number>;
  reviveUsedMatchId: string | null;
}

interface AdDecision {
  allowed: boolean;
  reason: 'ok' | 'build-off' | 'no-config' | 'config-off' | 'placement-off' | 'platform-off' | 'entitled'
        | 'age' | 'screen' | 'busy' | 'offline' | 'consent' | 'frequency' | 'daily-cap' | 'revive-used';
  treatment: AdTreatment;
}

interface AdTreatment { childDirected: boolean; maxRating: 'G' | 'PG' | 'T' | 'MA'; npa: boolean }
```

Thứ tự kiểm (dừng ở điều đầu tiên sai, `reason` cho biết vì sao — dùng trong test và log):

1. `buildEnabled` → `build-off`.
2. `noAdsEntitlement` → `entitled`.
3. `ageGroup === null || 'mam'` → `age`; `screen === 'parent' | 'settings'` → `screen`.
4. `activity.playing || typing || listening` → `busy`; `!online` → `offline`.
5. `config === null` → `no-config`; `!config.enabled` → `config-off`; `!config.platforms[platform]` → `platform-off`;
   `!config.placements[p].enabled` → `placement-off`; `reward && !config.rewards[reward]` → `placement-off`.
6. Bảng vị trí × nhóm × màn (quyết định 3, 6):

   | Vị trí | Chồi | Cây | Màn cho phép | Nền tảng |
   |---|---|---|---|---|
   | `rewarded` | có | có | `result` (revive), `boss-hint`, `region-reward` | app (web: chưa, MVP) |
   | `interstitial` | không | có | `result` | app + web (web là khối trong trang, CC-10) |
   | `banner` | không | có | `island-map` | app + web |

   Không khớp → `age` / `screen` / `platform-off`.
7. `!consentOk` → `consent` (Cây trên app).
8. Tần suất: `interstitial` cần `levelsSinceInterstitial >= everyLevels`, `now - lastInterstitialAt >= minGapSeconds`,
   `sessionResultCount > 1` (CC-4) → `frequency`. `rewarded`: `revive` đã dùng trong trận → `revive-used`; vượt `dailyCaps` →
   `daily-cap` (ngày khác `counters.day` thì coi như 0).

`treatmentFor(ageGroup)` (CC-8): Chồi `{ childDirected: true, maxRating: 'G', npa: true }`; Cây `{ false, 'T', false }`.

Hàm phụ thuần: `recordResult(counters)`, `recordInterstitial(counters, now)`, `recordReward(counters, kind, matchId, today)`,
`rollDay(counters, today)`. Riêng `canGrantWithoutAd(ctx)` cho người đã mua (CC-15): có quyền, nhóm Chồi/Cây, đúng màn, chưa vượt
trần → `true` (không xét mạng, cấu hình).

## `AdService` (`adService.ts`)

```ts
interface AdService {
  init(): Promise<void>;                                  // nạp provider, đọc cấu hình nền, UMP (Cây)
  can(p: Placement, screen: AdScreen, reward?: RewardKind): AdDecision;
  rewardOffer(kind: RewardKind, screen: AdScreen, matchId?: string): 'watch' | 'free' | 'none';
  showRewarded(kind: RewardKind, screen: AdScreen, matchId?: string): Promise<'granted' | 'cancelled' | 'unavailable'>;
  claimFree(kind: RewardKind, screen: AdScreen, matchId?: string): Promise<boolean>;  // người đã mua
  onResultShown(): void;                                  // tăng bộ đếm màn
  maybeInterstitial(): Promise<void>;                     // gọi khi rời màn tổng kết (CC-16)
  mountBanner(el: HTMLElement): Promise<() => void>;      // trả hàm gỡ
}
```

- Ngữ cảnh lấy từ: `settings.ageGroup` + cờ "đã trả lời tuổi" (CC-7), `adActivity` (reactive `{ screen, playing, typing,
  listening }` các màn tự đặt), `navigator.onLine` + sự kiện `online/offline`, `entitlement.noAds` (store của `mvp-purchases`),
  `remoteConfig.current`, bộ đếm `localStorage` khoá `tomo.ads.counters.v1`.
- `listening`: thêm `speaking` (`ref<boolean>`) vào `Speaker` (`audio/speaker.ts:51`), bật khi `say` bắt đầu, tắt khi xong /
  `stop`. `AdService` đọc cờ này, màn không phải tự báo.
- Trước khi hiện: `speaker.stop()`, phát sự kiện `ads:pause` (Phaser / âm thanh game dừng); sau khi đóng: `ads:resume`, focus về
  phần tử đã giữ focus.
- Chống bấm hai lần: một `Promise` đang chạy duy nhất; `showRewarded` gọi lần hai trả lời cùng `Promise`.
- Một lượt thưởng có `grantId` (ngẫu nhiên); `rewards.grant` ghi `grantId` đã dùng (giữ 50 mã gần nhất) nên sự kiện thưởng đến
  hai lần chỉ cộng một lần.
- Mọi lỗi provider → `'unavailable'`, `console.warn('[ads]', reason)` không có dữ liệu cá nhân.

## Nhà cung cấp (`providers/`)

```ts
interface AdProvider {
  init(t: AdTreatment): Promise<void>;
  applyTreatment(t: AdTreatment): Promise<void>;
  consent(): Promise<boolean>;                  // UMP; web/noop trả true
  showRewarded(t: AdTreatment): Promise<'rewarded' | 'closed' | 'failed'>;
  showInterstitial(t: AdTreatment): Promise<void>;
  mountBanner(el: HTMLElement, t: AdTreatment): Promise<() => void>;
}
```

- **`noop`**: mọi hàm trả ngay (`showRewarded` → `'failed'`), `mountBanner` không vẽ gì.
- **`admob`** (CC-1 `@capacitor-community/admob`): `AdMob.initialize({ tagForChildDirectedTreatment, maxAdContentRating,
  initializeForTesting: import.meta.env.DEV, testingDevices })`; `prepareRewardVideoAd({ adId, npa })` rồi
  `showRewardVideoAd()`, nghe sự kiện thưởng (`RewardAdPluginEvents.Rewarded`) để trả `'rewarded'`; `prepareInterstitial` /
  `showInterstitial`; `showBanner({ adId, adSize: ADAPTIVE_BANNER, position: BOTTOM_CENTER, npa })` (CC-5), gỡ bằng
  `removeBanner`. Banner gốc nằm đè WebView, nên `AdBanner.vue` chừa đúng chiều cao banner (sự kiện `SizeChanged`) để không che
  nút. UMP: `requestConsentInfo` → `showConsentForm` nếu cần → `canRequestAds` (CC-9). Đổi treatment → khởi tạo lại cờ trước yêu
  cầu kế tiếp.
- **`adsense`** (CC-10): chèn `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=…">`
  lần đầu được phép; `mountBanner` tạo `<ins class="adsbygoogle" data-ad-client data-ad-slot data-ad-format="auto"
  data-full-width-responsive="true">` rồi `push({})`. Chồi (nếu sau này có) thêm `data-tag-for-age-treatment="1"`.
  `showInterstitial` trên web = hiện khối trong trang ở `ResultPanel` (không toàn màn hình). Không dùng Auto ads (không kiểm soát
  được vị trí, có thể hiện lúc chơi). Bản dev đặt `data-adtest="on"`.
- **`fake`** (chỉ build `ADS_PROVIDER=fake`): vẽ lớp phủ `data-testid="ad-fake-interstitial"`, `ad-fake-rewarded` (nút "Xem xong",
  "Đóng sớm"), `ad-fake-banner`; ghi `window.__adsLog` để E2E đọc. Không bao giờ vào bản phát hành (nhánh hằng `__ADS_FAKE__`).

### Mã thử (CC-12)

| Dạng | Mã thử Android của Google |
|---|---|
| App ID | `ca-app-pub-3940256099942544~3347511713` |
| Banner thích ứng | `ca-app-pub-3940256099942544/9214589741` |
| Toàn màn hình | `ca-app-pub-3940256099942544/1033173712` |
| Có thưởng | `ca-app-pub-3940256099942544/5224354917` |

Nguồn: [AdMob test ads](https://developers.google.com/admob/android/test-ads). `.env.example` ghi các biến, giá trị mặc định là
mã thử; mã thật chỉ đặt ở biến của CI phát hành, không commit.

## Màn hình

| Chỗ | Thay đổi | Ghi chú |
|---|---|---|
| `App.vue` | `adService.init()` trong `onMounted` (sau `loadManifest`); cập nhật `adActivity.screen` theo `screen` | Màn chơi đặt `playing` |
| `ResultPanel.vue` | gọi `onResultShown()` khi mở; nút "Chơi lại" / "Về đảo" gọi `await maybeInterstitial()` trước khi phát sự kiện (CC-16); slot khối web | Không đổi giao diện khi `noop` |
| `RainView.vue` + `RainGame.ts` | `RainGame.revive()` (+1 chậu, tiếp tục từ trạng thái lúc dừng, chỉ khi kết thúc vì `lives`); khi kết thúc vì hết chậu, hiện `RewardOffer kind="revive"` trước khi đọc tổng kết; `playing`/`typing` theo `phase` | Lời mời không hiện khi hết giờ |
| Màn trùm (`mvp-progress`) | bảng gợi ý thêm `RewardOffer kind="hint"` | Màn dừng khi mở bảng |
| Màn nhận đồ cuối vùng (`mvp-progress`) | `RewardOffer kind="doubleDecor"` | |
| Bản đồ đảo (`mvp-progress`) | `<AdBanner />` ở đáy | Cây; gỡ khi rời |
| Màn hỏi tuổi (CC-7) | nếu được chốt và chưa có ở `mvp-progress` | Đọc thành tiếng |
| Cài đặt | nút "Tuỳ chọn quyền riêng tư quảng cáo" khi UMP báo cần (CC-9) | Chỉ Cây trên app |

`RewardOffer.vue`: nút chính "Xem quảng cáo để nhận …" hoặc "Nhận ngay" (người đã mua), nút phụ "Thôi"; chữ và lời đọc qua
`speaker.say([viSegment(phrases.adOffer…)])`, câu mới thêm vào `packages/content/src/phrases.ts`. Nút ≥ 48px, cách nút khác ≥ 16px.
Không có hiệu ứng nhấp nháy dụ bấm.

## Offline

- Bộ luật từ chối khi `!online`; `RewardOffer` ẩn (trừ "Nhận ngay"). Banner không chừa chỗ.
- Script AdSense và SDK AdMob không được precache; mất mạng thì `import()` của provider vẫn chạy được (chunk JS của app đã precache),
  nhưng không gọi quảng cáo.
- Cấu hình, bộ đếm, mã lượt thưởng nằm trong `localStorage`.

## Dữ liệu và riêng tư

- Không truyền email, tên, mã tài khoản vào yêu cầu quảng cáo, không đặt `keywords`/`contentUrl` chứa dữ liệu người chơi.
- Chồi: `childDirected` + `npa` + `G`; không gọi UMP / ATT.
- Không log mã quảng cáo cùng định danh người chơi.

## Test

| Mức | File | Nội dung |
|---|---|---|
| Unit | `ads/rules.test.ts` | Bảng luật đủ tổ hợp nhóm × vị trí × màn × nền tảng; từng `reason`; tần suất 1/3, khoảng cách, lần tổng kết đầu, trần ngày, đổi ngày, revive mỗi trận; `treatmentFor`; `canGrantWithoutAd`. **100% dòng và nhánh** |
| Unit | `ads/remoteConfig.test.ts` | Hợp lệ / sai lược đồ / JSON hỏng / lỗi mạng / hết giờ; giữ bản cũ; chưa từng có → `null`; kẹp giá trị; không đọc khi offline; chu kỳ 6 giờ (đồng hồ giả) |
| Unit | `ads/adService.test.ts` | Provider giả: thưởng chỉ khi `'rewarded'`; đóng sớm / lỗi không cộng; trùng sự kiện cộng 1 lần; bấm hai lần; dừng / trả giọng đọc; người đã mua `claimFree` |
| Unit | `ads/providers/*.test.ts` | `admob` với mock plugin (cờ trẻ em, `npa`, mã thử khi dev); `adsense` chèn script đúng 1 lần, thẻ `ins`; `noop` |
| Unit | `RainGame.test.ts`, `games.test.ts` | `revive()`; lời mời hồi chậu chỉ khi hết chậu |
| Build | `scripts/check-no-ads.mjs` | Bản `ADS_ENABLED` không đặt không có chuỗi quảng cáo |
| E2E | `e2e/ads-off.spec.ts` (bản mặc định, `noop`) | Đi qua mọi màn ở 3 nhóm: không có `[data-testid^="ad-"]`, không có request tới `googlesyndication` / file cấu hình |
| E2E | `e2e/ads.spec.ts` (bản `ADS_ENABLED=true ADS_PROVIDER=fake`, cấu hình qua `page.route`) | Mầm không có; offline không có; đang chơi / gõ / nghe không có; Chồi chỉ có lời mời thưởng, xem xong hồi chậu và chơi tiếp; Cây toàn màn hình đúng sau màn thứ 3 khi bấm "Về đảo", banner ở bản đồ; có quyền đã mua → không có quảng cáo, có "Nhận ngay"; cấu hình tắt / lỗi lần đầu → không có |

Playwright cần hai bản build: thêm `webServer` thứ hai (cổng 4174, `ADS_ENABLED=true ADS_PROVIDER=fake`) và project chỉ chạy
`ads.spec.ts` ở cổng đó, cả khổ máy tính + điện thoại. Thử trên máy Android thật với mã thử ghi ở `docs/ads.md`.
