# Địa chỉ domain trong các định dạng xuất cho Happ

Đối chiếu ngày 24/10/2026:

- `main`: `7f009b006dfddf32110815a24a924c29bb057644`.
- `Max`: `57edec929e817914bd67ea2302a9c43737beb87b`.

Hai nhánh xuất địa chỉ kết nối và các tham số VLESS/REALITY giống nhau.
Các khác biệt trong `Happ.php` chủ yếu liên quan tới tên subscription.
Không tìm thấy một bản sửa kết nối domain có sẵn ở `Max` để sao chép.

## Cách xử lý

Trước thay đổi, Happ nhận domain nguyên trạng và cần phân giải địa chỉ trên
thiết bị trước khi kết nối. Nếu bước này thất bại, đổi cùng cấu hình sang IP
có thể chạy được dù SNI và các khóa REALITY vẫn đúng.

Các builder trong `Happ.php` dùng chung `prepareServerAddress()` và
`NodeAddressResolver` để phân giải địa chỉ trên panel. Áp dụng cho VLESS
(REALITY, TLS hoặc không TLS), Trojan/TLS, VMess, Shadowsocks, Hysteria2
(cả cấu trúc cũ có `version=2`) và nhánh xuất AnyTLS hiện có.
Không bổ sung hỗ trợ giao thức mới cho ứng dụng Happ; các nhánh đang bỏ qua
TUIC/Hysteria v1 vẫn giữ nguyên.

Domain vẫn được lưu trong panel; chỉ địa chỉ quay số trong liên kết xuất cho
Happ được thay bằng IP. SNI không được suy ra từ địa chỉ IP này.

- Ưu tiên IPv4, dùng IPv6 nếu chỉ tìm được AAAA; URI IPv6 có dấu ngoặc vuông.
- Dùng DNS hệ thống của panel, theo CNAME cho IPv4 và cache kết quả thành công
  trong 60 giây. Thay đổi DNS có hiệu lực trên các lần lấy subscription sau
  khi cache hết hạn; cấu hình đã nhập trong Happ cần được cập nhật lại.
- DNS lỗi thì giữ domain gốc, không cache thất bại và không làm hỏng các node khác.
- Cache lỗi thì vẫn thử DNS và dùng kết quả vừa phân giải được.
- Giữ nguyên SNI, Public Key, ShortId, fingerprint, flow và transport.
- TLS thường để trống SNI: điền domain kết nối gốc vào SNI trước khi đổi
  địa chỉ thành IP, giữ tên xác minh chứng chỉ và certificate pin.
- WebSocket/HTTPUpgrade/XHTTP để trống HTTP Host: giữ domain kết nối gốc
  làm Host; nếu có Host riêng thì giữ giá trị đó.
- Không áp dụng cho client khác hoặc cấu hình có `app_resolve_address` riêng.
  REALITY thiếu SNI và cấu hình TLS cố ý không gửi SNI (`disable_sni=1`,
  SNI trống) vẫn giữ địa chỉ gốc.

Có thể đặt `'happ_domain_resolve_enable' => 0` trong `config/v2board.php` để
tắt phân giải cho toàn bộ định dạng Happ. Tùy chọn cũ
`'happ_reality_resolve_enable' => 0` chỉ tắt cho REALITY, vẫn được giữ để
tương thích. Đây là các tùy chọn cấu hình thủ công, không phải mục mới trong
giao diện admin. Nếu thay đổi cấu hình, chạy `php artisan config:cache` theo
quy trình triển khai hiện tại.

Không cần migration database hoặc thay cấu hình node. Sau khi triển khai,
cập nhật subscription trong Happ rồi ngắt/kết nối lại.

## Triển khai trên main và lỗi HTTP 500

Upload `app/Services/NodeAddressResolver.php` trước, sau đó ghi đè
`app/Protocols/Happ.php` bằng bản mới nhất và reload PHP đang chạy website.
Không cần chép `SubscriptionNameService.php` từ bản Staff/Max sang main.

Bản `Happ.php` đầu tiên lấy trực tiếp từ workspace có phụ thuộc vào
`SubscriptionNameService`, trong khi main không có lớp đó. Chỉ upload hai
file theo hướng dẫn cũ có thể gây HTTP 500 với lỗi
`Class "App\Services\SubscriptionNameService" not found`.
Đã tái hiện bằng phép thử gọi đầy đủ `Happ::handle()` không có lớp tùy chọn.

Bản sửa kiểm tra lớp trước khi dùng: nếu có thì giữ tên riêng Staff/CTV;
nếu không có thì dùng `v2board.app_name`. Website đã upload bản cũ chỉ cần
ghi đè `Happ.php` mới và reload PHP; giữ nguyên resolver đang hoạt động.

## Kiểm chứng

```sh
php tests/happ-domain-address.php
php tests/happ-subscription-response.php
php tests/tls_pin_regression.php
php tests/subscription-announce-smoke.php
```

Kiểm tra đầu dùng DNS/cache giả lập để xác nhận các định dạng xuất giữ tham số
REALITY, SNI, tên xác minh chứng chỉ, certificate pin và HTTP Host khi phân giải
domain thành IP. Nó cũng kiểm tra IPv6, hết hạn cache, DNS lỗi, cache lỗi, các
tùy chọn tắt và việc giữ nguyên client khác. Nó kiểm tra hành vi của exporter,
không tái hiện lỗi DNS trên một phiên Happ thực tế.
Phép thử `happ-subscription-response.php` cần extension `mbstring`, kiểm tra
đầy đủ phản hồi subscription và subscription hết hạn khi thiếu lớp đặt tên
tùy chọn, đồng thời kiểm tra tên riêng khi lớp đó tồn tại.

Tài liệu Happ mô tả cơ chế phân giải domain trước khi kết nối bằng các header
`server-address-resolve-*`, thuộc nhóm tham số cần Provider ID. Bản sửa này
phân giải trên panel nên không phụ thuộc tính năng đó:
https://www.happ.su/main/dev-docs/app-management#domain-resolving

Vẫn cần xác nhận kết nối thực tế trong Happ sau khi người dùng cập nhật
subscription; kiểm tra mã nguồn không thay thế phép thử trên thiết bị đó.
