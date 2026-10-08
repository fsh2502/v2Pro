<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Staff · {{ $title }}</title>
    <link rel="stylesheet" href="/assets/admin/components.chunk.css?v={{ config('app.version') }}">
    <link rel="stylesheet" href="/assets/admin/umi.css?v={{ config('app.version') }}">
    <link rel="stylesheet" href="/assets/admin/theme/{{ $theme_color }}.css?v={{ config('app.version') }}">
    <link rel="stylesheet" href="/assets/staff/staff.css?v={{ config('app.version') }}">
    <script src="/assets/admin/qrcode.async.js?v={{ config('app.version') }}" defer></script>
    <script src="/assets/staff/qr.js?v={{ config('app.version') }}" defer></script>
    <script src="/assets/staff/activity.js?v={{ config('app.version') }}" defer></script>
    <script src="/assets/staff/staff.js?v={{ config('app.version') }}" defer></script>
</head>
<body>
<div id="page-container" class="sidebar-o {{ $theme_sidebar === 'dark' ? 'sidebar-dark' : '' }} {{ $theme_header === 'dark' ? 'page-header-dark' : '' }} side-scroll page-header-fixed main-content-boxed">
    <nav id="sidebar">
        <div class="smini-hidden bg-header-dark"><div class="content-header justify-content-lg-center bg-black-10"><span id="app-name" class="font-size-lg text-white">Staff</span></div></div>
        <div id="staff-navigation" class="content-side content-side-full" hidden>
            <ul class="nav-main">
                <li class="nav-main-heading">Cài đặt</li>
                <li class="nav-main-item"><button id="nav-personalization" class="nav-main-link" type="button"><i class="nav-main-link-icon si si-settings"></i><span class="nav-main-link-name">Cá nhân hóa</span></button></li>
                <li class="nav-main-heading">Nhân viên</li>
                <li class="nav-main-item"><button id="nav-customers" class="nav-main-link active" type="button"><i class="nav-main-link-icon si si-users"></i><span class="nav-main-link-name">Quản lý khách hàng</span></button></li>
                <li class="nav-main-item"><button id="nav-history" class="nav-main-link" type="button"><i class="nav-main-link-icon si si-clock"></i><span class="nav-main-link-name">Lịch sử thao tác</span></button></li>
            </ul>
            <div class="staff-identity">Mã nhân viên<strong id="staff-code"></strong></div>
        </div>
        <div class="v2board-copyright">v2Pro · Staff</div>
    </nav>
    <header id="page-header"><div class="content-header" style="max-width:unset">
        <button id="toggle-navigation" class="btn mr-2 d-lg-none" type="button" aria-label="Mở menu"><i class="fa fa-bars"></i></button>
        <div id="page-title" class="v2board-container-title">Quản lý khách hàng</div>
        <button id="logout" class="btn" hidden>Đăng xuất <i class="fa fa-sign-out-alt ml-1"></i></button>
    </div></header>
<main id="main-container"><div class="p-3 p-lg-4">
    <p id="message" role="status" aria-live="polite" hidden></p>
    <section id="login-panel" class="block staff-card">
        <h2>Đăng nhập nhân viên</h2>
        <form id="login-form">
            <label>Email<input class="ant-input" name="email" type="email" autocomplete="username" required></label>
            <label>Mật khẩu<input class="ant-input" name="password" type="password" autocomplete="current-password" required></label>
            <button class="ant-btn ant-btn-primary" type="submit">Đăng nhập</button>
        </form>
    </section>
    <div id="workspace" hidden>
        <section id="personalization" class="block staff-card" hidden>
            <h2>Cá nhân hóa</h2>
            <p class="text-muted">Đặt tên ứng dụng riêng cho khách hàng của bạn.</p>
            <form id="personalization-form">
                <label>Tên ứng dụng (appName)<input class="ant-input" name="app_name" type="text" maxlength="64" required autocomplete="off" aria-describedby="app-name-hint"></label>
                <small id="app-name-hint">Tên này được gửi trong subscription khi khách hàng đồng bộ vào ứng dụng. Mỗi Staff có tên riêng.</small>
                <div class="staff-name-preview"><span class="text-muted">Tên gửi khi đồng bộ</span><strong id="app-name-preview"></strong></div>
                <button class="ant-btn ant-btn-primary" type="submit">Lưu tên ứng dụng</button>
            </form>
        </section>
        <section id="customers">
            <div id="quota" class="staff-quota">
                <div>
                    <span class="ant-tag ant-tag-blue">STAFF</span> <strong id="quota-staff-code"></strong>
                    <div class="staff-quota-subtitle">Khách hàng do bạn tạo và đang quản lý</div>
                </div>
                <div class="staff-quota-summary">
                    <div class="staff-quota-heading"><span>Hạn mức khách hàng</span><strong id="quota-count">— / —</strong></div>
                    <div id="quota-progress" class="staff-quota-track" role="progressbar" aria-label="Hạn mức khách hàng" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><span id="quota-fill"></span></div>
                    <div id="quota-remaining" class="staff-quota-subtitle">Hạn mức do Admin thiết lập</div>
                </div>
            </div>
            <div class="block staff-card">
            <div class="toolbar"><h2>Khách hàng do tôi tạo</h2><button class="ant-btn ant-btn-primary" id="new-customer">Tạo khách hàng</button></div>
            <form id="search-form" class="toolbar"><input class="ant-input" name="search" aria-label="Tìm khách hàng" placeholder="Email, ID hoặc mã khách hàng"><button class="ant-btn ant-btn-primary" type="submit">Tìm kiếm</button></form>
            <div class="table-scroll"><table class="ant-table"><thead class="ant-table-thead"><tr><th>Mã khách hàng</th><th>Email</th><th>Đã dùng (GB)</th><th>Tổng (GB)</th><th>Ngày đăng ký</th><th>Gói Staff</th><th>Hết hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="customer-rows" class="ant-table-tbody"></tbody></table></div>
            <div class="toolbar"><button class="ant-btn" id="previous">Trang trước</button><span id="page-info"></span><button class="ant-btn" id="next">Trang sau</button></div>
            </div>
        </section>
        <section id="activity-history" class="block staff-card" hidden>
            <h2>Lịch sử thao tác</h2>
            <p class="text-muted">Các thay đổi của tài khoản CTV và khách hàng trong phạm vi của bạn.</p>
            <form id="activity-search-form" class="toolbar"><input class="ant-input" name="search" aria-label="Tìm lịch sử thao tác" placeholder="Email, ID hoặc mã khách hàng"><button class="ant-btn ant-btn-primary" type="submit">Tìm kiếm</button></form>
            <div id="activity-rows" class="table-scroll"></div>
            <div class="toolbar"><button id="activity-previous" class="ant-btn" disabled>Trang trước</button><span id="activity-page"></span><button id="activity-next" class="ant-btn" disabled>Trang sau</button></div>
        </section>
    </div>
    <div id="customer-menu" class="ant-dropdown staff-customer-menu" hidden>
        <ul class="ant-dropdown-menu" role="menu" aria-label="Tùy chọn khách hàng">
            <li role="none"><button id="action-edit" role="menuitem"><i class="far fa-edit"></i>Chỉnh sửa</button></li>
            <li role="none"><button id="action-copy" role="menuitem"><i class="far fa-copy"></i>Sao chép URL</button></li>
            <li role="none"><button id="action-qr" role="menuitem"><i class="fa fa-qrcode"></i>Hiện mã QR</button></li>
            <li role="none"><button id="action-reset" role="menuitem"><i class="fa fa-redo"></i>Đặt lại UUID đăng ký</button></li>
            <li role="none"><button id="action-traffic" role="menuitem"><i class="far fa-calendar-alt"></i>Lịch sử Data</button></li>
            <li role="none"><button id="action-history" role="menuitem"><i class="fa fa-history"></i>Lịch sử thao tác</button></li>
            <li role="none"><button id="action-delete" role="menuitem"><i class="far fa-trash-alt"></i>Xóa người dùng</button></li>
        </ul>
    </div>
    <dialog id="customer-detail-dialog" aria-labelledby="customer-detail-title">
        <h2 id="customer-detail-title"></h2><p id="customer-detail-code"></p>
        <p id="customer-detail-error" class="form-error" role="alert" hidden></p>
        <div id="customer-detail-content"></div>
        <div id="customer-detail-pagination" class="toolbar" hidden><button id="detail-previous" class="ant-btn">Trang trước</button><span id="detail-page"></span><button id="detail-next" class="ant-btn">Trang sau</button></div>
        <button id="close-customer-detail" class="ant-btn">Đóng</button>
    </dialog>
    <dialog id="customer-dialog" aria-labelledby="customer-title">
        <form id="customer-form">
            <div class="staff-editor-header"><h2 id="customer-title">Khách hàng</h2><p id="customer-code"></p></div>
            <div class="staff-editor-body">
            <p id="customer-error" class="form-error" role="alert" hidden></p>
            <input name="id" type="hidden">
            <label>Email<input class="ant-input" name="email" type="email" maxlength="64" required></label>
            <label>Mật khẩu<input class="ant-input" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password"><small id="password-hint">Tối thiểu 8 ký tự.</small></label>
            <div class="staff-editor-row">
                <label>Đã dùng tải lên (GB)<input class="ant-input" name="u" type="number" min="0" step="any" required></label>
                <label>Đã dùng tải xuống (GB)<input class="ant-input" name="d" type="number" min="0" step="any" required></label>
            </div>
            <label>Dung lượng (GB)<input class="ant-input" name="transfer_enable" type="number" min="0" step="any" required></label>
            <label>Gói Staff<select id="customer-plan" class="ant-input" name="staff_plan_id"><option value="">Không có gói Staff</option></select><small>Chỉ các gói riêng được Admin cấp cho bạn. Chọn gói sẽ điền dung lượng và tốc độ mặc định; ngày hết hạn và lưu lượng đã dùng được giữ lại.</small></label>
            <label>Ngày hết hạn<input class="ant-input" name="expired_at" type="datetime-local"><small>Để trống để không giới hạn thời gian.</small></label>
            <label id="ban-field">Trạng thái tài khoản<select class="ant-input" name="banned"><option value="0">Hoạt động</option><option value="1">Đã khóa</option></select></label>
            <label>Giới hạn tốc độ (Mbps)<input class="ant-input" name="speed_limit" type="number" min="0" max="2147483647" step="1" placeholder="Để trống nếu không giới hạn"></label>
            <label>Ghi chú<textarea class="ant-input" name="remarks" maxlength="2000" rows="3"></textarea></label>
            </div>
            <div class="staff-editor-footer"><button type="button" class="ant-btn" id="cancel-customer">Hủy</button><button class="ant-btn ant-btn-primary" type="submit">Lưu khách hàng</button></div>
        </form>
    </dialog>
</div></main>
</div>
</body>
</html>
