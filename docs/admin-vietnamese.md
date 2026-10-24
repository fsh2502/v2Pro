# Tiếng Việt trong trang quản trị main

Bản dịch dựa trên `Max` tại `4af57e9`, áp dụng lên `main` sau bản vá
subscription `92bb9b6`. Chỉ chuyển phần ngôn ngữ quản trị; không đưa các
chức năng nhân viên/CTV riêng của Max sang main.

## Phạm vi

- Bộ từ điển admin gồm 1.357 mục: menu, bảng, bộ lọc, nút, hộp thoại,
  hướng dẫn nhập, thông báo, lịch, phân trang và các cấu hình giao thức.
- Các nhãn tiếng Anh trong VLESS/REALITY, TLS, Trojan, VMess, Shadowsocks,
  TUIC, Hysteria, AnyTLS và V2node dùng bản dịch chung. Tên giao thức,
  thuật toán, SNI, UUID, đường dẫn và các giá trị kỹ thuật vẫn giữ nguyên.
- Trình soạn thảo Markdown dùng nhãn và hộp xác nhận tiếng Việt ngay trong
  gói JavaScript. Định dạng ngày của lịch được đổi thành `DD/MM/YYYY`.
- `Admin` middleware chọn tiếng Việt trong thời gian xử lý yêu cầu rồi
  khôi phục ngôn ngữ trước đó. Exception handler dịch các trường `message`
  và `errors` của phản hồi lỗi admin, gồm cả chuỗi tiếng Trung từ controller
  cũ. Giữ nguyên mã HTTP và tên trường API; không dịch dữ liệu phản hồi
  thành công hay thông tin gỡ lỗi.
- `resources/lang/vi-VN/validation.php` bổ sung thông báo kiểm tra dữ liệu
  và tên trường cho toàn bộ biểu mẫu admin hiện có. Các thông báo tiếng Anh
  dùng chung được lấy từ bộ dịch của Max.
- Bộ dịch DOM xử lý cập nhật của React, `placeholder`, `title`, `alt` và
  `aria-label`. Không sửa thuộc tính `value`, nội dung đang soạn, mã nguồn,
  vùng văn bản Ace hoặc bản xem trước Markdown. Có thể thêm
  `data-no-translate` cho vùng dữ liệu cần giữ nguyên khi mở rộng giao diện.

## Kiểm tra

```sh
node tests/admin-translation-smoke.js
php tests/admin-translation-api.php
node --check public/assets/admin/umi.js
node --check public/assets/admin/components.async.js
```

Kiểm tra API dùng các thành phần Laravel thực, không cần cơ sở dữ liệu:
403/404/422/500, thông báo tùy chỉnh, quy tắc kiểm tra dữ liệu, tham số nội
suy và phạm vi ngôn ngữ. Đã chạy với Laravel 8.83.29 của dòng main và với
Laravel 12 trong môi trường kiểm tra độc lập.

Rà chuỗi JavaScript trong ba gói `umi.js`, `components.async.js` và
`certificate.js`: các chuỗi tiếng Trung dành cho giao diện đều có bản dịch;
hai ngoại lệ là ký tự dùng đo độ rộng chữ và phần neo URL tài liệu. So sánh
token gói mã trước/sau xác nhận chỉ đổi 5 chuỗi ngày/lệnh mẫu trong `umi.js`
và 52 chuỗi ngôn ngữ của trình soạn thảo trong `components.async.js`.

Xem thử bằng dữ liệu giả tại máy cục bộ:

```sh
node tests/admin-translation-preview.js
# Mở http://127.0.0.1:8776/admin-demo
```

Đã kiểm tra các trang chính, 11 thẻ cấu hình hệ thống, hộp thoại VLESS/REALITY,
lịch mã giảm giá và trình soạn thảo hướng dẫn bằng Chrome. Nội dung soạn
thảo và bản xem trước giữ nguyên, kể cả khi trùng từ khóa trong từ điển.
Đây là kiểm tra cục bộ, chưa triển khai lên website đang chạy.

## Cập nhật website đang ở main

Trong thư mục website trên máy chủ:

```sh
git pull --ff-only origin main
php artisan view:clear
```

Sau đó mở lại trang quản trị và nhấn `Ctrl+F5`. View admin đã có phiên bản
URL mới cho các gói ngôn ngữ để tránh dùng lại tài nguyên cũ. Nếu dùng CDN
có lưu đệm HTML, xóa bộ đệm HTML của trang quản trị. Không có migration
hay thay đổi cấu hình giao thức trong bản Việt hóa này.
