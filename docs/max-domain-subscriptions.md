# Địa chỉ domain và outbound subscription trên Max

Bản cập nhật 26/10/2026 chuyển hành vi giữ domain từ main `7cc1b55`
sang Max. Bản vá IP/DNS tùy chọn trước đó nằm ở `4af57e9` ngày 24/10/2026.

## Hành vi

Khi tạo subscription cho Happ, mặc định panel xuất đúng domain đã cấu hình
trong trường `host`, không đổi thành IP dù đã có kết quả DNS trong cache.
Ví dụ: `vless://…@node.example.com:443?...`; VMess dùng domain trong trường
`add`. Nếu quản trị viên nhập IP thì vẫn xuất IP. Áp dụng cho VLESS/REALITY,
VLESS/TLS và không TLS, VMess, Trojan/TLS, Shadowsocks, Hysteria2 (cả cấu trúc
cũ với `version=2`) và AnyTLS. Không bổ sung giao thức mới vào ứng dụng Happ.

- Giữ SNI/REALITY target, Public Key, ShortId, flow, fingerprint và các thông
  số xác thực. SNI không bị ghi đè bằng domain kết nối.
- Giữ certificate pin và HTTP Host cấu hình riêng. Khi để trống SNI/Host,
  chế độ domain giữ giá trị trống để ứng dụng dùng địa chỉ domain gốc.
- Giữ cách đặt tên Staff/CTV, header Base64 và giới hạn tên theo cụm emoji
  của Max. Không thay bằng cách xử lý tên của main.
- Các định dạng sing-box/Hiddify và client khác vốn xuất `host` gốc.

Nếu bật riêng chế độ IP, panel dùng DNS hệ thống, ưu tiên IPv4, dự phòng
AAAA và cache kết quả thành công 60 giây. Trước khi thay địa chỉ, TLS thường
thiếu SNI và WS/HTTPUpgrade/XHTTP thiếu Host được điền domain gốc để giữ
xác minh chứng chỉ và định tuyến HTTP. DNS lỗi giữ domain; cache lỗi vẫn
thử DNS. REALITY thiếu SNI, TLS cố ý không gửi SNI hoặc cấu hình có
`app_resolve_address` riêng không bị thay địa chỉ.

Controller ưu tiên tên ứng dụng Happ khi nhận diện User-Agent có cả Happ
và core sing-box. Tài khoản hết hạn cũng được chọn đúng định dạng. Bộ xuất
sing-box mới/cũ chuyển cổng đơn từ chuỗi database sang số trong JSON, tránh
lỗi parse `server_port`. Hiddify tiếp tục nhận proxy-only JSON, không nhận
TUN/routing hoặc tham chiếu DNS `local` của panel.

## Tùy chọn và cập nhật

Các tùy chọn thủ công trong `config/v2board.php`:

- `'happ_domain_resolve_enable' => 0`: giữ domain, hiện là mặc định.
- `'happ_domain_resolve_enable' => 1`: bật lại cách xuất IP của bản vá cũ
  để xử lý thiết bị không phân giải được DNS.
- `'happ_reality_resolve_enable' => 0`: chỉ tắt thay IP cho REALITY khi chế
  độ IP ở trên đang bật.

Nếu từng tự đặt `happ_domain_resolve_enable` thành `1`, đổi về `0` để dùng
domain. Sau đó chạy `php artisan config:cache` theo quy trình triển khai.
Trong chế độ domain, ứng dụng/thiết bị phân giải DNS khi kết nối.

Bản vá này không thay database hoặc dependency. Triển khai commit trên Max,
reload PHP đang chạy website rồi cập nhật subscription trong ứng dụng.

```sh
git pull --ff-only origin Max
php artisan config:cache
```

## Kiểm chứng

- Test hồi quy xác nhận mặc định các builder giữ domain, không dùng IP đã
  cache và không gọi DNS của panel; chế độ IP bật riêng vẫn hoạt động.
- Các test độc lập kiểm tra mọi builder được sửa, SNI, HTTP Host, pin chứng
  chỉ, cache/DNS lỗi, IPv6, nhận diện Happ và kiểu cổng outbound.
- Kiểm tra Laravel thật qua `IosGlassSubscriptionTest` và
  `StaffOwnershipTest`: 72 test, 1.032 assertions. Các test gọi đầy đủ
  `Happ::handle()` ở cả chế độ domain và IP, với cache Laravel và khách thuộc
  Staff, kiểm tra tên Unicode, Base64 header, SNI/khóa REALITY và HTTP Host.
- Dependencies dùng khi kiểm tra có cùng phiên bản với toàn bộ 122 package
  trong `composer.lock` của Max; database kiểm tra là SQLite trong bộ nhớ.
- Ba cấu hình outbound mới/cũ/Hiddify đều qua `sing-box check` với core
  chính thức 1.12.0. Phép thử này kiểm tra schema/khởi tạo outbound, không
  thiết lập TUN hoặc kết nối tới node thật.

Chạy test độc lập:

```sh
php tests/happ-domain-address.php
php tests/client-protocol-dispatch.php
php tests/singbox-outbound-types.php
php tests/certificate-smoke.php
```

Chạy test Laravel với dependencies của Max:

```sh
php vendor/bin/phpunit -c phpunit.isolated.xml --filter 'IosGlassSubscriptionTest|StaffOwnershipTest'
```
