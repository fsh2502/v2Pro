# Staff: tạo khách hàng và chỉnh sửa khách do mình tạo

## Quyền hiện tại

Staff có quyền tạo khách hàng trong hạn mức Admin cấp, quản lý khách hàng đủ điều kiện qua menu, xem lịch sử thao tác và đặt tên subscription riêng cho chính mình.
Để truy cập một khách hàng, cả `staff_creator_id` và `staff_owner_id` phải trùng với ID Staff đang đăng nhập.
Tài khoản đích cũng phải là khách hàng thường, không phải Admin hoặc Staff.

- `staff_creator_id`: Staff đã tạo khách hàng; tự ghi khi tạo mới và không đổi khi chuyển người phụ trách.
- `staff_owner_id`: Staff hiện đang quản lý khách hàng.
- Chỉ được Admin gán làm người phụ trách không đồng nghĩa là người tạo và không tự cấp quyền sửa.
- Nếu Admin chuyển khách sang Staff khác, Staff cũ mất quyền; Staff mới cũng không được sửa vì không phải người tạo. Admin vẫn chỉnh sửa được.
- Staff không được tự thay đổi chủ sở hữu, người tạo, hạn mức hoặc vai trò tài khoản.

Đã gỡ quyền quản lý ticket, thông báo, xem danh mục gói bán chính, gửi email, khóa qua API riêng, xuất dữ liệu và quản lý node.
Staff không nhận thông báo quản trị qua Telegram và không thể trả lời ticket qua bot.
Trang `/staff` dùng CSS/theme của panel Admin, gồm **Cài đặt → Cá nhân hóa** phía trên **Nhân viên → Quản lý khách hàng**.
Trạng thái khóa/mở khóa vẫn là trường dữ liệu khách hàng có thể chỉnh trong `user/update`; không có API thao tác khóa độc lập.

## Cập nhật database

Sau khi triển khai, chạy trên máy chủ:

```bash
php artisan migrate --force
php artisan optimize:clear
```

Migration sở hữu thêm cột/index còn thiếu; migration `2026_10_07_000001_add_staff_customer_creator.php` thêm người tạo.
Các migration không suy đoán người tạo từ người phụ trách và không sửa dữ liệu khách cũ.
Migration `2026_10_08_000001_allow_staff_unicode_text.php` mở rộng appName và ghi chú sang MySQL `utf8mb4` để lưu được emoji; không thu hẹp charset khi rollback.
`database/install.sql` và `database/update.sql` cũng có các trường mới cho quy trình hiện tại.
Không chạy `install.sql` trên database đang sử dụng vì script đó xóa bảng.

## Thiết lập từ Admin

Trong **Quản Lý Người Dùng → Chỉnh sửa**, chỉ bật Staff và tắt Admin cho tài khoản nhân viên.
Các thiết lập riêng chuyển sang **Quản Lý CTV**, nằm ngay dưới Quản Lý Người Dùng trong menu Admin.

Trong **Quản Lý CTV → Danh sách CTV**:

- Bấm **Thiết lập** để đặt số khách hàng tối đa, tên ứng dụng riêng và trạng thái hoạt động/khóa CTV.
- Hạn mức mặc định 0, chưa được tạo hoặc nhận khách.
- Tên để trống dùng mã CTV; không phụ thuộc tên ứng dụng chung. CTV vẫn có thể tự đổi trong Cá nhân hóa.
- Bấm **Gói được phép** để cấp từng gói chung cho CTV đó; nút **Danh mục gói CTV** quản lý danh mục chung ngay cả khi chưa có CTV.

Trong **Quản Lý CTV → Khách hàng & Phân công**:

- Tìm khách theo email, ID, mã khách hoặc lọc theo ID CTV phụ trách.
- Bấm **Phân công**, nhập ID CTV phụ trách để gán/chuyển quản lý; để trống nếu Admin quản lý.
- Với dữ liệu cũ chưa có người tạo, chỉ xác nhận ID CTV đã tạo khi có căn cứ. Chỉ xác nhận được một lần.
- Admin vẫn quản lý mọi khách hàng; việc gán thêm cũng kiểm tra hạn mức.

API Admin riêng: `GET /ctv/fetch`, `POST /ctv/update`, `GET /ctv/customers`, `POST /ctv/assign`,
sau tiền tố `/api/v1/<secure_path>`. Các API này dùng middleware Admin và nhật ký quản trị.
`user/update` giữ công tắc vai trò Staff; từ chối hạn mức, chủ sở hữu, người tạo và tên ứng dụng riêng để tránh lưu lại thiết lập đã chuyển từ biểu mẫu cũ.

Hạn mức tính tổng khách hàng đang được quản lý, kể cả bị khóa/hết hạn hoặc chỉ được Admin gán.
Thẻ hạn mức giữ bố cục demo đầu: nhãn STAFF và mã bên trái, số khách/hạn mức,
thanh tiến độ và số chỗ còn lại bên phải; số liệu lấy từ API của Staff đang đăng nhập.
Không giảm hạn mức xuống dưới số đang quản lý.
Staff xóa khách đủ điều kiện hoặc Admin xóa/chuyển khách sẽ giải phóng chỗ.
Trước khi xóa/bỏ quyền Staff hoặc nâng Staff thành Admin, cần chuyển hết khách đang quản lý.

## Gói riêng cho Staff

Admin dùng một danh mục chung cho nhân viên trong `v2_staff_plan`; gói bán chính trong `v2_plan` giữ nguyên.
Mỗi Staff được cấp từng gói qua `v2_staff_plan_permission`. Khách hàng lưu `staff_plan_id` riêng, không dùng ID đó để truy vấn gói chính.
Migration `2026_10_07_000003_add_staff_plans.php` tạo các bảng/cột này; mặc định chưa Staff nào được cấp gói.

Trong Admin → **Quản Lý CTV**, dùng **Danh mục gói CTV** và **Gói được phép** ở từng CTV:

1. Tạo gói với tên, nhóm máy chủ, dung lượng GB, tốc độ, giới hạn thiết bị và trạng thái bật/tắt.
2. Đánh dấu các gói nhân viên được dùng rồi bấm **Lưu quyền sử dụng**. Danh mục là chung nhưng lựa chọn cấp quyền riêng cho từng Staff.
3. Staff vào **Chỉnh sửa** hoặc **Tạo khách hàng**, chọn **Gói Staff** và lưu.

Staff chỉ thấy tên/ID, dung lượng và tốc độ của gói đang bật được cấp cho mình. API kiểm tra lại quyền ở mỗi lần gán gói.
Staff không tạo/sửa danh mục, không cấp quyền dùng gói, không chọn nhóm máy chủ hoặc giới hạn thiết bị trực tiếp.
Nhóm máy chủ và giới hạn thiết bị lấy từ gói Admin thiết lập. Chọn gói riêng xóa `plan_id` chính của khách đó.
Nhóm máy chủ có thể dùng hạ tầng hiện tại; danh mục gói vẫn tách biệt.

Chọn gói điền dung lượng/tốc độ mặc định; Staff vẫn có thể sửa hai trường này theo quyền chỉnh dữ liệu đã có.
Đổi gói không xóa lưu lượng `u`/`d`, không đổi hạn sử dụng và không tạo đơn hàng.
Gói riêng chưa có giá, chu kỳ mua hoặc cơ chế tự đặt lại lưu lượng; hạn sử dụng do Staff nhập trong biểu mẫu.
Tắt gói hoặc thu hồi quyền ngăn lần gán tiếp theo; khách đang dùng gói đó vẫn giữ dữ liệu và có thể được sửa các trường khác.
Sửa thông số danh mục không tự ghi đè khách đang sử dụng; thông số áp dụng khi chọn/lưu gói cho khách.
Admin chọn gói bán chính cho khách, hoặc khách mua gói chính, sẽ chuyển khỏi gói Staff.

## Mã nhận diện

Staff ID 12 có mã `STF-000012`; khách ID 345 hiện thuộc Staff 12 có mã `STF-000012-KH-000345`.
ID khách hàng vẫn là số `345`, không thay thế bằng mã này.
Khi Admin chuyển khách, phần mã Staff theo chủ mới; ID khách và lịch sử người tạo giữ nguyên.
Khách chưa được xác nhận người tạo không xuất hiện trên trang Staff.

## Cá nhân hóa tên ứng dụng

Mỗi Staff lưu tên riêng trong `v2_user.staff_app_name` (tối đa 64 ký tự, hỗ trợ tiếng Việt/Unicode).
Tên chưa thiết lập mặc định là mã `STF-...`, không lấy từ `v2board.app_name`.
Staff chỉ cập nhật tên của tài khoản đang đăng nhập; không gửi ID tài khoản đích hay cấu hình Admin.
Migration `2026_10_07_000002_add_staff_app_name.php` thêm cột này.

Subscription của khách dùng tên của **Staff đang quản lý** (`staff_owner_id`).
Tên được giải quyết cho từng subscription, không ghi đè config toàn cục và không dùng phiên Staff đã cache.
Hiddify/sing-box/v2RayTun/V2BOX và các bộ xuất khác gửi tên riêng qua tiêu đề/tên tệp;
Clash/Stash thay `$app_name` trong cấu hình đã parse trước khi xuất YAML để xử lý dấu ngoặc kép/dấu hai chấm.
Khách không thuộc Staff tiếp tục dùng tên chung. Chuyển người quản lý thì subscription theo tên Staff mới.
Ứng dụng khách cần đồng bộ lại subscription; việc hiển thị/giới hạn độ dài còn theo ứng dụng (Happ hiện giới hạn 25 ký tự).
Không đổi tên node hoặc tên ứng dụng cài trên thiết bị.

## Menu chỉnh sửa dữ liệu khách hàng

Menu theo giao diện Admin gồm 7 mục: **Chỉnh sửa**, **Sao chép URL**, **Hiện mã QR**,
**Đặt lại UUID đăng ký**, **Lịch sử Data**, **Lịch sử thao tác**, **Xóa người dùng**.
Không có **Người mời**, **Chỉ định đơn hàng** hoặc **Các đơn hàng của người dùng** trong menu Staff; Admin giữ quyền quản lý đơn hàng.
Mọi thao tác đều kiểm tra khách là người dùng thường, do Staff tạo và đang do Staff quản lý.
Khách được chuyển đi hoặc chỉ được gán quản lý không đủ quyền.

URL chỉ lấy khi chọn URL/QR qua API riêng, không đưa vào danh sách khách; không trả UUID/mật khẩu băm.
QR dùng lại bộ tạo QR có sẵn trong bundle Admin, chạy tại trình duyệt, không gửi URL ra dịch vụ ngoài.
Đặt lại UUID có xác nhận, đổi cả UUID và token, thu hồi URL một lần cũ; khách phải nhập subscription mới.
Lịch sử Data phân trang và chỉ truy vấn khách đã qua kiểm tra quyền.

Xóa có xác nhận, thu hồi phiên và xóa dữ liệu liên quan của khách (đơn hàng, mã mời, ticket/tin nhắn, lịch sử Data).
Nếu khách còn được tài khoản ngoài phạm vi Staff dùng làm người mời, Staff không xóa được và cần Admin xử lý,
để không chỉnh sửa quan hệ người mời của Staff khác. Không có xóa hàng loạt.

## Lịch sử thao tác CTV

- Admin: **Quản Lý CTV → Lịch sử thao tác**, xem toàn bộ nhật ký CTV; tìm theo email/ID/mã và lọc theo ID CTV.
- Staff: **Nhân viên → Lịch sử thao tác**; menu khách hàng cũng có **Lịch sử thao tác** để lọc theo khách đó.
- Mỗi dòng ghi thời gian, người thực hiện, đối tượng, thao tác và các trường thay đổi trước/sau. Nhật ký chỉ đọc, có phân trang.
- Ghi tạo/sửa/xóa khách, đặt lại UUID/URL, thiết lập CTV, appName, danh mục gói riêng và cấp quyền dùng gói. Thao tác Admin trong User editor và khóa/xóa hàng loạt cũng ghi các tài khoản liên quan CTV.
- Không lưu mật khẩu/hash, token, UUID thật hoặc dữ liệu tài chính. Với đổi mật khẩu/UUID chỉ ghi dấu đã thay đổi. Staff không nhận các trường quản trị bị ẩn trong chi tiết khách.
- Staff chỉ xem nhật ký khách do mình tạo và đang phụ trách, cùng thiết lập của tài khoản Staff của mình. Chuyển khách đi làm mất quyền xem lịch sử khách. Nhật ký khách bị xóa được giữ lại theo người phụ trách/người tạo tại thời điểm ghi, không đi theo thao tác xóa dữ liệu khách.
- Ghi nhật ký cùng transaction của thay đổi dữ liệu; lỗi ghi nhật ký làm rollback dữ liệu. Không ghi biểu mẫu không có thay đổi hoặc thao tác bị từ chối.
- Migration `2026_10_08_000000_add_staff_activity_log.php` tạo bảng `v2_staff_activity_log`. Chạy lệnh migrate ở trên khi triển khai. Nhật ký bắt đầu từ khi cập nhật, không tạo lại lịch sử trước đó; không ghi các lượt sử dụng lưu lượng tự động hay lượt xem/sao chép URL.
- API Admin `GET /ctv/activity`, API Staff `GET /activity/fetch`; chỉ cung cấp GET, không có API sửa/xóa nhật ký. Header `Cache-Control: private, no-store`.

## API Staff còn lại (chi tiết)

Tiền tố `/api/v1/staff`, header `Authorization: <auth_data>`.

| API | Chức năng |
| --- | --- |
| `GET /activity/fetch?current=1&pageSize=20&search=...` | Nhật ký trong phạm vi của tài khoản Staff hiện tại |
| `GET /personalization/fetch` | Tên ứng dụng và mã Staff của chính tài khoản đang đăng nhập |
| `POST /personalization/update` | Lưu `app_name` riêng; không nhận trường đích/quyền/cấu hình chung |
| `GET /user/summary` | Mã Staff, số khách đang quản lý/được sửa, hạn mức, chỗ còn lại |
| `GET /plan/fetch` | Các gói riêng đang bật được cấp cho Staff đang đăng nhập |
| `GET /user/fetch?current=1&pageSize=20&search=...` | Chỉ danh sách khách do mình tạo và đang quản lý |
| `GET /user/getUserInfoById?id=...` | Chi tiết khách đủ điều kiện sửa |
| `POST /user/create` | Tạo một khách: email, password tối thiểu 8 ký tự, staff_plan_id, transfer_enable, u, d, speed_limit, expired_at, remarks |
| `POST /user/update` | Sửa khách đủ điều kiện; bắt buộc id, email, banned |
| `GET /user/getSubscription?id=...` | URL subscription cho sao chép/QR, có kiểm tra quyền và `no-store` |
| `POST /user/resetSecret` | Đổi UUID/token khách đủ điều kiện; bắt buộc id và confirm=1 |
| `GET /user/getTrafficLog?id=...&current=1&pageSize=20` | Lịch sử Data của khách đủ điều kiện |
| `POST /user/delUser` | Xóa một khách đủ điều kiện; bắt buộc id và confirm=1 |
| `POST /logout` | Thu hồi phiên hiện tại |

Biểu mẫu dùng drawer như Admin, gồm Email, Mật khẩu, Đã dùng tải lên/tải xuống (GB),
Dung lượng (GB), Gói Staff, Ngày hết hạn, Trạng thái tài khoản, Giới hạn tốc độ (Mbps) và Ghi chú.
Tài khoản mới mặc định hoạt động. Dung lượng/lưu lượng được đổi sang byte nguyên khi gửi API;
bộ đếm không thay đổi không được gửi lại để tránh ghi đè lưu lượng mới.
Không có Email người mời, Số dư, Hoa hồng, Giới hạn số thiết bị, Gói đăng ký chính,
Loại giảm giá được đề xuất, Hoa hồng nhận được, Chiết khấu độc quyền, Quyền Admin hoặc Quyền Staff.
API tạo/sửa từ chối trường ngoài danh sách được phép, kể cả giá trị null.
API đọc không trả email/ID người mời, dữ liệu tài chính/hoa hồng/giới hạn thiết bị.
Chỉnh sửa thông thường giữ các thiết lập Admin và quan hệ người mời hiện có.
Bảng khách hàng hiển thị Lưu lượng đã dùng (`u + d`), Tổng lưu lượng (`transfer_enable`)
theo GB và Ngày đăng ký (`created_at`). Ngày chưa có dữ liệu hiển thị dấu —.
Giao diện Staff và bảng dùng font hệ thống kiểu iOS/SF Pro qua `-apple-system`/`BlinkMacSystemFont`.
Thiết bị chưa có SF Pro dùng Segoe UI/Roboto/Helvetica/Arial; không nhúng tệp font Apple vào repo.
Ngày theo `YYYY/MM/DD HH:mm`; lưu lượng theo GB với 2 chữ số thập phân.
Nhãn ngày hết hạn xanh khi còn hạn/không giới hạn, đỏ khi hết hạn.
Nhãn lưu lượng đã dùng đỏ khi vượt tổng lưu lượng; trạng thái bị khóa cũng đỏ như Admin.
Danh sách/chi tiết khách không trả mật khẩu băm, token, UUID hoặc đường dẫn đăng ký; URL chỉ được trả qua API riêng khi cần.
`staff_owner_id`, `staff_creator_id`, `staff_customer_limit`, `is_admin`, `is_staff` bị chặn ở API tạo/sửa, kể cả gửi null.
Backend khóa hàng Staff và kiểm tra hạn mức trong transaction để chống vượt hạn mức do request đồng thời.

## Kiểm thử

`php vendor/bin/phpunit --no-configuration --do-not-cache-result --bootstrap tests/staff-bootstrap.php tests/Feature/StaffOwnershipTest.php`

Dùng SQLite bộ nhớ/cache array; không kết nối database thật. Nếu thư viện ở vị trí khác, đặt `V2PRO_TEST_AUTOLOAD` tới `vendor/autoload.php`.
Kiểm thử tranh chấp khóa thực tế cần MySQL/InnoDB trên staging.

`node tests/staff-ui-smoke.js`: luồng đăng nhập/cá nhân hóa/menu/QR/sao chép/xác nhận/tạo/sửa/hạn mức/lịch sử thao tác/báo lỗi/đăng xuất và không gọi API đã gỡ.
`node tests/staff-plan-admin-ui-smoke.js`: tạo/sửa danh mục gói riêng, cấp quyền và xử lý lỗi.
`node tests/ctv-admin-ui-smoke.js`: menu CTV, chuyển các trường khỏi User editor, hạn mức/tên/trạng thái, phân công khách và lỗi API.
`node tests/staff-preview.js`: fixture tại `http://127.0.0.1:8767/staff` dùng dữ liệu mẫu.
