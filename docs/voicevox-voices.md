# Giọng VOICEVOX dùng trong game

Tra cứu ngày 2026-11-17. Điều khoản có thể đổi: kiểm lại trước mỗi lần phát hành.

## Điều khoản chung của VOICEVOX

Nguồn: <https://voicevox.hiroshiba.jp/term/>

- Dùng được cho cả mục đích thương mại và phi thương mại.
- **Bắt buộc ghi công** cho biết đã dùng VOICEVOX.
- Âm thanh tạo ra phải theo **điều khoản riêng của từng giọng** (do nhóm sở hữu nhân vật đặt).

## Giọng đã kiểm điều khoản

| Giọng | Nhóm sở hữu | Thương mại | Ghi công bắt buộc | Lưu ý | Dùng? |
|---|---|---|---|---|---|
| ずんだもん | Dự án Tohoku Zunko ([điều khoản](https://zunko.jp/con_ongen_kiyaku.html)) | Được, miễn phí khi có ghi công | `VOICEVOX:ずんだもん`, với app đặt ở màn giới thiệu | Cấm: chính trị/tôn giáo, "information product", nội dung sai sự thật, ngành giải trí người lớn | **Có** (giọng trẻ, hợp nhóm Mầm/Chồi) |
| 四国めたん | Dự án Tohoku Zunko (cùng điều khoản trên) | Như trên | `VOICEVOX:四国めたん` | Như trên | **Có** (giọng nữ, đọc ví dụ) |
| 九州そら | Dự án Tohoku Zunko (cùng điều khoản trên) | Như trên | `VOICEVOX:九州そら` | Như trên | Dự phòng |
| 玄野武宏 | VirVox Project ([điều khoản](https://virvoxproject.wixsite.com/official/voicevoxの利用規約)) | Được | `VOICEVOX:玄野武宏` (ví dụ của điều khoản ghi kèm tên diễn viên lồng tiếng) | Cấm dùng âm thanh để huấn luyện mô hình giọng mới; bỏ ghi công phải xin phép | **Có** (giọng nam, hợp ông Haru) |
| 白上虎太郎 | VirVox Project (cùng điều khoản trên) | Được | `VOICEVOX:白上虎太郎` | Như trên | Dự phòng |
| 青山龍星 | VirVox Project | Được, nhưng **doanh nghiệp/cá nhân kinh doanh phải đăng ký trước** với ななはぴ; không được bỏ ghi công | `VOICEVOX:青山龍星` | Thủ tục đăng ký | **Không** |

Chưa kiểm (điều khoản nằm ở trang riêng của nhóm sở hữu, chưa đọc): 春日部つむぎ, 冥鳴ひまり, もち子さん, No.7 và các giọng còn lại.

## Cách ghi công trong game

- Màn **Cài đặt → Ghi công giọng đọc** liệt kê dòng `credit` của mọi giọng đang có trong `audio/manifest.json`.
- Thêm dòng ghi công vào phần mô tả trên Google Play / App Store và trang giới thiệu của bản web.
- Không dùng âm thanh tạo ra để huấn luyện mô hình giọng khác (điều khoản VirVox).
