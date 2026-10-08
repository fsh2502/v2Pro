# Rà soát triển khai v2Pro — 08/10/2026

**Kết luận: chưa đủ cơ sở để đưa bản hiện tại lên production.** Các luồng được kiểm tra đã chạy thành công sau khi sửa lỗi, nhưng chưa kiểm chứng bộ dependency của bản phát hành và hạ tầng MySQL/Redis thực tế. Có thể tiếp tục kiểm thử trên staging sau khi chuẩn bị dependency.

Đợt rà soát tập trung vào mã ứng dụng v2Pro tại repo này: PHP, route, middleware, cấu hình, cài đặt/cập nhật database, Staff/CTV, subscription và tài nguyên giao diện. Các thư mục `v2nodePro_repo`, `v2nodePro-install` và bản sao trong `artifacts` không được coi là mã triển khai của panel. Không thực hiện nâng cấp hay kiểm thử daemon Go/v2node trong đợt này.

## Các lỗi đã sửa trong đợt rà soát

| Vấn đề trước khi sửa | Kết quả |
| --- | --- |
| Xóa xuống dòng trong SQL làm chú thích `--` che câu lệnh tiếp theo, bao gồm appName, gói riêng và bảng nhật ký | Giữ xuống dòng, loại chú thích nguyên dòng trước khi nhập. Installer dừng và trả lỗi khi SQL thất bại; updater hiển thị lỗi bị bỏ qua và kiểm tra các cột/bảng CTV bắt buộc trước khi báo thành công. |
| Quyền Admin được đọc từ cache, có thể cũ khi tài khoản bị khóa, xóa hoặc thu hồi quyền ngoài luồng thu hồi phiên | Middleware đọc lại tài khoản và vai trò hiện tại mỗi request. Có regression test làm nóng cache rồi khóa/thu hồi/xóa tài khoản. |
| Giới hạn sai mật khẩu mặc định được kiểm tra nhưng bộ đếm không tăng nếu config chưa khai báo | Hai nhánh dùng cùng giá trị mặc định. Kiểm thử xác nhận 5 lần sai được ghi và lần thứ 6 bị chặn. |
| Đọc RAM bằng Linfo có thể làm Artisan không khởi động; Horizon chỉ có worker ở môi trường `local` | Có giá trị dự phòng, tối thiểu 1 worker; hỗ trợ `HORIZON_MAX_PROCESSES`; cấu hình worker dùng cho mọi môi trường. `.env.example` dùng `production`. |
| 6 route trỏ tới method không tồn tại | Bỏ 4 route Admin cũ không có nơi gọi trong frontend hiện có (`setInviteUser`, `getStat`, `getRanking`, `getStatRecord`); nối `notice/update` tới hàm lưu đang có; bổ sung danh mục bài viết User chỉ gồm bài hiện và đúng ngôn ngữ. |
| Xem bài viết không tồn tại gây gọi `toArray()` trên null | User/Admin trả 404. |
| Wrapper tác vụ của Staff bật lại nút đã bị khóa sau khi tải dữ liệu | Giữ đúng trạng thái phân trang và hạn mức tạo khách; reset trang/tìm kiếm khi đăng xuất. |
| Tên cá nhân hóa `0` bị coi là chưa đặt tên; MySQL `utf8` của bảng User không lưu được emoji trong appName/ghi chú | Giữ tên `0`; thêm migration mở rộng hai cột sang `utf8mb4`, cập nhật SQL cài đặt/nâng cấp. Phần ALTER charset cần kiểm chứng trên MySQL staging. |
| Endpoint `public/check_user.php` chỉ lấy tên gói chính | Lấy được tên gói Staff riêng khi khách không dùng gói chính. |
| Script update dùng `reset --hard origin/master`, xóa lock file và tự cập nhật thư viện trên server | Dừng khi có thay đổi cục bộ/thiếu lock; chỉ pull fast-forward nhánh hiện tại; dùng Composer install, kiểm tra platform và audit; không tự thêm Adapterman. |
| Cache trình duyệt có thể giữ bundle cũ; cấu hình CLI hiển thị lỗi | Tăng phiên bản asset lên `1.7.5.2685.2223`; tắt hiển thị lỗi và expose PHP trong `cli-php.ini`, vẫn ghi log. |

Việc bỏ 4 route cũ khiến các URL đó trả 404 thay cho lỗi thiếu method. Nếu có ứng dụng bên ngoài tự gọi các URL này, cần kiểm tra hợp đồng API trước khi phát hành; frontend trong repo không gọi chúng.

## Những điểm còn ngăn kết luận sẵn sàng production

1. **Dependency chưa được xác minh cho bản phát hành.** Repo không có `vendor` và `composer.lock`. Đã gỡ `composer.lock` khỏi `.gitignore`, nhưng chưa tạo một lock file đã kiểm thử. Các kiểm tra PHP dùng dependency có sẵn từ `C:/Users/Admin/v2board/vendor`; trong đó Laravel và JWT là các nhánh `8.x-dev`/`6.x-dev`. Kết quả này không chứng minh một lần cài Composer mới sẽ có cùng hành vi. Công cụ Composer chưa tải được do kết nối HTTP thất bại; chưa chạy được `composer validate`, giải dependency mới hoặc `composer audit` cho release. Composer khuyến nghị đưa lock file của ứng dụng vào Git và triển khai bằng `install`. [Tài liệu Composer](https://getcomposer.org/doc/01-basic-usage.md#commit-your-composer-lock-file-to-version-control).

2. **Nền tảng Laravel 8 đã hết thời gian hỗ trợ bảo mật chính thức từ 24/01/2023.** Cần một đợt nâng cấp framework/dependency riêng có kiểm thử tương thích; việc chạy qua các test hiện tại không khắc phục vấn đề vòng đời hỗ trợ. [Chính sách Laravel 8](https://laravel.com/framework/docs/8.x/releases#support-policy).

3. **Có ngoại lệ audit cho JWT trong `composer.json`.** `PKSA-y2cr-5h3j-g3ys` liên quan tới thay đổi kiểm tra độ mạnh/kích thước khóa; upstream đưa kiểm tra khóa vào v7. Cần đối chiếu version thực tế và `APP_KEY` của máy chủ, rồi xử lý ngoại lệ hoặc ghi rõ lý do giữ nó. Chưa xác nhận có thể khai thác lỗi này trong dự án; không có `.env` production để kiểm chứng khóa. [Thay đổi upstream JWT](https://github.com/googleapis/php-jwt/pull/613).

4. **Database và hạ tầng mới chỉ được kiểm tra cô lập.** Migration chạy trên SQLite; chưa kiểm thử MySQL/InnoDB, ALTER charset, khóa hàng, tạo khách song song sát hạn mức, thu hồi gói đồng thời, Redis thật, scheduler, Horizon worker hoặc thanh toán/webhook thực. Máy hiện tại chạy Windows/PHP 8.3.33; Horizon worker cần `pcntl`/`posix` theo dependency của package, chưa được chạy ở đây.

5. **Đường SQL cập nhật cũ còn hạn chế.** `v2board:update` vẫn phát lại file lịch sử và tách câu theo dấu `;`. File có khối `DELIMITER`/procedure không tương thích với cách nhập đó; cũng có các thao tác loại bỏ dữ liệu của phiên bản cũ. Đợt này đã sửa lỗi chú thích, thêm hiển thị lỗi và kiểm tra schema CTV, chưa viết lại toàn bộ cơ chế nâng cấp lịch sử. Với bản bổ sung CTV trên database hiện đang đầy đủ schema panel, ưu tiên chạy migration Laravel trên bản sao staging; không nhập toàn bộ `update.sql` bằng MySQL client vào database thật mà chưa kiểm tra nội dung.

6. **Webman là một runtime chưa xác minh.** `webman.php` cần Adapterman/Workerman nhưng dependency này không được khai báo trong `composer.json` hiện tại; script cũ tự thêm nó khi update. Nếu máy chủ sử dụng Webman, cần khóa và kiểm thử bộ dependency đó trước khi dùng script mới. Chưa chạy web server này, proxy node hay các ứng dụng iOS để kiểm chứng subscription đầu cuối.

## Bằng chứng kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| Cú pháp PHP của mã ứng dụng, config, migrations, tests và entrypoint | 289 file, 0 lỗi |
| Cú pháp JavaScript trong `public` | 28 file, 0 lỗi |
| Bộ regression cô lập `phpunit.isolated.xml` | 63 tests, 649 assertions, qua toàn bộ |
| Boot kernel thật, nạp package và phản chiếu handler route | 213 route, gồm 191 route ứng dụng; không có method/file bị thiếu |
| Render Blade Admin/Staff và kiểm tra asset được tham chiếu | Thành công |
| 6 migration chạy mỗi migration 2 lần trên SQLite | Thành công; dữ liệu định danh khách cũ còn nguyên, người tạo vẫn null, hạn mức mặc định 0 |
| Danh mục bài viết/404, tên `0`, cấu hình worker production | Thành công |
| 3 bộ smoke test giao diện Staff, cấp gói và Quản Lý CTV | Thành công; DOM/fetch được giả lập |
| `bash -n update.sh` và 5 kịch bản script với git/Composer/PHP giả lập | Thành công: repo bẩn, thiếu lock, pull lỗi, install lỗi, đường thành công |
| `git diff --check` với cấu hình CRLF phù hợp | Không có lỗi whitespace |

Các con số trên áp dụng cho những kiểm tra đã chạy, không có nghĩa mọi thao tác nghiệp vụ của mọi controller đã được thực thi. Hai ExampleTest mặc định không nằm trong bộ regression cô lập. Test mock SQL xác minh luồng xử lý câu lệnh/lỗi, không thay thế việc nhập schema trên MySQL. Phần bootstrap dùng provider/route của repo và package discovery của dependency mượn; không dùng database hay `.env` thật.

## Đường kiểm chứng tiếp theo

1. Tạo bản phát hành với dependency cố định trên môi trường PHP/Linux dự kiến sử dụng. Chạy Composer validate, install, check-platform-reqs và audit; xử lý các lỗi thay vì chỉ tắt audit. Giữ lock file trong Git.
2. Sao lưu và thử khôi phục database thật thành bản sao staging. Kiểm chứng nâng cấp từ schema đang dùng và cài mới trên database trống. Migration charset mới là `2026_10_08_000001_allow_staff_unicode_text.php`.
3. Trên staging, chạy `php artisan migrate --force`, `php artisan optimize:clear`, kiểm tra đăng nhập Admin/Staff/User, hạn mức, gán/chuyển khách, gói được cấp/thu hồi, nhật ký, emoji, URL/QR và đồng bộ subscription.
4. Thử 2 request tạo khách song song khi còn 1 chỗ, thu hồi gói khi đang đổi gói và lỗi ghi nhật ký. Kiểm chứng bằng MySQL và Redis thật; SQLite không chứng minh được các cơ chế khóa này.
5. Chạy scheduler/worker, kiểm chứng thanh toán và webhook bằng môi trường thử của nhà cung cấp. Sau khi các bước này qua, triển khai trong cửa sổ bảo trì với backup database và commit trước nâng cấp để có đường quay lại.

Tại thời điểm hoàn tất đợt rà soát, các thay đổi chỉ nằm tại workspace; chưa commit/push và chưa thao tác database hay server production. Bản test sau đó được chuẩn bị trên nhánh `test/ctv-20261008`; hướng dẫn và giới hạn triển khai nằm tại [README-TEST.md](../README-TEST.md). Bản backup GitHub trước khi sửa Staff vẫn là nguồn code gốc; khôi phục schema/dữ liệu sau triển khai cần thêm backup database.

## Chạy lại các kiểm tra

Khi đã cài dependency đúng dự án:

```bash
vendor/bin/phpunit -c phpunit.isolated.xml
php tests/deployment-boot-smoke.php
node tests/staff-ui-smoke.js
node tests/staff-plan-admin-ui-smoke.js
node tests/ctv-admin-ui-smoke.js
python tests/update-script-smoke.py
bash -n update.sh
```

`deployment-boot-smoke.php` dùng SQLite bộ nhớ và cache/view trong `artifacts/deployment-review`; không đọc `.env` của site. `update-script-smoke.py` chỉ chạy các lệnh giả lập trong fixture, không pull hay migrate repo thật. Bản kiểm thử Windows hiện tại dùng `V2PRO_TEST_AUTOLOAD` trỏ tới autoload có sẵn bên ngoài repo; đó là hạn chế đã nêu ở trên.
