# Một lệnh bổ sung cấu trúc database cũ

Lệnh có trong nhánh `Max` và nhánh nâng cấp `codex/laravel12-security`, chạy từ thư mục mã nguồn mới đã cài vendor Laravel 12. Lệnh kết nối database theo cấu hình ứng dụng đang được nạp; giữ nguyên `.env`, APP_KEY và cấu hình website cũ. Nếu đang có config cache trỏ sai database, phải sửa cấu hình/cache trước. Lệnh in tên database trước khi làm việc.

## Sử dụng

Xem trước, không ghi database:

```bash
/www/server/php/83/bin/php artisan v2board:db-upgrade --check
```

Sau khi đã sao lưu database, kiểm tra đúng database và dừng việc ghi từ website/worker/cron trong cửa sổ nâng cấp, chạy một lệnh:

```bash
/www/server/php/83/bin/php artisan v2board:db-upgrade --force
```

Chạy với user có quyền đọc mã nguồn, ghi storage/bootstrap/cache và quyền CREATE/ALTER/INDEX trên database. `--force` xác nhận chủ động chạy; không tự tạo hay kiểm chứng bản sao lưu. Không chạy trên database rỗng: đây là nâng cấp database v2Pro hiện có, không phải cài mới.

## Những việc được thực hiện

- Đọc cấu trúc CREATE TABLE của `database/install.sql` làm tham chiếu, hiện gồm 31 bảng. Tuyệt đối không nhập toàn bộ SQL: các DROP TABLE, INSERT/UPDATE, SET trong file bị bỏ qua.
- Đối chiếu và lập toàn bộ kế hoạch trước khi ghi: tạo bảng thiếu; thêm cột thiếu với định nghĩa tham chiếu; thêm index thiếu, nhận diện index tương đương dù khác tên.
- Giữ bảng/cột/index tùy chỉnh ngoài cấu trúc tham chiếu. Không tự đổi kiểu, đổi tên hay xóa cột hiện có. Các tài khoản, mật khẩu, ID, khách hàng, gói và đơn hàng hiện có không được cập nhật bằng SQL dữ liệu.
- Chạy `migrate --force --path=database/migrations`: tạo bảng theo dõi migration khi cần và áp dụng migration chưa chạy. Migration Unicode có thể đổi charset của ghi chú/appName sang utf8mb4, giữ nội dung nếu phù hợp giới hạn kích thước.
- Kiểm tra lại cấu trúc sau khi chạy. Chạy lại sẽ bỏ qua phần đã có; nếu migration ledger đã ghi nhận nhưng bảng/cột bị thiếu, bước đối chiếu vẫn bổ sung cấu trúc đó. Tạo lại bảng đã mất chỉ tạo bảng rỗng, không phục hồi các hàng đã mất.
- Khóa MySQL có tên riêng để hai phiên của chính lệnh này không cùng chạy trên cùng database; khóa được lấy và giải phóng trên kết nối ghi. Khóa không ngăn website hoặc lệnh migrate khác ghi dữ liệu.

## Các trường hợp dừng trước khi ghi

Database không có bảng nền v2_user/v2_order/v2_plan hoặc không có các cột nhận diện; driver khác MySQL/MariaDB; table prefix tùy chỉnh; cột bắt buộc không có default trên bảng có dữ liệu; cột AUTO_INCREMENT bị thiếu; khóa chính/index trùng tên nhưng khác cấu trúc; dữ liệu trùng khiến không thể thêm UNIQUE; nội dung vượt giới hạn của migration Unicode. Lệnh không tự đoán giá trị hay xóa dữ liệu để vượt lỗi.

MySQL DDL có thể tự commit: nếu bước sau lỗi, các bước trước có thể đã áp dụng. Lệnh trả exit code 1 và dừng; không báo hoàn tất, không tự rollback hoặc khôi phục dump. Xử lý nguyên nhân rồi chạy lại, hoặc dùng quy trình phục hồi đã chuẩn bị. Các thay đổi charset/index có thể khóa bảng và mất thời gian trên database lớn.

Lệnh này chỉ chuyển cấu trúc database trong repo này. Nó không cài PHP/Composer/vendor, đổi document root, đổi cấu hình Horizon/cron hoặc xác nhận các luồng thanh toán/email/node. Không thể chỉ dùng lệnh này để hoàn tất nâng cấp Laravel 8 lên 12.

## Kiểm thử

Kiểm thử cô lập kiểm tra parser trên SQL thực, bỏ qua SQL xóa/ghi dữ liệu, bảo toàn bản ghi/Unicode/schema riêng, chạy lại và tiếp tục sau gián đoạn, từ chối tình huống không an toàn, chế độ chỉ đọc, khóa đồng thời, giải phóng khóa khi lỗi và mã thoát khi migration thất bại. SQLite được dùng cho dữ liệu cô lập, MySQL connection được mô phỏng cho khóa/DDL; cần chạy `--check` và thử `--force` trên bản sao database MySQL thực trước khi dùng trên website chính.
