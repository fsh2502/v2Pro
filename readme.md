# V2Board

V2Board là hệ thống quản lý dịch vụ proxy đa giao thức. Nhánh này nâng nền tảng lên Laravel 12 và PHP 8.3.30+, hỗ trợ quản lý gói đăng ký, node server, CTV và bảng điều khiển quản trị. Xem [hướng dẫn nâng cấp an toàn](docs/laravel12-upgrade-2026-10-11.md) trước khi chuyển từ website Laravel 8 hiện có.

## Yêu cầu hệ thống

- PHP >= 8.3.30 và Composer 2; cài dependency từ `composer.lock`
- MySQL >= 5.7 hoặc MariaDB >= 10.3
- Redis

## Tính năng

### Hỗ trợ đa giao thức

- VMess
- VLess
- Trojan
- Shadowsocks
- Hysteria
- TUIC
- AnyTLS

### Định dạng đăng ký (20 ứng dụng khách)

Clash, ClashMeta, ClashNyanpasu, ClashVerge, Loon, Passwall, QuantumultX, SagerNet, Shadowrocket, SSRPlus, Stash, Surfboard, Surge, V2rayN, V2rayNG, V2RayTun, INCY, Happ, General, Shadowsocks

### Tích hợp thanh toán

- Alipay F2F (thanh toán trực tiếp)
- Stripe
- Hệ thống cổng thanh toán mở rộng qua `app/Payments/`

### Bảng điều khiển quản trị

- Quản lý người dùng
- Quản lý gói đăng ký
- Quản lý đơn hàng & thanh toán
- Quản lý server & node (đa giao thức)
- Hệ thống mã giảm giá & thẻ quà tặng
- Hệ thống hỗ trợ (ticket)
- Cơ sở kiến thức / tài liệu hướng dẫn
- Thông báo hệ thống
- Thống kê & phân tích
- Cấu hình giao diện
- Quản lý hoa hồng / giới thiệu

### Bảng điều khiển người dùng

- Mua & gia hạn gói đăng ký
- Danh sách server & link đăng ký
- Thống kê lưu lượng sử dụng
- Hệ thống hỗ trợ (ticket)
- Hệ thống giới thiệu / mời bạn bè
- Tích hợp Telegram bot
- Hỗ trợ đa ngôn ngữ

### Tác vụ nền (qua Laravel Horizon)

- Xử lý đơn hàng & tự động hủy
- Thu thập thống kê lưu lượng
- Gửi thông báo qua Email & Telegram
- Tính toán hoa hồng giới thiệu
- Kiểm tra gia hạn đăng ký

## Cài đặt

Đây là luồng cài mới trên database trống. Nếu website đã có dữ liệu, dùng [hướng dẫn nâng cấp](docs/laravel12-upgrade-2026-10-11.md) và bản sao database để kiểm thử trước.

```bash
git clone --branch codex/laravel12-security --single-branch https://github.com/fsh2502/v2Pro.git
cd v2Pro
chmod +x init.sh
./init.sh
```

Hoặc cài đặt thủ công:

```bash
composer validate --strict --no-check-publish
composer audit --locked --no-dev
composer install --no-dev --prefer-dist --optimize-autoloader --no-scripts
composer check-platform-reqs --no-dev
# Chỉnh sửa .env.example cho domain/Redis của site mới.
# Không tạo .env trước: installer tự tạo file này và hỏi thông tin database.
php artisan v2board:install
php artisan migrate --force
php artisan package:discover --ansi
php artisan config:cache
php artisan view:cache
```

## Cấu hình

Chỉnh sửa file `.env`:

```env
DB_HOST=localhost
DB_DATABASE=v2board
DB_USERNAME=root
DB_PASSWORD=mat_khau_cua_ban

REDIS_HOST=127.0.0.1

CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
```

### Khởi chạy Queue Worker

```bash
php artisan horizon
```

Truy cập bảng điều khiển Horizon tại `/monitor`.

## Cập nhật

Chuyển từ Laravel 8 phải dùng [release riêng và database staging](docs/laravel12-upgrade-2026-10-11.md), không chạy script cập nhật trực tiếp trên website chính. Script bên dưới dành cho checkout đã chuyển sang Laravel 12 và đã sao lưu/kiểm thử bản phát hành.

```bash
./update.sh
```

## Các lệnh CLI

| Lệnh | Mô tả |
|-------|--------|
| `php artisan v2board:install` | Chạy cài đặt |
| `php artisan v2board:update` | Chạy cập nhật |
| `php artisan check:order` | Kiểm tra & xử lý đơn hàng |
| `php artisan check:server` | Kiểm tra trạng thái server |
| `php artisan check:commission` | Xử lý hoa hồng giới thiệu |
| `php artisan check:ticket` | Quản lý trạng thái ticket |
| `php artisan check:renewal` | Kiểm tra gia hạn đăng ký |
| `php artisan reset:password` | Đặt lại mật khẩu quản trị |
| `php artisan reset:traffic` | Đặt lại dữ liệu lưu lượng |
| `php artisan reset:log` | Xóa log hệ thống |
| `php artisan send:remindMail` | Gửi email nhắc nhở |

## Công nghệ sử dụng

- **Backend:** Laravel 12 + PHP 8.3.30+
- **Hàng đợi:** Redis + Laravel Horizon
- **Cơ sở dữ liệu:** MySQL
- **Cache/Session:** Redis
- **Thanh toán:** Stripe SDK, Alipay F2F

## Giấy phép

MIT
