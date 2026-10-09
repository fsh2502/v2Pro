# Rà soát Horizon và sửa bản dịch — 09/10/2026

## Horizon

Bản xác thực ở commit `7f6130bf` được rà soát lại. Không cần thay thêm code Horizon trong đợt này; bổ sung kiểm thử để bảo vệ bản sửa khi cập nhật về sau.

- 7 bài tập trung vào Horizon, 132 xác nhận: Admin JWT không có Laravel guard; production/local/staging; token truyền qua header hoặc auth_data; cache chưa có/đã có; Staff và khách bị từ chối; khóa/thu hồi Admin; xóa Admin; thu hồi một phiên vẫn giữ phiên khác; token hết hạn, sai chữ ký, không có phiên và giả mạo dữ liệu user bị từ chối.
- Toàn bộ bộ kiểm tra PHP cô lập: **70 bài, 781 xác nhận, đạt**. Dependency cục bộ mượn từ checkout `v2board`; có cảnh báo deprecated của dependency/Helper trên PHP cục bộ, không phải lỗi xác nhận test. Không thay cho kiểm thử toàn bộ dependency đang cài trên VPS.
- Helper request thật trong bundle Admin: lỗi monitor 401/403/429/500/502/503, JSON/HTML/không có Content-Type, mất mạng hoặc JSON lỗi đều không xóa phiên. Main API vẫn gọi được sau lỗi monitor; 403 ở API được bảo vệ vẫn đăng xuất. Lỗi mạng/parse được kiểm tra ở helper, không giả lập sự cố mạng trên website thật.
- Bootstrap provider/router thật, render Admin/Staff, cấu hình worker cho production và replay đủ 7 migration: đạt, 213 route, 0 lỗi bootstrap.
- Website thật `shoptuantruong.cc`: Admin mở trang hàng đợi thấy Đang chạy, 0 công việc hiện tại/0 lỗi; trở về dashboard, tải lại, đăng xuất rồi đăng nhập lại thành công. Không tái hiện lỗi tự quay về đăng nhập. Không sửa quyền tài khoản thật hoặc cấu hình máy chủ.

Không thể cam kết không bao giờ đăng xuất: hết/thu hồi phiên, khóa tài khoản, mất dữ liệu phiên Redis, đổi APP_KEY, chạy asset/provider cũ hoặc lỗi proxy của API chính vẫn có thể dẫn đến từ chối xác thực. Đợt này chưa đọc trực tiếp cấu hình `.env`/OPcache hay thử restart VPS. Mục tiêu đã xác minh là lỗi Horizon không làm mất phiên Admin hợp lệ, đồng thời không mở quyền monitor cho Staff/khách.

## Bản dịch

- Sửa hai mục từ điển đảo ngược, vốn biến nhãn tiếng Việt thành tiếng Trung.
- Bổ sung các nhãn/placeholder còn thiếu của cấu hình, DNS, node/chứng chỉ, mã giảm giá, thẻ quà tặng, nhóm, định tuyến, hướng dẫn, thông báo và hàng đợi tính lưu lượng.
- Sửa các bản dịch gây hiểu nhầm: Lịch sử hỗ trợ; mô tả nhập cấu hình vào ứng dụng; nút xem hướng dẫn; trạng thái hoàn thành; mức ưu tiên ticket; chiết khấu/hoa hồng; lệnh cài đặt tự động.
- Bộ dịch Admin xử lý cả cập nhật text/placeholder của React, chuẩn hóa khoảng trắng trong khóa và chỉ dịch các node thay đổi. Không dịch giá trị input, textarea, nội dung có thể chỉnh sửa, script hoặc đoạn code.
- Kiểm tra **817 mục Admin và 255 mục người dùng**: không có chữ Hán trong giá trị bản dịch, giữ nguyên tham số nội suy. Kiểm tra cập nhật nhãn/placeholder và dữ liệu nhập không bị thay đổi: đạt.
- Bốn bộ JavaScript Admin session/CTV/gói Staff/Staff UI: đạt; thêm bộ `translation-smoke.js` đạt.
- Bản xem trước cục bộ dùng bundle Admin thật và dữ liệu giả: mở form mã giảm giá, chọn kiểu giảm, mở form bài hướng dẫn; các nhãn/placeholder được dịch. Nhập `天` làm tiêu đề mẫu vẫn giữ nguyên; không lưu dữ liệu. Ảnh ở `artifacts/qa-translation-coupon-20261009.png` và `qa-translation-knowledge-20261009.png`.

Các khóa tiếng Trung trong file từ điển là định danh của giao diện, được giữ lại. Chữ Trung do người dùng tự nhập hoặc nội dung tài liệu không bị tự đổi. Không tuyên bố đã chạy mọi form/protocol/ngôn ngữ của theme. Bản dịch mới được kiểm tra cục bộ, **chưa triển khai lên VPS** trong đợt này.

## Cập nhật website test

Asset version tăng lên `1.7.5.2685.2226`. Sau khi kéo nhánh test:

```bash
cd /www/wwwroot/v2pro-test
git pull --ff-only origin test/ctv-20261008
php artisan config:cache
php artisan view:clear
```

Tải lại trình duyệt bằng Ctrl+F5. Không cần migration hoặc cập nhật Composer cho bản dịch này. Nếu đang dùng Workerman/OPcache không kiểm tra timestamp, restart đúng process phục vụ website để nhận phiên bản cấu hình mới. Giữ thay đổi Composer cục bộ do trình cài đặt đã thêm AdapterMan.
