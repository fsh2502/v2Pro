# Rà soát tiếng Việt trên website đang chạy — 09/10/2026

Đã kiểm tra trực tiếp bằng trình duyệt tại `shoptuantruong.cc`, gồm panel Admin, trang Staff và giao diện khách hàng mặc định. Website đang tải tài nguyên phiên bản `1.7.5.2685.2226`. Các lỗi tìm thấy đã được sửa trong mã nguồn; bản sửa dùng phiên bản tài nguyên `1.7.5.2685.2227` và cần cập nhật trên VPS để có hiệu lực.

## Phạm vi thực tế

Đã ghi nhận 100 lượt đọc trang/biểu mẫu/menu trên website thật, không phải 100 chức năng độc lập:

- Admin: dashboard, danh sách người dùng, bộ lọc, chỉnh sửa khách mẫu và lịch ngày; 11 thẻ cấu hình hệ thống; thanh toán và giao diện; máy chủ và các biểu mẫu giao thức; nhóm máy chủ, định tuyến, gói chính, đơn hàng, mã giảm giá, thẻ quà tặng, thông báo, hướng dẫn và hỗ trợ.
- Quản lý CTV: danh sách, cài đặt, cấp khách hàng, lịch sử, danh mục gói riêng và biểu mẫu chỉnh sửa gói.
- Staff: danh sách khách hàng, menu thao tác, chỉnh sửa, cá nhân hóa và lịch sử thao tác.
- Khách hàng mẫu: đăng nhập, trang chủ, hồ sơ, hộp nạp tiền, chọn ngôn ngữ, mua gói và biểu mẫu đơn hàng, trạng thái node, đơn hàng, lời mời, dung lượng, tài liệu và biểu mẫu ticket/chuyển hoa hồng/rút hoa hồng.
- Horizon: bảng trạng thái hàng đợi hiển thị; phiên Admin vẫn ở dashboard sau khi đăng nhập lại.

Chỉ xem dữ liệu và mở/đóng biểu mẫu. Không lưu cấu hình, đổi mật khẩu, đặt lại thông tin gói, đổi thẻ, thanh toán, gửi ticket/email/Telegram hoặc thay đổi dữ liệu thật trong đợt rà soát này. Phiên khách hàng mẫu đã đăng xuất và phiên Admin đã được khôi phục.

## Những lỗi tìm thấy và cách sửa

| Vị trí | Hiển thị trước sửa | Kết quả sửa |
| --- | --- | --- |
| Phân trang, bộ lọc | `上一页`, `下一页`, `筛选`, `10 条/页` | Trang trước, Trang sau, Bộ lọc, 10 / trang |
| Ô ghi chú và nội dung | Gợi ý tiếng Trung trong textarea | Dịch thuộc tính gợi ý; giữ nguyên giá trị người dùng nhập |
| Cấu hình website/nạp tiền/hoa hồng | Gợi ý URL, số tiền và phương thức rút còn tiếng Trung | Gợi ý tiếng Việt, giữ nguyên ví dụ và định dạng cấu hình |
| Lịch ngày | `清除`, `2026年`, tiêu đề ngày tiếng Trung | Xóa lựa chọn, Năm 2026, ngày/tháng/năm |
| Định tuyến | `匹配 1 条规则`, ví dụ tên miền tiếng Trung | Khớp 1 quy tắc, ví dụ với chú thích tiếng Việt |
| Giao diện | `配置…主题` | Cài đặt giao diện … |
| Thẻ quà tặng | `1 天` | 1 ngày |
| Hồ sơ khách hàng | `请输入充值金额CNY` | Nhập số tiền nạp (CNY), có hỗ trợ tiền tệ khác |
| Lời mời | Đơn vị `人` | người |
| Menu ngôn ngữ | Tên ngôn ngữ Trung/Nhật theo tên bản địa | Tên ngôn ngữ bằng tiếng Việt khi dùng giao diện tiếng Việt |

Chỉnh lại các bản dịch không phù hợp: hệ số lưu lượng, thuật toán mã hóa, bảo mật, loại hoa hồng giới thiệu, hoa hồng định kỳ/lần đầu, Đổi quà và Đặt lại thông tin gói. Cảnh báo đặt lại nói rõ URL và UUID sẽ thay đổi, cần nhập lại cấu hình trong ứng dụng.

Trong quá trình xác nhận preview còn tìm thấy tooltip chọn thập kỷ/thế kỷ chưa dịch; đã bổ sung. Rà soát mã của nhánh thông báo đổi thẻ quà tặng phát hiện chuỗi tiếng Trung trực tiếp, đã chuyển sang hệ thống bản dịch cho cả năm loại thẻ và trường hợp loại không xác định. Nhánh thành công đổi thẻ được kiểm tra giả lập, không đổi thẻ trên website thật.

Nguyên nhân chính của textarea: bộ dịch bỏ qua toàn bộ phần tử, bao gồm cả `placeholder`. Bản sửa dịch các thuộc tính giao diện trước khi bỏ qua nội dung chỉnh sửa. Những nhãn có ngày/số lượng được dịch bằng mẫu giới hạn trong đúng widget Ant Design, tránh áp dụng quy tắc động lên toàn trang.

## Xác nhận bản sửa

Preview local sử dụng tài nguyên Admin và giao diện khách hàng thật trong repo, với dữ liệu giả lập, không kết nối cơ sở dữ liệu hay dịch vụ của VPS. Đã xác nhận trên trình duyệt: biểu mẫu định tuyến, gợi ý textarea, chỉnh sửa người dùng, lịch ngày/năm/thập kỷ, phân trang và lựa chọn số hàng, hộp nạp tiền và menu ngôn ngữ hiển thị tiếng Việt. Đây là xác nhận local sau sửa, không phải kết quả sau triển khai lên VPS.

Kiểm tra tự động đều đạt:

- `node tests/translation-smoke.js`: 829 mục Admin, 271 mục khách hàng; không còn ký tự Trung trong giá trị bản dịch; bảo toàn tham số nội suy và nội dung nhập; nhãn động, ngôn ngữ dự phòng, nạp tiền CNY/VND/USD, mọi nhánh thông báo đổi thẻ.
- `node --check public/assets/admin/v2b-mod.js` và `node --check public/theme/default/assets/umi.js`.
- `node tests/admin-session-smoke.js`.
- `node tests/ctv-admin-ui-smoke.js`.
- `node tests/staff-plan-admin-ui-smoke.js`.
- `node tests/staff-ui-smoke.js`.

Bằng chứng local lưu trong `artifacts/qa-translation-route-after-20261009.png` và `artifacts/qa-translation-recharge-after-20261009.png`. Kết quả đọc UI được lưu riêng tại `artifacts/live-translation-audit-20261009.json`, phân biệt các mục `LOCAL SAU SỬA` với website thật. Các artifact này không đưa lên GitHub.

Không khẳng định mọi thông báo lỗi hiếm gặp của backend, nội dung do người dùng nhập hoặc giao diện tích hợp bên thứ ba đều được kiểm tra hết. Những nhánh cần gửi thông báo/giao dịch thật chưa được kích hoạt.

## Cập nhật VPS

```bash
cd /www/wwwroot/v2pro-test
git pull --ff-only origin test/ctv-20261008
php artisan config:cache
php artisan view:clear
```

Sau đó tải lại bằng Ctrl+F5. Không cần migration hay cập nhật Composer cho bản sửa này. Kiểm tra tài nguyên tải từ trình duyệt có phiên bản `1.7.5.2685.2227` trước khi xác nhận kết quả trên website thật.
