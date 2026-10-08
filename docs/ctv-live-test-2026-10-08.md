# Kiểm thử website CTV thật — 08/10/2026

Website staging: `https://shoptuantruong.cc`. Nhánh `test/ctv-20261008`, commit chủ website báo cáo triển khai: `53af65ee`.

**116/116 bước kiểm tra API thành công.** Con số gồm bước chuẩn bị dữ liệu và đọc xác nhận, không phải 116 chức năng độc lập. Giao diện Staff đã đăng nhập, đổi gói và lưu ghi chú thành công. **Giao diện Admin còn hiện tượng vào dashboard rồi quay lại đăng nhập; chưa xác định nguyên nhân hoặc xác nhận đầy đủ luồng giao diện Quản Lý CTV.**

Chủ website đã cho phép định danh HTTP `v2Pro-CTV-staging-check/1.0`, tạo và giữ dữ liệu mẫu, chuyển khách rồi trả lại và thu hồi vai trò Staff rồi khôi phục. Không thay đổi Cloudflare, tài khoản thật, node hoặc giao dịch thanh toán.

## Luồng API đã kiểm chứng

| Luồng | Kết quả |
| --- | --- |
| Đăng nhập Admin, danh sách CTV và danh mục gói Staff | Thành công |
| Tạo Staff, cấp hạn mức, cấp từng gói riêng | Thành công |
| Tạo khách, mã khách gắn Staff, lưu Staff tạo ban đầu | Thành công |
| Staff đọc/sửa/reset/xóa khách của Staff khác | Bị từ chối; tìm kiếm không trả khách của Staff khác |
| Gửi thêm trường quyền Admin/Staff, số dư, chủ sở hữu, gói chính, giới hạn thiết bị | Bị từ chối |
| Gói được cấp, gói tắt, chưa được cấp, thu hồi rồi cấp lại | Đúng quyền; sửa trường thông thường vẫn giữ được gói hiện có sau thu hồi |
| Khách bị khóa/hết hạn và hạ hạn mức dưới số khách hiện có | Khách vẫn tính vào hạn mức; cấu hình không hợp lệ bị từ chối |
| Hai yêu cầu tạo khách đồng thời khi còn một chỗ | Một thành công, một HTTP 422; không vượt hạn mức |
| appName tiếng Việt/emoji độc lập giữa Staff | Thành công; header tải subscription dùng appName Staff |
| Sửa khách, áp dụng dung lượng gói, reset URL đăng ký, xóa khách mẫu | Thành công |
| Nhật ký tạo/sửa/reset/xóa/cá nhân hóa, bộ lọc Admin | Có dữ liệu và cách ly; URL subscription không xuất hiện trong dữ liệu nhật ký đã kiểm tra |
| Khóa Staff với token đã cấp rồi mở lại | Token bị từ chối khi khóa; truy cập khôi phục khi mở |
| Chuyển khách A sang B rồi trả lại A | Quyền sửa yêu cầu chủ sở hữu hiện tại và Staff tạo ban đầu; B không được sửa khách do A tạo |
| Thu hồi vai trò B rồi khôi phục | Không được thu hồi khi còn quản lý khách; sau khi gỡ khách mẫu, thu hồi chặn token cũ; vai trò và khách đã được trả lại |

## Giao diện đã kiểm chứng

- Staff A đăng nhập tại `/staff`, hạn mức 2/2 và nút tạo bị vô hiệu hóa đúng hạn mức.
- Bảng khách có mã, email, lưu lượng đã dùng/tổng, ngày đăng ký, gói Staff, hạn dùng, trạng thái và nút Chỉnh sửa ghim bên phải.
- Menu có Chỉnh sửa, Sao chép URL, Hiện mã QR, Đặt lại UUID đăng ký, Lịch sử Data, Lịch sử thao tác, Xóa người dùng; không có đơn hàng/người mời.
- Form sửa chỉ có trường được phép và hai gói đã cấp. Đã đổi khách ID 4 sang gói 100 GB, ghi chú `QA kiểm thử giao diện 🌟`, lưu thành công. Upload/download giữ lại; tổng đã dùng 3 GB.
- Lịch sử thao tác hiển thị dữ liệu thật. Không ghi nhận lỗi console trên trang Staff trong phiên kiểm tra.
- Chưa xác nhận thao tác QR/copy trên giao diện; URL và tải subscription đã kiểm tra qua API.

Ảnh cục bộ: `artifacts/ctv-live-staff-20261008.png`. Kết quả API đã loại thông tin xác thực: `artifacts/ctv-live-result.json`. Mật khẩu/token không có trong báo cáo hoặc Git.

## Hiện tượng Admin cần xử lý

Biểu mẫu đăng nhập có lúc hiển thị dashboard và menu Quản Lý CTV rồi tự quay về đăng nhập. Không giữ được phiên đủ lâu để thao tác CTV; không có lỗi console ghi nhận. API đăng nhập JSON và biểu mẫu đều HTTP 200; API thông tin người dùng, kiểm tra đăng nhập, CTV/gói và sáu API thống kê dashboard cũng HTTP 200 với định danh được cho phép.

Trước đó, định danh mặc định Python bị Cloudflare trả HTTP 403, mã 1010. Sau khi được cho phép dùng định danh trên, API chạy thành công. Đây là bằng chứng bộ lọc ảnh hưởng một client, **chưa chứng minh nguyên nhân trình duyệt Admin tự đăng xuất**. Bộ request cũ của Admin xóa xác thực và tải lại trang khi gặp bất kỳ HTTP 403. Cần đối chiếu request thất bại trong Network hoặc log máy chủ/Cloudflare trước khi sửa.

## Dữ liệu mẫu giữ lại theo yêu cầu

Tiền tố tên/email: `ctvqa-20261008-efd55c`.

| Dữ liệu | Trạng thái cuối |
| --- | --- |
| Staff A — ID 2, STF-000002 | Hoạt động, hạn mức 2, gói 1 và 2 |
| Staff B — ID 3, STF-000003 | Hoạt động, hạn mức 1, gói 2; vai trò khôi phục |
| Khách ID 4 và 7 | Thuộc A; khách 4 đã trả lại A sau chuyển |
| Khách ID 6 | Thuộc B; đã khôi phục sau phép thử thu hồi vai trò |
| Khách ID 5 | Đã xóa trong phép thử; lịch sử được giữ |
| Gói Staff ID 1/2/3/4 | 100/200/300/400 GB; gói 3 tắt, gói 4 chưa cấp |
| Nhóm máy chủ ID 1 | Nhóm mẫu riêng, không gắn node |

## Giới hạn kết luận

API CTV đã thử hoạt động đúng trên staging; giao diện Staff đã qua luồng sửa/lưu thực tế. Chưa kết luận toàn bộ dự án sẵn sàng production khi hiện tượng Admin còn tồn tại. Chưa kiểm chứng node thật, đồng bộ trong ứng dụng khách thật, worker/scheduler, thanh toán/webhook, khôi phục backup, mọi chức năng cũ hoặc kiểm toán bảo mật toàn diện. Tải subscription chỉ xác nhận phản hồi và tên file, không chứng minh kết nối VPN vì nhóm thử không có node.

Theo đầu ra chủ website cung cấp: PHP CLI 8.3.33, AdapterMan 0.7.1, Composer platform check thành công, config cache/view clear thành công và bảy migration đã chạy. Dependency/lock thực tế trên VPS chưa được đưa vào bản phát hành Git để cố định môi trường.

Rà soát cục bộ trước đó: [deployment-review-2026-10-08.md](deployment-review-2026-10-08.md). Hướng dẫn staging: [README-TEST.md](../README-TEST.md).

## Sửa lỗi Admin quay lại đăng nhập — kiểm tra tiếp ngày 08/10/2026

Đã xác định yêu cầu còn thiếu trong đợt kiểm tra dashboard ban đầu: `/monitor/api/stats`. Với JWT Admin hợp lệ và định danh HTTP đã được cho phép, website trả **HTTP 403, application/json, message rỗng**, trong khi `/api/v1/fdb3c557/config/fetch?key=site` trả HTTP 200. Phản hồi monitor này khác lỗi Cloudflare 1010 đã quan sát trước đó.

Dashboard gọi API Horizon monitor ngay khi mở. Provider Horizon mặc định kiểm tra Laravel guard và gate có danh sách email rỗng; panel sử dụng JWT, không có phiên Laravel guard. Horizon từ chối request, rồi helper Admin xóa token và tải lại trang vì HTTP 403.

Bản sửa:

- Horizon xác thực JWT bằng AuthService của panel, đọc lại quyền Admin/trạng thái khóa từ database; không dùng ngoại lệ môi trường local để mở quyền.
- Chỉ yêu cầu kiểm tra trạng thái monitor được giữ phiên khi gặp HTTP 403. Các API chính vẫn xóa phiên và điều hướng khi xác thực bị từ chối. Tùy chọn này không được gửi lên URL/header/body.
- Helper đọc được JSON có `charset`; tăng phiên bản asset lên `1.7.5.2685.2225`.

Kiểm tra cục bộ: 65 bài PHP, 659 xác nhận; bốn bộ JavaScript gồm helper request thực tế trong bundle; bootstrap 213 routes, render hai giao diện và replay migration thành công. Test Horizon kiểm tra Admin có JWT nhưng không có Laravel guard, khóa/thu hồi Admin, thu hồi session, Staff/guest/token sai và giả mạo trường user. Bộ dependency cục bộ vẫn mượn từ checkout khác, như báo cáo trước.

**Chưa xác nhận bản sửa trên VPS** cho tới khi chủ website kéo commit mới và khởi động lại PHP/process phục vụ web. Lệnh cập nhật (không cần migration hoặc Composer cho bản sửa này):

```bash
cd /www/wwwroot/v2pro-test
git pull --ff-only origin test/ctv-20261008
php artisan config:cache
php artisan view:clear
```

Sau đó restart đúng PHP của website trong aaPanel nếu dùng PHP-FPM; nếu dùng process Workerman phục vụ web thì restart process của website test. Việc khởi động lại bảo đảm provider/OPcache cũ không còn được dùng. Tải lại trang Admin và kiểm chứng dashboard, Quản Lý CTV và monitor với Admin; Staff/guest phải tiếp tục bị từ chối monitor.
