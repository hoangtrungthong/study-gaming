# Tài liệu thiết kế — Tiến độ học MVP (mvp-progress)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

> Thiết kế dựa trên các **đề xuất** ở `requirements.md` mục "Chờ chốt". Chỗ nào phụ thuộc một câu chờ chốt thì ghi mã
> (CC-n). Chủ sản phẩm chọn khác thì sửa mục tương ứng trước khi code.

## 1. Tổng quan các lớp

```
packages/content/src/progress/   (CC-21: hàm TS thuần, chạy ở game + máy chủ, Vitest node)
  types.ts      ProgressDocV1, LevelResult, MapRegion, Mission, SyncRequestV1/SyncResponseV1
  day.ts        dayKey(date), addDays, diffDays          — khoá ngày theo giờ máy (CC-15)
  record.ts     recordLevel(doc, result, ctx)            — ghi sao, ngày học, kết quả từng từ
  streak.ts     computeStreak(activeDays, today)         — chuỗi, kỷ lục, vé nghỉ (CC-14, CC-17)
  unlock.ts     levelStates(doc, map)                    — khoá / mở / xong (CC-10, CC-11)
  mission.ts    makeMission(doc, map, today, lastSubject) (CC-13)
  merge.ts      mergeProgress(a, b)                      (CC-20)
  migrate.ts    migrateProgress(raw) → ProgressDocV1 | 'newer' | 'invalid'
  map.ts        validateMap(map, deck)                   — kiểm danh sách vùng / màn
packages/content/data/map-{en,ja,it}.json                — vùng + màn (CC-8, CC-9)
packages/content/data/released-level-ids.json            — mã màn đã phát hành, không được mất

apps/game/src/progress/          (lớp Vue mỏng)
  kvStore.ts    KeyValueStore + localStorageStore         (CC-5)
  repo.ts       đọc / ghi / chuyển phiên bản / khoá dự phòng / sự kiện storage
  store.ts      trạng thái phản ứng của hồ sơ đang chơi + các hành động
  clock.ts      now() có thể thay trong test
  playTime.ts   đếm phút chơi (CC-18)
apps/game/src/views/  ProfilePickerView, ProfileFormView, IntroView, IslandView (bản đồ), MissionCard, StreakBadge
apps/game/src/components/ParentGate.vue                   (CC-18, CC-19)
```

Nguyên tắc: Vue chỉ hiển thị và gọi hành động; mọi luật nằm ở `packages/content/src/progress/` (`AGENTS.md` mục 6).
Không thêm thư viện. Không router: tiếp tục biến `screen` trong `App.vue` (`App.vue:12-13`), thêm màn mới vào kiểu `Screen`.

## 2. Nội dung: vùng và màn

```ts
type GameId = 'match' | 'rain';            // mvp-games thêm 'catch' | 'order' | 'listen' | 'flip' | 'write' | 'kana' | 'blocks'
interface MapLevel {
  id: string;                              // `<môn>-r<vùng>-l<màn>`, ví dụ `ja-r1-l3`; KHÔNG BAO GIỜ đổi sau khi phát hành
  kind: 'normal' | 'boss';                 // 'boss' chỉ dùng từ giai đoạn 2 (CC-9)
  game: GameId;
  itemIds: string[];                       // từ trong bộ bài của môn
}
interface MapRegion {
  id: string;                              // `<môn>-r<vùng>`
  titleVi: string;
  titleTarget: string;                     // tên bằng ngôn ngữ đang học (kịch bản mục 7)
  levels: MapLevel[];
}
interface IslandMap { subject: Subject; regions: MapRegion[] }
```

- File `packages/content/data/map-<môn>.json`, nạp như `decks.ts:1-3` (import có `with { type: 'json' }`, `docs/ai/00-overview.md` §8).
- `validateMap(map, deck)` trả danh sách lỗi (giống `validateDeck`, `packages/content/src/validate.ts:7`): mã duy nhất, đúng
  tiền tố môn, `itemIds` có trong bộ bài, mỗi vùng 6–10 màn thường (kịch bản mục 3), `boss` chỉ ở cuối vùng, `game` hợp lệ.
  Chạy trong `content.test.ts` và hook pre-commit như bộ bài.
- `released-level-ids.json`: test đỏ khi một mã từng phát hành biến mất khỏi bản đồ (vì tiến độ khoá theo mã). Đổi tên màn
  thì chỉ đổi `titleVi`, không đổi `id`.
- Nội dung mẫu MVP (CC-8): 2 vùng × 6 màn mỗi đảo, lấy từ en 16 / ja 16 / it 20 từ hiện có, xen kẽ `match` và `rain`. Tên vùng
  lấy từ kịch bản mục 7 (ví dụ en: "Bến Cảng ABC", "Khu Vườn Màu"; ja: "Cổng Torii", "Phố Đèn Lồng"; it: "Xưởng Lắp Ráp",
  "Mê Cung Của Bit"), từ được xếp vào vùng nào là việc nội dung, không phải luật.

## 3. Mô hình dữ liệu trên máy

### 3.1. Gói tiến độ của một hồ sơ (`ProgressDocV1`) — cũng là đơn vị đồng bộ

```ts
type DayKey = string;                      // 'YYYY-MM-DD' theo lịch giờ máy (CC-15)
type Iso = string;                         // thời điểm ISO 8601 có múi giờ

interface ProgressDocV1 {
  schema: 1;
  profileId: string;                       // crypto.randomUUID() (có trên https và localhost, kể cả WebView Capacitor)
  createdAt: Iso;
  profile: { ageGroup: AgeGroup; avatar: string; updatedAt: Iso; updatedBy: string };   // CC-3, không có biệt danh
  settings: Settings & { updatedAt: Iso; updatedBy: string };                           // CC-4, Settings của settings.ts:4-14
  levels: Record<string, { bestStars: 1 | 2 | 3; firstDoneAt: Iso }>;
  activeDays: DayKey[];                    // ngày học, tăng dần, không trùng (CC-14)
  missions: Record<DayKey, Mission>;       // giữ 14 ngày gần nhất
  introSeen: boolean;                      // CC-7
  /** Bộ đếm theo từng máy: mỗi máy chỉ tăng phần của mình, nên gộp bằng max theo máy, cộng khi hiển thị. */
  byDevice: Record<string, DeviceCounters>;
}
interface DeviceCounters {
  plays: Record<string, number>;           // levelId → số lần xong
  items: Record<string, { seen: number; wrong: number; lastDay: DayKey }>;   // CC-16
  minutes: Record<DayKey, number>;         // CC-18, giữ 30 ngày
}
interface Mission {
  createdAt: Iso;
  tasks: ({ id: string; kind: 'level'; levelId: string } | { id: string; kind: 'review'; itemIds: string[] })[];
  done: string[];                          // id của task đã xong
}
```

Không lưu chuỗi ngày, số vé, kỷ lục, cờ "đã mở": đều **tính lại** từ `activeDays` và `levels` (mục 4). Nhờ vậy gộp giữa
các máy chỉ cần gộp dữ liệu gốc.

### 3.2. Trạng thái riêng của máy (không đồng bộ)

```ts
interface DeviceStateV1 {
  schema: 1;
  deviceId: string;                        // UUID ngẫu nhiên, không gắn phần cứng
  profileIds: string[];                    // thứ tự hiện ở màn chọn hồ sơ, tối đa 4 (CC-2)
  activeProfileId: string | null;
  nicknames: Record<string, string>;       // CC-3: chỉ trên máy
  hints: { safariSaveShown: boolean };     // CC-6
  lastSubject: Record<string, Subject>;    // đảo chơi gần nhất của từng hồ sơ (CC-13)
}
```

### 3.3. Khoá lưu (CC-5: `localStorage`)

| Khoá | Nội dung |
|---|---|
| `tomo.device.v1` | `DeviceStateV1` |
| `tomo.progress.v1.<profileId>` | `ProgressDocV1` (một khoá mỗi hồ sơ, `setItem` một khoá là nguyên tử) |
| `tomo.progress.v1.<profileId>.corrupt` | bản gốc không đọc được, giữ để cứu (Yêu cầu 8.2) |
| `tomo.settings.v1` (cũ) | đọc một lần để tạo hồ sơ đầu tiên (CC-4), xoá sau khi ghi hồ sơ thành công |

Dung lượng ước tính: MVP 36 màn × ~60 byte + 52 từ × ~50 byte + 365 ngày × 13 byte + 14 nhiệm vụ × ~200 byte ≈ 12 KB một hồ
sơ một năm. Đủ nội dung (3 đảo × 8 vùng × 10 màn, vài nghìn từ) khoảng 150–250 KB một hồ sơ; 4 hồ sơ < 1 MB, dưới giới hạn
5 MiB của `localStorage` (MDN). Vượt ngưỡng thì chuyển kho (CC-5 lựa chọn B/C) mà không đổi `KeyValueStore`.

### 3.4. `KeyValueStore`

```ts
interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;   // ném QuotaExceededError lên để repo báo người chơi
  remove(key: string): void;
  keys(prefix: string): string[];
  subscribe(cb: (key: string) => void): () => void;   // sự kiện `storage` giữa các tab
}
```

Đồng bộ (không async) vì `localStorage` đồng bộ. Bản app Android sau này dùng Capacitor Preferences (async): khi đó
`repo.ts` nạp hết vào bộ nhớ lúc mở app và ghi sau, giao diện `store.ts` giữ nguyên. Việc này thuộc spec đóng gói Android.

### 3.5. Đọc, ghi, chuyển phiên bản (`repo.ts`)

1. Mở app: đọc `tomo.device.v1`; chưa có thì tạo `deviceId`. Có `tomo.settings.v1` mà chưa có hồ sơ: tạo hồ sơ từ cài đặt cũ.
2. Đọc gói của hồ sơ: `migrateProgress(JSON.parse(raw))`:
   - `'invalid'` (JSON hỏng, thiếu trường bắt buộc): chép chuỗi gốc sang khoá `.corrupt`, dùng gói trống, `console.warn`
     mã hồ sơ (không có nội dung).
   - `'newer'` (`schema` lớn hơn bản app biết, ví dụ sau khi đồng bộ từ máy có bản mới hơn): chỉ đọc, không ghi đè, báo
     cập nhật game (Yêu cầu 9.5).
3. Mỗi hành động (`recordLevel`, đổi cài đặt…): tính gói mới bằng hàm thuần → `set` ngay (trước khi hiện bảng kết quả,
   Yêu cầu 5.3). Lỗi hết chỗ: giữ gói trong bộ nhớ, đánh dấu `unsaved`, thử ghi lại ở hành động sau, Tomo báo một lần.
4. Sự kiện `storage` (tab khác ghi): đọc gói mới, `mergeProgress(bộ nhớ, gói tab kia)`, ghi nếu khác. Hai tab cùng ghi
   thì nhờ gộp không mất kết quả (Yêu cầu 8.4).
5. Sau màn đầu tiên xong: `navigator.storage?.persist?.()` một lần (CC-5); kết quả không ảnh hưởng luồng chơi.

## 4. Luật (hàm thuần)

### 4.1. Ghi kết quả màn — `recordLevel(doc, result, { deviceId, now })`

- `levels[id].bestStars = max(cũ, result.stars)`; `firstDoneAt` giữ lần đầu.
- Thêm `dayKey(now)` vào `activeDays` (CC-14).
- `byDevice[deviceId].plays[id] += 1`; mỗi từ trong `result.items`: `seen += 1`, `wrong += correct ? 0 : 1`, `lastDay` (CC-16).
- Đánh dấu task của nhiệm vụ hôm nay: task `level` cùng `levelId`, hoặc task `review` khi `result.levelId` là mã ôn tập
  (`review-<DayKey>`).
- Cắt `missions` cũ hơn 14 ngày, `minutes` cũ hơn 30 ngày (cắt ở lúc ghi, không cắt trong `mergeProgress`).

### 4.2. Chuỗi và vé nghỉ — `computeStreak(activeDays, today)` (CC-14, CC-15, CC-17)

```
vé = 1; chuỗi = 0; kỷ lục = 0; bù = []
duyệt các ngày học d theo thứ tự:
  khoảng trống g = số ngày giữa ngày học trước và d (không kể hai đầu)
  nếu g > 0: nếu g ≤ vé thì vé -= g, thêm các ngày trống vào bù; ngược lại chuỗi = 0
  chuỗi += 1; kỷ lục = max(kỷ lục, chuỗi)
  nếu chuỗi > 0 và chuỗi % 7 == 0 thì vé = min(2, vé + 1)
sau ngày học cuối: khoảng trống tới HÔM QUA (hôm nay chưa chơi không làm đứt chuỗi) xử lý như trên
trả { current: chuỗi, best: kỷ lục, tickets: vé, coveredDays: bù, playedToday }
```

- Ngày được vé bù giữ chuỗi nhưng không cộng vào số chuỗi.
- `coveredDays` mới (so với lần mở trước, lưu ở bộ nhớ phiên) → Tomo báo "Vé nghỉ đã giữ chuỗi" (Yêu cầu 7.3).
- Hàm chạy O(số ngày học); 10 năm ≈ 3.650 phần tử, không đáng kể.
- Đổi luật vé sau này thì chuỗi cũ được tính lại theo luật mới: chấp nhận, ghi vào ghi chú phát hành.

### 4.3. Luật mở — `levelStates(doc, map)` (CC-10, CC-11, CC-12)

- Màn `i` của vùng mở khi `i = 0` và vùng mở, hoặc màn `i − 1` có trong `doc.levels`.
- Vùng 1 mở; vùng `k` mở khi màn cuối của vùng `k − 1` có trong `doc.levels`.
- Màn đã có trong `doc.levels` luôn là "xong" (không bao giờ khoá lại, Yêu cầu 4.2), kể cả khi nó không còn thoả luật trên
  vì nội dung chèn thêm màn.
- Không đọc `ageGroup`: đổi nhóm tuổi không đổi trạng thái (CC-12).
- Trả thêm `nextLevelId` (màn mở đầu tiên chưa xong) cho nút "chơi tiếp" và "Màn tiếp".

### 4.4. Nhiệm vụ hôm nay — `makeMission(doc, maps, today, lastSubject)` (CC-13)

- Đã có `missions[today]` thì trả lại, không tạo lại.
- 3 task `level`: duyệt đảo `lastSubject` trước rồi các đảo còn lại theo `subjects` (`decks.ts:12`); lấy màn mở chưa xong,
  thiếu thì màn mở chưa đủ 3 sao, thiếu nữa thì màn có sao thấp nhất. Không lặp màn.
- 1 task `review`: tối đa 8 từ (Mầm 5, theo `MATCH_CONFIG`/`RAIN_CONFIG` của nhóm) từ các màn đã chơi, xếp theo
  `wrong / seen` giảm dần rồi `lastDay` cũ trước; chưa chơi màn nào thì lấy từ màn 1 của đảo `lastSubject`.
- Tất định: cùng đầu vào cho cùng kết quả (không dùng `Math.random`), để test được và hai máy cùng ngày ra gần giống nhau.

### 4.5. Thời gian chơi (CC-18)

`playTime.ts` cộng giây khi đang ở màn chơi và `document.visibilityState === 'visible'`, ghi vào
`byDevice[deviceId].minutes[today]` mỗi phút. Luật nhắc là hàm thuần `playLimit(ageGroup, minutesToday, extraGranted)` →
`'none' | 'remind' | 'gate'`.

## 5. Hợp đồng đồng bộ với `mvp-accounts`

### 5.1. Gói gửi

```ts
interface SyncRequestV1  { schema: 1; deviceId: string; docs: ProgressDocV1[] }
interface SyncResponseV1 { schema: 1; docs: ProgressDocV1[] }   // mọi hồ sơ của tài khoản, đã gộp
// Chốt 2026-11-18 (mvp-accounts CC-13): hồ sơ đã bị xoá ở máy khác; máy nhận hỏi người chơi, không tự xoá
//   interface SyncResponseV1 { schema: 1; docs: ProgressDocV1[]; deletedProfileIds?: string[] }
```

Đường dẫn, xác thực, giới hạn tần suất, lưu trữ (một dòng `jsonb` cho mỗi cặp tài khoản + `profileId`) thuộc `mvp-accounts`.
Spec này chỉ cam kết kiểu và hàm:

- Máy chủ, với mỗi gói nhận: `migrateProgress` → `mergeProgress(bản đang lưu, gói nhận)` → lưu → trả mọi hồ sơ của tài khoản.
- Máy, với mỗi gói nhận về: `mergeProgress(bản trên máy, gói về)`; hồ sơ chưa có trên máy thì thêm vào `profileIds` (vượt
  4 hồ sơ thì vẫn lưu, màn chọn cuộn được; giới hạn 4 chỉ chặn tạo mới).
- **Đăng nhập lần đầu** (quyết định 2): cùng một lời gọi, gửi mọi hồ sơ trên máy. Không có bước riêng.
- Gửi lại cùng gói nhiều lần không đổi kết quả (hàm gộp chạy lại không đổi), nên mạng chập chờn cứ gửi lại.
- Máy chủ nên kiểm kích thước gói (đề xuất cho `mvp-accounts`: ≤ 512 KB mỗi gói) và giữ nguyên `levelId` / `itemId` lạ
  (nội dung bản mới hơn).

### 5.2. Quy tắc gộp `mergeProgress(a, b)` (CC-20, cùng `profileId`)

| Trường | Cách gộp |
|---|---|
| `createdAt` | sớm hơn |
| `profile`, `settings` | bản có `updatedAt` sau hơn; bằng nhau thì `updatedBy` (deviceId) lớn hơn theo thứ tự chuỗi |
| `levels[id]` | `bestStars` lớn hơn, `firstDoneAt` sớm hơn |
| `activeDays` | hợp, sắp xếp |
| `missions[day]` | `tasks` của bản `createdAt` sớm hơn; `done` = hợp, bỏ id không có trong `tasks` đã chọn |
| `introSeen` | hoặc (OR) |
| `byDevice[dev]` | từng số đếm lấy **max** (mỗi máy chỉ tăng phần của nó); `lastDay` lấy muộn hơn |

Tính chất phải có test: `merge(a,b) = merge(b,a)`, `merge(a, merge(b,c)) = merge(merge(a,b), c)`, `merge(a,a) = a`; gộp không
làm giảm `bestStars`, không bớt `activeDays`. Test bảng bằng các gói mẫu dựng tay (không thêm thư viện kiểm tính chất).

### 5.3. Phiên bản

- `schema` là số nguyên; bản sau thêm trường thì tăng số và thêm một bước vào `migrateProgress` (chỉ nâng lên, không hạ xuống).
- Máy chủ luôn chạy bản `@study/content` mới nhất, nên nhận được gói cũ. Máy cũ nhận gói mới hơn: `'newer'`, không ghi đè.
- Xoá hồ sơ đã đồng bộ (bản ghi "đã xoá" để máy khác không gửi lên lại) thuộc `mvp-accounts`; spec này chỉ xoá trên máy.

### 5.4. Quyền riêng tư

Gói đồng bộ chỉ có: mã ngẫu nhiên (`profileId`, `deviceId`), nhóm tuổi, mã hình đại diện, cài đặt, mã màn, sao, ngày học,
số đếm theo từ. Không có biệt danh (CC-3), email, số điện thoại, vị trí, thông tin máy. Có cần phụ huynh đồng ý trước khi gửi
gói của hồ sơ Mầm/Chồi lên máy chủ hay không phụ thuộc **Q-5**; `mvp-accounts` phải xử lý trước khi bật đồng bộ.
Spec này không gửi gì ra mạng.

## 6. Hợp đồng với các trò chơi (`mvp-games`)

```ts
interface LevelResult {
  levelId: string;                         // mã màn, hoặc `review-<DayKey>` cho trận ôn tập
  stars: 1 | 2 | 3;                        // ngưỡng do từng trò quyết (MatchGame.ts:23-27, RainView.vue:57)
  items: { itemId: string; correct: boolean }[];   // correct = đúng ngay lần đầu
  seconds: number;
}
```

- Màn chơi nhận thêm prop `level?: { id: string; items: LearnItem[] }`; có `level` thì chơi đúng các từ đó thay vì lấy ngẫu
  nhiên cả bộ bài, và phát `finished: [LevelResult]` **trước khi** hiện `ResultPanel`.
- `ResultPanel` thêm prop `nextLabel?` và sự kiện `next` (nút "Màn tiếp"), giữ "Chơi lại" và "Về đảo"
  (`ResultPanel.vue:20-21`).
- Spec này sửa `MatchView` / `RainView` hiện có cho đủ hợp đồng; `mvp-games` áp dụng cùng hợp đồng cho trò mới.

## 7. Màn hình

| Màn | Thành phần | Ghi chú |
|---|---|---|
| Chọn hồ sơ | `ProfilePickerView.vue` | Lưới hình đại diện to (≥ 96px), biệt danh dưới hình; Mầm chạm thì đọc biệt danh. Nút "Thêm hồ sơ" (ẩn khi đủ 4) |
| Tạo / sửa hồ sơ | `ProfileFormView.vue` | Bước 1 nhóm tuổi (dùng lại danh sách `ages`, `SettingsView.vue:9-13`), bước 2 hình đại diện, bước 3 biệt danh (tuỳ chọn) |
| Cảnh mở đầu | `IntroView.vue` | Khung hình theo lượt đọc `speaker.say`, phụ đề, nút "Bỏ qua" (CC-7) |
| Trang chủ | `HomeView.vue` | Thêm: chip hồ sơ (đổi hồ sơ), `StreakBadge` (chuỗi, kỷ lục, vé), `MissionCard`, tổng sao mỗi đảo thay cho "n từ" (`HomeView.vue:44`) |
| Bản đồ đảo | `IslandView.vue` | Thay hai nút trò (`IslandView.vue:16-26`) bằng các vùng và nút màn; dọc trên điện thoại (đường đi zigzag), ngang trên máy tính; vùng xong có màu, vùng chưa xong xám nhạt |
| Kết quả | `ResultPanel.vue` | Nút "Màn tiếp" |
| Cài đặt | `SettingsView.vue` | Cài đặt của hồ sơ đang chơi; "Xem lại phim mở đầu"; "Xoá hồ sơ" qua `ParentGate` |
| Cổng phụ huynh | `ParentGate.vue` | Phép cộng / nhân hai chữ số, đọc to câu "Nhờ bố mẹ giúp nhé"; dùng cho CC-18, CC-19 |

Luồng `App.vue`: mở app → (chưa có hồ sơ) tạo hồ sơ → (chưa xem) cảnh mở đầu → trang chủ; (≥ 2 hồ sơ) chọn hồ sơ trước.
Đổi màn vẫn đưa focus về tiêu đề (`App.vue:22-26`).

Trợ năng: nút màn là `<button>` có `aria-label` "Màn 3, 2 trên 3 sao" / "Màn 4, đang khoá"; khoá có biểu tượng 🔒 và nhãn,
không chỉ dựa vào màu; bàn phím đi được qua các nút theo thứ tự vùng.

## 8. Nghe và song ngữ

- Câu mới thêm vào `phrases.ts`: chào hồ sơ, chọn nhóm tuổi, chọn hình, màn đang khoá, màn tiếp, nhiệm vụ hôm nay, xong nhiệm
  vụ, chuỗi ngày, vé nghỉ đã giữ chuỗi, chuỗi về 0 (động viên), nhắc nghỉ, cổng phụ huynh, nhắc giữ tiến độ, hết chỗ lưu, lời
  cảnh mở đầu. Số đọc ghép từ câu có sẵn (ví dụ "Chuỗi" + số) để không phải tạo âm thanh cho mọi con số; số chưa có file thì
  dùng giọng của máy (kịch bản 10.3).
- `collectSpeech` gom thêm tên vùng (`titleVi` đọc tiếng Việt, `titleTarget` đọc bằng ngôn ngữ đảo).
- Biệt danh do người chơi gõ: đọc bằng giọng của máy (kịch bản 10.3), không tạo sẵn.

## 9. Offline

- Mọi file mới (JSON bản đồ, hình đại diện, khung cảnh mở đầu) nằm trong precache (`apps/game/vite.config.ts`, đuôi
  json / png / svg đã có). Thêm đuôi khác (webp) thì thêm vào `globPatterns`.
- Không có lời gọi mạng nào trong spec này.

## 10. Test

| Lớp | Công cụ | Nội dung chính |
|---|---|---|
| `progress/*.ts` | Vitest (node) | `dayKey` qua nửa đêm và đổi giờ; `recordLevel` (sao chỉ tăng, ngày học, đếm theo máy, đánh dấu nhiệm vụ, cắt dữ liệu cũ); `computeStreak` (liên tiếp, trống 1/2/3 ngày với 0/1/2 vé, nhận vé ở ngày 7/14, tối đa 2, hôm nay chưa chơi); `levelStates` (màn đầu, mở lần lượt, mở vùng, chèn màn mới, đổi nhóm tuổi); `makeMission` (tất định, thiếu màn, hồ sơ mới); `mergeProgress` (từng trường + ba tính chất); `migrateProgress` (hỏng, mới hơn, thiếu trường); `validateMap`; mã đã phát hành không mất |
| `apps/game/src/progress/*` | Vitest (jsdom) | kho giả `KeyValueStore`; chuyển `tomo.settings.v1`; khoá `.corrupt`; `QuotaExceededError`; sự kiện `storage` gộp hai tab; `persist()` có / không có / từ chối |
| Màn Vue | Vitest (jsdom), `vi.mock('../audio')` theo `games.test.ts` | chọn / tạo / xoá hồ sơ, cổng phụ huynh, bản đồ (khoá, sao, chơi tiếp), nhiệm vụ, chuỗi, kết quả có "Màn tiếp", câu đọc cho Mầm |
| E2E | Playwright (`desktop` + `phone`) | `progress.spec.ts`: tạo hồ sơ → chơi màn 1 → sao → mở màn 2 → tải lại vẫn còn; hai hồ sơ tách biệt; nhiệm vụ; chuỗi với đồng hồ giả (`page.clock`); `offline.spec.ts` mở rộng: tắt mạng → tạo hồ sơ, chơi, tải lại vẫn còn sao |

Đồng hồ: logic nhận `today`/`now` làm tham số; Vue lấy từ `clock.ts` để test thay được; E2E dùng `page.clock.setFixedTime`.
