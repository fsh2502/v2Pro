# Sửa lỗi parse outbound trên main

Đã đối chiếu main `7f009b006dfddf32110815a24a924c29bb057644` và Max
`57edec929e817914bd67ea2302a9c43737beb87b` ngày 24/10/2026.
Hai nhánh đã có phần xuất riêng cho Hiddify để bỏ TUN/routing của panel và
không tham chiếu DNS `local` ngoài cấu hình. Bản sửa giữ hành vi đó.

## Các lỗi đã tái hiện và sửa

1. Các builder sing-box lấy `port` dạng chuỗi từ database rồi xuất nguyên trạng
   thành `"server_port": "443"`. Core sing-box 1.12.0 từ bản phát hành chính
   thức từ chối với lỗi `outbounds[0].server_port: json: cannot unmarshal string
   into Go value of type uint16`. Cả bộ xuất mới và cũ nay ép cổng đơn thành số.
   Các nhánh Hysteria có danh sách/dải cổng giữ cách xử lý hiện có.
2. Happ có thể được nhận diện thành native sing-box khi User-Agent chứa cả
   tên Happ và core sing-box, hoặc subscription có `flag=singbox`. Controller
   nay ưu tiên nhận diện Happ như cách đã làm với Hiddify. Tài khoản Happ hết
   hạn cũng được chọn đúng renderer. Sửa thêm phép so sánh `strpos` để chuỗi
   `sing` ở vị trí 0 không bị coi là không xuất hiện.
3. File sing-box lấy từ workspace Staff/Max có tham chiếu tới
   `SubscriptionNameService`, trong khi main không có lớp này. Hai bộ xuất
   nay dùng tên website khi thiếu lớp tùy chọn, giữ tên riêng khi lớp tồn tại.

Thông báo người dùng cung cấp là `unknown parse outbound`; chưa có đầy đủ
dòng lỗi và phiên bản ứng dụng để xác nhận trường hợp nào xảy ra trên thiết bị.
Các lỗi nêu trên được tái hiện độc lập từ mã và cấu hình xuất.

## Triển khai

Sao lưu rồi cập nhật bốn file đúng đường dẫn trong thư mục chứa `artisan`:

```text
app/Http/Controllers/V1/Client/ClientController.php
app/Protocols/Hiddify.php
app/Protocols/Singbox/Singbox.php
app/Protocols/Singbox/SingboxOld.php
```

`Hiddify.php` được kèm để đồng bộ adapter trên website có mã cũ. Không cần
migration, thay database hoặc cài dependency mới. Reload PHP của website,
cập nhật subscription trong ứng dụng rồi ngắt/kết nối lại.
Các file Happ/NodeAddressResolver đã cập nhật trước đó tiếp tục được sử dụng.

## Kiểm tra

```sh
php tests/client-protocol-dispatch.php
php tests/singbox-outbound-types.php
php tests/certificate-smoke.php
php tests/happ-domain-address.php
php tests/happ-subscription-response.php
```

Test outbound dùng cổng dạng chuỗi giống dữ liệu database và kiểm tra cả
native sing-box mới/cũ lẫn Hiddify, đồng thời gọi đầy đủ renderer khi thiếu
lớp đặt tên của Staff/Max. Test điều phối mô phỏng các tổ hợp flag/User-Agent.

Cấu hình proxy xuất cho ba trường hợp đã được kiểm tra bằng lệnh
`sing-box check` với core chính thức 1.12.0. Phép kiểm tra bỏ TUN và remote
rule-set của cấu hình standalone để không thay đổi mạng hoặc tải rule-set;
nó xác nhận schema và việc khởi tạo outbound, không xác nhận kết nối thật.

Nguồn schema: https://sing-box.sagernet.org/configuration/outbound/vless/
Core kiểm tra: https://github.com/SagerNet/sing-box/releases/tag/v1.12.0
