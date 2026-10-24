# Phân giải domain và outbound subscription trên Max

Bản vá ngày 24/10/2026, dựa trên Max
`57edec929e817914bd67ea2302a9c43737beb87b`, chuyển phần sửa kết nối từ main
`92bb9b6ba44d4ddf590b174ec8a3ccaef59a6c47` sang Max.

## Hành vi

Khi tạo subscription cho Happ, panel phân giải domain của node thành IP để
thiết bị không cần phân giải địa chỉ node trước khi tunnel hoạt động. Domain
vẫn được lưu trong panel. Áp dụng cho các nhánh xuất hiện có: VLESS/REALITY,
VLESS/TLS và không TLS, VMess, Trojan/TLS, Shadowsocks, Hysteria2 (cả cấu trúc
cũ với `version=2`) và AnyTLS. Không bổ sung giao thức mới vào ứng dụng Happ.

- Giữ SNI/REALITY target, Public Key, ShortId, flow, fingerprint và các thông
  số xác thực. Không đổi SNI thành IP đã phân giải.
- TLS thường thiếu SNI sẽ giữ domain gốc làm SNI để xác minh chứng chỉ;
  giữ tên xác minh certificate pin.
- WS/HTTPUpgrade/XHTTP thiếu HTTP Host sẽ giữ domain gốc làm Host; Host cấu
  hình riêng được giữ nguyên.
- Ưu tiên IPv4, dự phòng AAAA, cache kết quả DNS thành công 60 giây.
  DNS lỗi sẽ giữ domain gốc; cache lỗi vẫn dùng kết quả DNS vừa phân giải.
- Giữ địa chỉ gốc khi REALITY thiếu SNI, TLS cố ý không gửi SNI, hoặc có
  `app_resolve_address` riêng.
- Giữ cách đặt tên Staff/CTV, header Base64 và giới hạn tên theo cụm emoji
  của Max. Không thay bằng cách xử lý tên của main.

Controller ưu tiên tên ứng dụng Happ khi nhận diện User-Agent có cả Happ
và core sing-box. Tài khoản hết hạn cũng được chọn đúng định dạng. Bộ xuất
sing-box mới/cũ chuyển cổng đơn từ chuỗi database sang số trong JSON, tránh
lỗi parse `server_port`. Hiddify tiếp tục nhận proxy-only JSON, không nhận
TUN/routing hoặc tham chiếu DNS `local` của panel.

## Tùy chọn và cập nhật

Các tùy chọn thủ công trong `config/v2board.php`:

- `'happ_domain_resolve_enable' => 0`: tắt phân giải cho toàn bộ định dạng Happ.
- `'happ_reality_resolve_enable' => 0`: chỉ tắt cho REALITY.

Nếu thay tùy chọn, chạy `php artisan config:cache` theo quy trình triển khai.
Khi IP của domain thay đổi, cấu hình mới dùng kết quả mới sau khi cache hết
hạn; thiết bị đã nhập cấu hình cần cập nhật subscription.

Bản vá này không thay database hoặc dependency. Triển khai commit trên Max,
reload PHP đang chạy website rồi cập nhật subscription trong ứng dụng.

## Kiểm chứng

- Test hồi quy mới tái hiện việc VLESS/REALITY trên Max chưa vá xuất nguyên
  domain thay vì địa chỉ IP dùng để quay số.
- Các test độc lập kiểm tra mọi builder được sửa, SNI, HTTP Host, pin chứng
  chỉ, cache/DNS lỗi, IPv6, nhận diện Happ và kiểu cổng outbound.
- Kiểm tra Laravel thật qua `IosGlassSubscriptionTest` và
  `StaffOwnershipTest`: 71 test, 1.002 assertions. Có test mới gọi đầy đủ
  `Happ::handle()` với cache Laravel và khách thuộc Staff, kiểm tra cả tên
  Unicode và các giao thức.
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
