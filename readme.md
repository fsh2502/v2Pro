# V2Board

V2Board là hệ thống quản lý dịch vụ proxy đa giao thức, được xây dựng trên nền tảng Laravel 8. Hỗ trợ quản lý gói đăng ký, quản lý node server đa giao thức và bảng điều khiển quản trị toàn diện.

## Yêu cầu hệ thống

- PHP >= 7.3
- Composer
- MySQL >= 5.5
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

### Định dạng đăng ký (19 ứng dụng khách)

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

```bash
git clone [https://github.com/your-repo/v2board.git](https://github.com/fsh2502/v2Pro.git)
cd v2board
chmod +x init.sh
./init.sh
```

Hoặc cài đặt thủ công:

```bash
composer install
cp .env.example .env
php artisan key:generate
# Chỉnh sửa file .env để cấu hình database và Redis
php artisan v2board:install
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

- **Backend:** Laravel 8 + PHP
- **Hàng đợi:** Redis + Laravel Horizon
- **Cơ sở dữ liệu:** MySQL
- **Cache/Session:** Redis
- **Thanh toán:** Stripe SDK, Alipay F2F

## Giấy phép

MIT
