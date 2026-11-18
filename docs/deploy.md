# Triển khai (deploy)

> Đã chốt (Q-29, 2026-11-18): máy chủ là **một máy ảo Ubuntu trên cloud**, mọi thứ chạy bằng **Docker / Docker Compose**.
> Docker dùng cả khi phát triển. Nhà cung cấp cloud, tên miền, cỡ máy và các chi tiết khác đang ở mục "Chờ chốt" của spec
> [mvp-tai-khoan](../.kiro/specs/mvp-tai-khoan/requirements.md) — đánh dấu **(chờ chốt)** dưới đây.
>
> Hiện tại (giai đoạn 0) **chưa có máy chủ**: game là web tĩnh chạy offline. Các file Docker (`apps/server/Dockerfile`,
> `docker-compose.yml`, `docker-compose.prod.yml`, `.env.prod.example`) sẽ được tạo trong spec `mvp-tai-khoan`; tài liệu
> này viết trước các bước, cập nhật khi các file đó có thật. Chưa chạy thử thật trên máy chủ.

## 1. Thành phần

| Thành phần | Chạy bằng | Đặt ở đâu |
|---|---|---|
| Game (PWA, file tĩnh `apps/game/dist`) | Container web tĩnh / reverse proxy | Cùng máy ảo **(chờ chốt)** |
| Máy chủ NestJS (`apps/server`): tài khoản, đồng bộ tiến độ, đơn hàng, webhook SePay, xác minh Google Play | Container `server` | Máy ảo |
| PostgreSQL | Container `db`, dữ liệu trong volume | Máy ảo, **không mở cổng ra ngoài** |
| Sao lưu PostgreSQL | Container `backup` | Máy ảo + chép ra ngoài |
| Trang quản trị (`apps/admin`, spec `mvp-mua-ban`) | File tĩnh qua reverse proxy | Máy ảo, đường dẫn / tên miền riêng **(chờ chốt)** |
| Cấu hình quảng cáo từ xa (`ads-config.json`, spec `mvp-quang-cao`) | File tĩnh | Cùng tên miền với game |
| Âm thanh tạo sẵn | Tạo trên máy nhóm bằng `tools/tts`, đóng gói vào `apps/game/dist` | Cùng game |

Game vẫn chơi được khi máy chủ không chạy (offline-first); máy chủ chỉ cần cho đăng nhập, mua, đồng bộ.

## 2. Môi trường phát triển (Docker)

Theo cách của medicine-management: mọi dịch vụ chạy trong container, lệnh test chạy trong container.

```bash
docker compose up -d                       # server + db (+ game dev server) — file tạo trong spec mvp-tai-khoan
docker compose exec -T server pnpm test    # test máy chủ trong container (lệnh chính xác ghi khi có code)
docker compose logs -f server
docker compose down                        # dừng (KHÔNG dùng -v: xoá volume là mất dữ liệu)
```

Phần game hiện tại (giai đoạn 0) vẫn chạy được trực tiếp bằng Node 22 (`pnpm dev`, `pnpm test`) như trong `README.md`.

## 3. Máy ảo Ubuntu

### 3.1 Tạo máy ảo
- Nhà cung cấp, vùng, cỡ máy: **(chờ chốt)**. Gợi ý tối thiểu cho MVP: 1–2 vCPU, 2 GB RAM, 20 GB ổ đĩa, Ubuntu 24.04 LTS.
- Mở cổng **22** (SSH, chỉ IP của mình nếu được), **80**, **443**. Không mở cổng PostgreSQL.
- Đăng nhập bằng khoá SSH, tắt đăng nhập mật khẩu.

### 3.2 Cài Docker và tường lửa

```bash
ssh -i <private-key> ubuntu@<PUBLIC_IP>

sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker

sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
```

Một số image Ubuntu của nhà cung cấp (ví dụ Oracle) chặn cổng bằng `iptables` riêng: khi đó mở thêm theo
[docs/deploy.md của medicine-management](../../medicine-management/docs/deploy.md) mục 4.2.

### 3.3 Tên miền
Trỏ bản ghi A của tên miền về Public IP của máy ảo. Tên miền: **(chờ chốt)** — miễn phí (DuckDNS) cho thử nghiệm, nên mua
tên miền riêng trước khi phát hành vì **dữ liệu PWA (tiến độ khách) gắn với tên miền**: đổi tên miền là người chơi mất tiến
độ chưa đăng nhập.

## 4. Chạy lần đầu

```bash
git clone https://github.com/hoangtrungthong/study-gaming.git && cd study-gaming
cp .env.prod.example .env.prod             # điền giá trị (danh sách khoá ở spec mvp-tai-khoan); KHÔNG commit .env.prod
P="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$P build
$P up -d
$P exec server <lệnh migrate>              # ghi chính xác khi có code
$P exec server <lệnh tạo quản trị viên>    # users.role='admin' qua CLI (spec mvp-mua-ban CC-19)
```

Bí mật (khoá Resend, Google OAuth client, khoá SePay, tài khoản dịch vụ Google Play, mật khẩu DB) chỉ nằm trong `.env.prod`
trên máy ảo hoặc GitHub Secrets. Không bao giờ commit.

## 5. HTTPS

Reverse proxy tự lấy chứng chỉ Let's Encrypt: Caddy hoặc nginx **(chờ chốt, đề xuất Caddy như medicine-management)**.
Ví dụ Caddy:

```
game.ten-mien.vn {
    root * /srv/game
    file_server
    handle /api/* {
        reverse_proxy server:3000
    }
}
```

Service worker của PWA chỉ chạy trên HTTPS: phải có chứng chỉ trước khi người chơi cài game.

## 6. Cập nhật

```bash
cd ~/study-gaming && git pull
$P build && $P up -d && $P exec server <lệnh migrate>
```

Tự động bằng GitHub Actions (SSH vào máy ảo sau khi CI xanh trên `main`): **(chờ chốt)**, làm sau MVP nếu chưa cần.
Bản game mới: người chơi thấy banner "Đã có bản mới" và bấm Tải lại (`apps/game/src/pwa.ts`).

## 7. Sao lưu và giám sát

- Container `backup` dump PostgreSQL định kỳ (mặc định mỗi 24 giờ, giữ 14 bản) vào volume `backups` — theo mẫu
  `docker/backup/backup.sh` của medicine-management.
- **Bản sao lưu nằm cùng máy với DB nên không cứu được khi mất máy:** chép ra ngoài định kỳ (nơi chép: **(chờ chốt)**).
- Endpoint `GET /api/health` (trả 200 khi DB trả lời) cho dịch vụ kiểm tra bên ngoài (ví dụ UptimeRobot).
- Không log email, mã OTP, token, nội dung chuyển khoản (AGENTS.md mục 2).

## 8. Liên kết

- Webhook SePay trỏ về `https://<tên-miền>/api/...` (spec `mvp-mua-ban`).
- Google OAuth: thêm origin của game vào "Authorized JavaScript origins" (spec `mvp-tai-khoan`).
- App Android gọi API bằng `VITE_WEB_ORIGIN` (spec `mvp-android`).
