# Thành phần và nguồn tài nguyên

v2Pro Pro giữ nguyên giấy phép MIT và thông báo bản quyền upstream trong [LICENSE](LICENSE). Không thay tên chủ sở hữu trong giấy phép gốc.

Dependency PHP được xác định bằng `composer.lock`; giấy phép từng gói nằm trong metadata và thư mục `vendor` sau khi cài. Dependency frontend được xác định bằng `frontend/ios-glass/package-lock.json`. Các thông báo cho thư viện frontend đã đóng gói và font Inter nằm trong `public/theme/ios-glass/THIRD-PARTY-LICENSES.txt` và `public/theme/ios-glass/INTER-LICENSE.txt`; giữ chúng khi phân phối theme.

Biểu tượng ứng dụng chỉ phục vụ nhận diện ứng dụng đồng bộ. Nhãn hiệu và artwork thuộc chủ sở hữu tương ứng. Nguồn tải không đồng nghĩa có giấy phép phân phối thương mại. Kiểm tra quyền sử dụng hoặc thay artwork bằng tài nguyên được cấp phép trước khi bán.

Nguồn và đường dẫn từng icon được ghi bên dưới để thông tin vẫn có trong ZIP phát hành (ZIP không kèm frontend phát triển).

# Nguồn biểu tượng ứng dụng

Cập nhật ngày 2026-10-11. Icon chỉ nhận diện ứng dụng trong danh sách đồng bộ; nhãn hiệu và artwork thuộc chủ sở hữu tương ứng.

## App Store

Ảnh tải trực tiếp từ `artworkUrl512` trong Apple iTunes Lookup/Search API, lưu cùng theme; trình duyệt khách không gửi yêu cầu tới Apple.

| File | Trang ứng dụng | Nhà phát triển |
| --- | --- | --- |
| happ.jpg | [Happ – Proxy Utility](https://apps.apple.com/us/app/happ-proxy-utility/id6504287215) | Flyfrog LLC |
| karing.jpg | [Karing](https://apps.apple.com/us/app/karing/id6472431552) | Supernova Nebula LLC |
| v2box.jpg | [V2Box – V2ray Client](https://apps.apple.com/us/app/v2box-v2ray-client/id6446814690) | techlaim |
| incy.jpg | [incy](https://apps.apple.com/us/app/incy/id6756943388) | LLC ITDEV |
| hiddify.jpg | [Hiddify Proxy & VPN](https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532) | Holistic Resilience |
| loon.jpg | [Loon](https://apps.apple.com/us/app/loon/id1373567447) | Loon Lab Limited |
| quantumultx.jpg | [Quantumult X](https://apps.apple.com/us/app/quantumult-x/id1443988620) | Cross Utility Ltd |
| sing-box.jpg | [sing-box MT](https://apps.apple.com/us/app/sing-box-mt/id6785326793) | Metamerism LLC |

Trang sing-box trên App Store được đối chiếu bằng liên kết từ [tài liệu chính thức SagerNet](https://sing-box.sagernet.org/clients/apple/).

## EZ-Theme

Các ảnh còn lại lấy từ [EZ-Theme/src/assets/images](https://github.com/fsh2502/EZ-Theme/tree/10dfdba30d7019648b22439d51622a9162dea818/src/assets/images), revision `10dfdba30d7019648b22439d51622a9162dea818`. README upstream ghi ISC License. Không khẳng định các ảnh này đã được tải trực tiếp từ App Store/Google Play.

| File | Đường dẫn gốc trong src/assets/images |
| --- | --- |
| shadowrocket.png | client-img-ios/shadowrocket.png |
| surge.png | client-img-ios/Surge.png |
| stash.png | client-img-ios/stash.png |
| flclash.png | client-img-windows/flclash.png |
| v2rayng.png | client-img-android/v2rayng.png |
| clash.png | client-img-android/clash.png |
| surfboard.png | client-img-android/surfboard.png |
| clash-meta.png | client-img-android/clashmeta.png |
| nekobox.png | client-img-android/nekobox.png |
| clashverge.png | client-img-windows/clashverge.png |
| nekoray.png | client-img-windows/nekoray.png |
| clashx.png | client-img-macos/clashx.png |
| clashx-meta.jpg | client-img-macos/clashmetax.png (file gốc là JPEG, chỉ sửa phần mở rộng) |

Giữ ảnh nguyên bản, không đổi màu trong chế độ tối. Vite đóng gói với hash hoặc data URL; không dùng liên kết ảnh từ xa trong giao diện.
