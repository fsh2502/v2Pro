# iOS Glass — theme khách hàng v2Pro

Theme độc lập lấy cảm hứng từ ba ảnh demo sáng/tối, desktop/mobile. React + TypeScript + Vite, CSS kính, icon Lucide và QR thật từ URL đồng bộ. Tài nguyên đã build được lưu trong `public/theme/ios-glass/assets`; VPS không cần Node để chạy theme.

## Chạy xem thử tại máy phát triển

Yêu cầu Node 22.12+ hoặc phiên bản tương thích Vite 8.

```bash
cd frontend/ios-glass
npm ci
npm test
npm run build
npm run preview:demo
```

Mở `http://127.0.0.1:8780/`. Server chỉ nghe trên loopback. **Dữ liệu xem thử được tạo trong bộ nhớ**, không dùng database, không gửi email/Telegram, không thanh toán. Bộ mô phỏng nằm trong `demo/`; entry Blade của website thật không tải mã mô phỏng hoặc tự đăng nhập.

Các tình huống kiểm tra:

- `/?appearance=dark`: giao diện tối.
- `/?fixture=login#/login`: biểu mẫu đăng nhập; dữ liệu bất kỳ chỉ được mô phỏng ở server demo.
- `/?fixture=empty`: tài khoản chưa có gói, chưa có lưu lượng/đơn hàng.
- `/?fixture=outage`: lỗi API; giữ phiên và hiển thị nút thử lại.
- `/?fixture=expired`: phiên hết hạn; trở về đăng nhập.
- Mã giảm giá demo hợp lệ: `GLASS`; các mã khác trả lỗi.

## Cài trên website test aaPanel

Đưa toàn bộ `public/theme/ios-glass/` và hai thay đổi PHP kèm commit lên VPS. Không đưa `node_modules`, server demo hoặc mật khẩu mẫu vào thư mục public.

```bash
cd /www/wwwroot/v2pro-test
git pull --ff-only origin test/ctv-20261008
php artisan config:cache
php artisan view:clear
```

Trong **Admin → Giao diện**, chọn **iOS Glass** làm giao diện khách hàng, sau đó tải lại trang khách hàng `/`. Có thể cấu hình giao diện mặc định và lời chào. Khách có thể chọn Sáng/Tối/Theo thiết bị tại Tài khoản → Giao diện; lựa chọn lưu trên thiết bị đó. Muốn quay lại, chọn theme cũ tại Admin, không cần đổi database.

Các file tài nguyên có hash và được Blade đọc từ `manifest.json`, tránh dùng nhầm JavaScript/CSS của bản build cũ. Upload một bộ build đầy đủ cùng manifest; không trộn tài nguyên của hai lần build. Cài đặt theme không đổi đường dẫn hoặc giao diện Admin/CTV.

## Luồng API

- Đăng nhập, đăng ký, quên mật khẩu, mã email, reCAPTCHA nếu máy chủ yêu cầu; đăng nhập qua `verify`.
- Tổng quan từ `info`, `getSubscribe`, lịch sử lưu lượng; không tạo số liệu khi API lỗi.
- Đồng bộ 21 ứng dụng theo danh sách EZ-Theme, chia theo iOS/Android/Windows/macOS. URL sao chép và QR dùng định dạng cấu hình của ứng dụng đã chọn. Tên cấu hình lấy `profile_name` theo appName của CTV; QR là URL thật và cần được giữ riêng tư.
- Danh mục gói, chọn chu kỳ, kiểm tra mã giảm giá, tạo/hủy đơn, QR hoặc chuyển trang thanh toán, xác nhận đơn miễn phí và kiểm tra trạng thái.
- Thông báo, bài hướng dẫn tiếng Việt (Markdown/HTML qua DOMPurify), máy chủ được cấp.
- Ticket tạo/đọc/trả lời/đóng, đổi mật khẩu, nhắc hạn/lưu lượng, ví/nạp tiền, thẻ quà tặng, mời bạn bè và kết thúc phiên.

Theme dùng JWT và middleware hiện có; chỉ lỗi xác thực đã xác định mới xóa phiên. Lỗi mạng/503/403 nghiệp vụ không tự đăng xuất. Mật khẩu không được lưu trong frontend. Font hệ thống Apple trên iOS/macOS; Inter Variable tự lưu trữ (kèm tập ký tự tiếng Việt) trên các nền tảng khác. Không phân phối font SF của Apple.

## Giới hạn kiểm thử

Luồng UI và API fixture được kiểm tra tại localhost. Trước khi bật trên website chính, kiểm tra lại API thật, CAPTCHA/email, ticket/Telegram, thanh toán và import trên ứng dụng đã cài. Cổng `StripeCredit` dùng form thẻ riêng của panel cũ chưa được hỗ trợ trong phiên bản theme này; không dùng theme này làm giao diện thanh toán chính nếu website phụ thuộc phương thức đó. Các phương thức QR/chuyển trang thanh toán vẫn được nối API. Việc mở ứng dụng phụ thuộc ứng dụng/phiên bản/hệ điều hành của khách.

Nguồn định dạng import: [Hiddify](https://github.com/hiddify/hiddify-app/wiki/URL-Scheme), [Sing-box](https://sing-box.sagernet.org/clients/general/). Shadowrocket theo định dạng import đang dùng trong theme gốc của repo.

## Danh sách ứng dụng đồng bộ

Đối chiếu [EZ-Theme Dashboard.vue](https://github.com/fsh2502/EZ-Theme/blob/10dfdba30d7019648b22439d51622a9162dea818/src/views/dashboard/Dashboard.vue). Các biến thể nền tảng dùng chung một ứng dụng trong `src/clients.ts`:

- iOS: Shadowrocket, Surge, Stash, Quantumult X, Hiddify, Sing-box, Loon, Happ, Karing, V2BOX, Incy.
- Android: FlClash, v2rayNG, Clash, Surfboard, Clash Meta, NekoBox, Sing-box, Hiddify, Happ, Karing, V2BOX, Incy.
- Windows: FlClash, Clash Verge, Clash, Nekoray, Sing-box, Hiddify, Happ, Karing.
- macOS: FlClash, Clash Verge, ClashX, ClashX Meta, Surge, Stash, Quantumult X, Sing-box, Hiddify, Happ, Karing.

Flag được ánh xạ sang exporter hiện có của v2Pro: FlClash/Clash Meta/ClashX Meta/NekoBox dùng `meta`; Clash Verge dùng `verge`; Karing/Nekoray dùng `general`; Incy dùng `incy&raw=1`. Không gửi URL đăng ký tới dịch vụ chuyển đổi bên ngoài.

NekoBox Android có handler `clash://install-config` trong [mã nguồn ứng dụng](https://github.com/MatsuriDayo/NekoBoxForAndroid/blob/main/app/src/main/AndroidManifest.xml). Nekoray được hỗ trợ qua sao chép/QR và hướng dẫn thêm nhóm đăng ký, vì [upstream](https://github.com/MatsuriDayo/nekoray) không có handler hệ điều hành cho `clash://install-config`; theme không giả lập nút mở ứng dụng cho trường hợp này.

Kiểm thử tự động bao phủ danh sách theo nền tảng, flag, query/token, tên Unicode, URL không an toàn và deep link của từng ứng dụng. Cần kiểm tra nhập cấu hình thực tế trên ứng dụng đã cài; bộ kiểm thử URL không xác nhận kết nối VPN hay khả năng hỗ trợ từng giao thức node của client.
