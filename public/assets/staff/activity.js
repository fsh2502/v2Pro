(function () {
    'use strict';
    const fields = { email: 'Email', remarks: 'Ghi chú', u: 'Tải lên (GB)', d: 'Tải xuống (GB)', transfer_enable: 'Tổng (GB)',
        expired_at: 'Hết hạn', banned: 'Trạng thái', speed_limit: 'Tốc độ (Mbps)', device_limit: 'Số thiết bị',
        staff_plan_id: 'Gói Staff (ID)', plan_id: 'Gói chính (ID)', group_id: 'Nhóm máy chủ (ID)',
        staff_owner_id: 'CTV phụ trách', staff_creator_id: 'CTV đã tạo', staff_customer_limit: 'Hạn mức khách hàng',
        staff_app_name: 'appName', is_staff: 'Quyền Staff', is_admin: 'Quyền Admin', password: 'Mật khẩu',
        subscription: 'UUID / URL đăng ký', allowed_plan_ids: 'Các gói được phép (ID)', name: 'Tên gói', enabled: 'Trạng thái gói' };
    const actions = { 'customer.create': 'Tạo khách hàng', 'customer.update': 'Chỉnh sửa khách hàng', 'customer.delete': 'Xóa khách hàng',
        'customer.reset': 'Đặt lại UUID / URL', 'staff.update': 'Thiết lập CTV', 'staff.delete': 'Xóa CTV',
        'staff.personalize': 'Đổi appName', 'staff.plans': 'Cấp quyền dùng gói', 'plan.create': 'Tạo gói CTV', 'plan.update': 'Chỉnh sửa gói CTV' };
    const date = value => value == null ? '—' : new Date(Number(value) * 1000).toLocaleString('vi-VN', { hour12: false });
    function value(key, data) {
        if (key === 'expired_at') return data == null || Number(data) === 0 ? 'Không giới hạn' : date(data);
        if (key === 'staff_plan_id' && data == null) return 'Không có gói Staff';
        if (key === 'staff_app_name' && data == null) return 'Dùng mã CTV';
        if (data == null) return '—';
        if (['u', 'd', 'transfer_enable'].includes(key)) return (Number(data) / 1073741824).toFixed(3);
        if (key === 'banned') return Number(data) ? 'Đã khóa' : 'Hoạt động';
        if (['is_staff', 'is_admin', 'enabled'].includes(key)) return Number(data) ? 'Bật' : 'Tắt';
        if (['staff_owner_id', 'staff_creator_id'].includes(key)) return 'STF-' + String(data).padStart(6, '0');
        if (Array.isArray(data)) return data.length ? data.join(', ') : 'Không có';
        return String(data);
    }
    const changes = row => Object.entries(row.changes || {}).map(([key, change]) =>
        (fields[key] || key) + ': ' + value(key, change.before) + ' → ' + value(key, change.after));
    function render(container, rows) {
        const table = document.createElement('table'); table.className = 'ant-table activity-table';
        const head = document.createElement('thead'); head.className = 'ant-table-thead';
        const tr = document.createElement('tr');
        for (const title of ['Người thực hiện / Thời gian', 'Đối tượng', 'Thao tác', 'Thay đổi']) {
            const th = document.createElement('th'); th.textContent = title; tr.append(th);
        }
        head.append(tr); table.append(head);
        const body = document.createElement('tbody'); body.className = 'ant-table-tbody';
        for (const row of rows) {
            const tr = document.createElement('tr');
            const who = document.createElement('td'), actor = document.createElement('strong'), time = document.createElement('div');
            actor.className = 'activity-actor'; actor.textContent = row.actor_label; time.textContent = date(row.created_at); who.append(actor, time); tr.append(who);
            for (const content of [row.target_label, actions[row.action] || row.action]) {
                const td = document.createElement('td'); td.textContent = content; tr.append(td);
            }
            const td = document.createElement('td'), details = document.createElement('details'), summary = document.createElement('summary');
            details.className = 'activity-details'; summary.textContent = 'Xem ' + Object.keys(row.changes || {}).length + ' thay đổi'; details.append(summary);
            const list = document.createElement('ul');
            for (const line of changes(row)) { const item = document.createElement('li'); item.textContent = line; list.append(item); }
            details.append(list); td.append(details); tr.append(td); body.append(tr);
        }
        if (!rows.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 4; td.textContent = 'Chưa có lịch sử thao tác phù hợp.'; tr.append(td); body.append(tr); }
        table.append(body); container.replaceChildren(table);
    }
    window.CtvActivity = { date, changes, render, action: key => actions[key] || key };
})();
