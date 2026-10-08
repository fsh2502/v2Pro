(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const tokenKey = 'v2pro_staff_auth';
    let token = sessionStorage.getItem(tokenKey), page = 1, search = '', customerTotal = 0;
    let selectedCustomer = null, menuTrigger = null, detailState = null;
    let originalTraffic = {};
    let originalStaffPlan = '', availablePlans = [];
    let activityPage = 1, activityTotal = 0, activitySearch = '';
    const bytesPerGb = 1073741824;
    function message(text, error = false) {
        $('message').textContent = text;
        $('message').className = error ? 'error' : '';
        $('message').hidden = false;
        if (error && $('customer-dialog').open) {
            $('customer-error').textContent = text;
            $('customer-error').hidden = false;
        }
        if (error && $('customer-detail-dialog').open) {
            $('customer-detail-error').textContent = text;
            $('customer-detail-error').hidden = false;
        }
    }
    function signOut() {
        token = null;
        sessionStorage.removeItem(tokenKey);
        $('workspace').hidden = true;
        $('logout').hidden = true;
        $('staff-navigation').hidden = true;
        $('personalization-form').reset();
        $('app-name').textContent = 'Staff';
        $('app-name-preview').textContent = '';
        document.title = 'Staff';
        $('login-panel').hidden = false;
        $('customer-dialog').close();
        closeMenu(); closeDetail();
        $('customer-form').reset();
        availablePlans = [];
        $('customer-plan').replaceChildren(new Option('Không có gói Staff', ''));
        $('customer-rows').replaceChildren();
        page = 1; search = ''; customerTotal = 0; $('search-form').reset();
        $('activity-rows').replaceChildren();
        $('activity-search-form').reset(); activityPage = 1; activitySearch = ''; activityTotal = 0;
        $('quota-staff-code').textContent = '';
        $('quota-count').textContent = '— / —';
        $('quota-remaining').textContent = 'Hạn mức do Admin thiết lập';
        $('quota-fill').style.width = '0%';
        $('quota-progress').setAttribute('aria-valuemax', '0');
        $('quota-progress').setAttribute('aria-valuenow', '0');
        $('quota-progress').setAttribute('aria-valuetext', '');
    }
    async function api(path, data, publicRoute = false) {
        const response = await fetch('/api/v1/' + (publicRoute ? '' : 'staff/') + path, {
            method: data ? 'POST' : 'GET',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token && !publicRoute ? { Authorization: token } : {}) },
            ...(data ? { body: JSON.stringify(data) } : {})
        });
        const body = await response.json();
        if (!response.ok || (body.code && body.code !== 200)) {
            if (response.status === 403 && !publicRoute) signOut();
            const errors = body.errors ? Object.values(body.errors).flat().join('\n') : '';
            throw new Error(errors || body.message || 'Không thể thực hiện thao tác.');
        }
        return body;
    }
    function task(fn) {
        return async event => {
            if (event) event.preventDefault();
            $('customer-error').hidden = true;
            const button = event && (event.submitter || (event.currentTarget.tagName === 'BUTTON' ? event.currentTarget : null));
            if (button) button.disabled = true;
            try { await fn(event); } catch (error) { message(error.message, true); }
            finally {
                if (button) {
                    button.disabled = button.id === 'detail-previous' ? !detailState || detailState.page <= 1
                        : button.id === 'detail-next' ? !detailState || detailState.page * 20 >= (detailState.total || 0)
                        : button.id === 'previous' ? page <= 1
                        : button.id === 'next' ? page * 20 >= customerTotal
                        : button.id === 'new-customer' ? Number($('quota-progress').getAttribute('aria-valuenow')) >= Number($('quota-progress').getAttribute('aria-valuemax'))
                        : button.id === 'activity-previous' ? activityPage <= 1
                        : button.id === 'activity-next' ? activityPage * 20 >= activityTotal : false;
                }
            }
        };
    }
    function cell(row, value) {
        const td = document.createElement('td');
        td.textContent = value == null ? '' : String(value);
        row.append(td);
        return td;
    }
    function taggedCell(row, text, red) {
        const tag = document.createElement('span');
        tag.className = 'ant-tag ' + (red ? 'ant-tag-red' : 'ant-tag-green');
        tag.textContent = text;
        cell(row, '').append(tag);
    }
    async function summary() {
        const { data } = await api('user/summary');
        $('quota-staff-code').textContent = data.staff_code;
        $('quota-count').textContent = data.customer_count + ' / ' + data.customer_limit;
        $('quota-remaining').textContent = 'Còn ' + data.remaining + ' chỗ · Hạn mức do Admin thiết lập';
        const used = Math.min(data.customer_count, data.customer_limit);
        $('quota-fill').style.width = (data.customer_limit > 0 ? used / data.customer_limit * 100 : 0) + '%';
        $('quota-progress').setAttribute('aria-valuemax', String(data.customer_limit));
        $('quota-progress').setAttribute('aria-valuenow', String(used));
        $('quota-progress').setAttribute('aria-valuetext', data.customer_count + ' / ' + data.customer_limit + ' khách hàng');
        $('new-customer').disabled = data.remaining === 0;
    }
    function tableDate(value) {
        if (!value) return '—';
        const date = new Date(Number(value) * 1000);
        if (Number.isNaN(date.getTime())) return '—';
        const pad = number => String(number).padStart(2, '0');
        return date.getFullYear() + '/' + pad(date.getMonth() + 1) + '/' + pad(date.getDate()) +
            ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
    const expiryText = value => value == null ? 'Không giới hạn' : tableDate(value);
    const trafficText = value => (Number(value || 0) / bytesPerGb).toFixed(2);
    function localDate(value) {
        if (value == null) return '';
        const date = new Date(value * 1000);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    async function customers() {
        closeMenu();
        const { data, total } = await api('user/fetch?current=' + page + '&pageSize=20&search=' + encodeURIComponent(search));
        customerTotal = total;
        const body = $('customer-rows'); body.replaceChildren();
        data.forEach(user => {
            const row = document.createElement('tr');
            cell(row, user.customer_code); cell(row, user.email);
            const used = Number(user.u || 0) + Number(user.d || 0);
            taggedCell(row, trafficText(used), used > Number(user.transfer_enable || 0));
            cell(row, trafficText(user.transfer_enable)); cell(row, tableDate(user.created_at));
            cell(row, user.staff_plan_name ? user.staff_plan_name + ' · ID ' + user.staff_plan_id : 'Không có gói Staff');
            taggedCell(row, expiryText(user.expired_at), user.expired_at != null && Number(user.expired_at) < Date.now() / 1000);
            taggedCell(row, user.banned ? 'Đã khóa' : 'Hoạt động', !!user.banned);
            const actions = cell(row, '');
            const button = document.createElement('button'); button.textContent = 'Chỉnh sửa ▾';
            button.className = 'ant-btn ant-btn-link staff-action-trigger';
            button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
            button.addEventListener('click', event => {
                event.stopPropagation();
                if (menuTrigger === button && !$('customer-menu').hidden) return closeMenu();
                closeMenu(); selectedCustomer = user; menuTrigger = button;
                button.setAttribute('aria-expanded', 'true');
                const rect = button.getBoundingClientRect();
                $('customer-menu').style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 248)) + 'px';
                $('customer-menu').style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - (actionIds.length * 32 + 22))) + 'px';
                $('customer-menu').hidden = false;
                $('action-edit').focus();
            }); actions.append(button);
            body.append(row);
        });
        if (!data.length) {
            const row = document.createElement('tr'); cell(row, 'Chưa có khách hàng có thể chỉnh sửa.').colSpan = 9; body.append(row);
        }
        $('page-info').textContent = 'Trang ' + page + ' · ' + total + ' khách hàng';
        $('previous').disabled = page <= 1; $('next').disabled = page * 20 >= total;
        await summary();
    }
    async function editCustomer(id) {
        const form = $('customer-form'); form.reset(); form.elements.id.value = '';
        originalTraffic = {};
        originalStaffPlan = '';
        const { data: plans } = await api('plan/fetch');
        availablePlans = plans;
        $('customer-plan').replaceChildren(new Option('Không có gói Staff', ''));
        plans.forEach(plan => $('customer-plan').append(new Option(plan.name + ' · ID ' + plan.id, String(plan.id))));
        form.elements.staff_plan_id.value = '';
        $('customer-error').hidden = true;
        for (const name of ['u', 'd', 'transfer_enable']) form.elements[name].value = '0';
        $('customer-title').textContent = id ? 'Chỉnh sửa khách hàng' : 'Tạo khách hàng';
        $('customer-code').textContent = ''; $('ban-field').hidden = !id;
        form.elements.password.required = !id;
        $('password-hint').textContent = id ? 'Để trống để giữ mật khẩu hiện tại.' : 'Tối thiểu 8 ký tự.';
        if (id) {
            const { data: user } = await api('user/getUserInfoById?id=' + id);
            for (const name of ['id', 'email', 'banned', 'remarks', 'speed_limit']) form.elements[name].value = user[name] == null ? '' : user[name];
            for (const name of ['u', 'd', 'transfer_enable']) {
                const bytes = user[name] || 0;
                form.elements[name].value = String(bytes / bytesPerGb);
                originalTraffic[name] = { bytes, displayed: form.elements[name].value };
            }
            form.elements.expired_at.value = localDate(user.expired_at);
            $('customer-code').textContent = user.customer_code;
            originalStaffPlan = user.staff_plan_id == null ? '' : String(user.staff_plan_id);
            if (originalStaffPlan && !plans.some(plan => String(plan.id) === originalStaffPlan)) {
                const current = new Option((user.staff_plan_name || 'Gói hiện tại') + ' (không còn được cấp phép)', originalStaffPlan);
                current.disabled = true; $('customer-plan').append(current);
            }
            form.elements.staff_plan_id.value = originalStaffPlan;
        }
        $('customer-dialog').showModal();
    }
    function closeMenu() {
        $('customer-menu').hidden = true;
        if (menuTrigger) menuTrigger.setAttribute('aria-expanded', 'false');
        menuTrigger = null; selectedCustomer = null;
    }
    function closeDetail() {
        detailState = null;
        $('customer-detail-dialog').close();
        $('customer-detail-content').replaceChildren();
        $('customer-detail-error').hidden = true;
    }
    function openDetail(user, title, type = null) {
        closeDetail(); detailState = { user, type, page: 1 };
        $('customer-detail-title').textContent = title;
        $('customer-detail-code').textContent = user.customer_code + ' · ' + user.email;
        $('customer-detail-pagination').hidden = !type;
        $('customer-detail-dialog').showModal();
        return detailState;
    }
    async function subscription(user, qr) {
        const state = openDetail(user, qr ? 'Hiện mã QR' : 'Sao chép URL');
        const { data } = await api('user/getSubscription?id=' + user.id);
        if (detailState !== state) return;
        if (qr) {
            const container = document.createElement('div'); $('customer-detail-content').append(container);
            window.staffRenderQr(container, data.subscribe_url);
        }
        const input = document.createElement('input'); input.type = 'text'; input.className = 'ant-input';
        input.readOnly = true; input.value = data.subscribe_url; input.setAttribute('aria-label', 'URL subscription');
        $('customer-detail-content').append(input);
        const hint = document.createElement('p'); hint.textContent = qr ? 'Quét mã để nhập subscription vào ứng dụng.' : 'Chọn URL và sao chép để gửi cho khách hàng.';
        $('customer-detail-content').append(hint);
        if (!qr && navigator.clipboard) {
            try { await navigator.clipboard.writeText(data.subscribe_url); hint.textContent = 'Đã sao chép URL subscription.'; }
            catch (_) { input.focus(); input.select(); }
        } else if (!qr) { input.focus(); input.select(); }
    }
    function detailTable(headers, rows) {
        const scroll = document.createElement('div'); scroll.className = 'table-scroll';
        const table = document.createElement('table'), head = document.createElement('thead'), tr = document.createElement('tr');
        headers.forEach(title => { const th = document.createElement('th'); th.textContent = title; tr.append(th); });
        head.append(tr); table.append(head);
        const body = document.createElement('tbody');
        rows.forEach(values => { const row = document.createElement('tr'); values.forEach(value => cell(row, value)); body.append(row); });
        if (!rows.length) { const row = document.createElement('tr'); cell(row, 'Chưa có dữ liệu trong phạm vi bạn quản lý.').colSpan = headers.length; body.append(row); }
        table.append(body); scroll.append(table); $('customer-detail-content').append(scroll);
    }
    async function loadDetail() {
        const state = detailState; if (!state || !state.type) return;
        const requestPage = state.page;
        $('customer-detail-error').hidden = true;
        const response = await api('user/getTrafficLog' +
            '?id=' + state.user.id + '&current=' + state.page + '&pageSize=20');
        if (detailState !== state || state.page !== requestPage) return;
        state.total = response.total;
        $('customer-detail-content').replaceChildren();
        const gb = value => (Number(value || 0) / 1073741824).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
        detailTable(['Ngày', 'Tải lên (GB)', 'Tải xuống (GB)', 'Hệ số'], response.data.map(record => [
            new Date(record.record_at * 1000).toLocaleDateString('vi-VN'), gb(record.u), gb(record.d), record.server_rate,
        ]));
        $('detail-page').textContent = 'Trang ' + state.page + ' · ' + response.total + ' bản ghi';
        $('detail-previous').disabled = state.page <= 1; $('detail-next').disabled = state.page * 20 >= response.total;
    }
    function menuAction(id, action) {
        $(id).addEventListener('click', task(async () => {
            const user = selectedCustomer; if (!user) return;
            closeMenu(); await action(user);
        }));
    }
    function showPage(personalization) {
        closeMenu();
        const history = personalization === 'history', personal = personalization === true;
        $('personalization').hidden = !personal;
        $('customers').hidden = personal || history;
        $('activity-history').hidden = !history;
        $('nav-personalization').className = 'nav-main-link' + (personal ? ' active' : '');
        $('nav-customers').className = 'nav-main-link' + (!personal && !history ? ' active' : '');
        $('nav-history').className = 'nav-main-link' + (history ? ' active' : '');
        $('page-title').textContent = history ? 'Lịch sử thao tác' : personal ? 'Cá nhân hóa' : 'Quản lý khách hàng';
        $('page-container').classList.remove('sidebar-o-xs');
        $('message').hidden = true;
    }
    async function activity() {
        const result = await api('activity/fetch?' + new URLSearchParams({ current: String(activityPage), pageSize: '20', search: activitySearch }));
        activityTotal = result.total;
        window.CtvActivity.render($('activity-rows'), result.data);
        $('activity-page').textContent = 'Trang ' + activityPage + ' · ' + activityTotal + ' thao tác';
        $('activity-previous').disabled = activityPage <= 1;
        $('activity-next').disabled = activityPage * 20 >= activityTotal;
    }
    function applyPersonalization(data) {
        $('app-name').textContent = data.app_name;
        $('staff-code').textContent = data.staff_code;
        $('app-name-preview').textContent = data.app_name;
        $('personalization-form').elements.app_name.value = data.app_name;
        document.title = data.app_name + ' · Staff';
    }
    async function personalization() {
        const { data } = await api('personalization/fetch');
        applyPersonalization(data);
    }
    async function enter() {
        page = 1; search = ''; $('search-form').reset();
        await customers();
        await personalization();
        $('login-panel').hidden = true; $('workspace').hidden = false; $('logout').hidden = false;
        $('staff-navigation').hidden = false;
        showPage(false);
    }
    $('login-form').addEventListener('submit', task(async () => {
        const { data } = await api('passport/auth/login', Object.fromEntries(new FormData($('login-form'))), true);
        if (!data.is_staff) throw new Error('Tài khoản chưa được cấp quyền Staff.');
        token = data.auth_data; sessionStorage.setItem(tokenKey, token);
        $('login-form').reset(); await enter(); $('message').hidden = true;
    }));
    $('logout').addEventListener('click', task(async () => {
        try { await api('logout', {}); } finally { signOut(); }
    }));
    $('customer-form').addEventListener('submit', task(async () => {
        const data = Object.fromEntries(new FormData($('customer-form')));
        const editing = !!data.id;
        // FormData omits a selected disabled option (a previously assigned,
        // now revoked plan). Read the select directly so ordinary edits retain it.
        data.staff_plan_id = $('customer-form').elements.staff_plan_id.value;
        if (editing && data.staff_plan_id === originalStaffPlan) delete data.staff_plan_id;
        else {
            data.staff_plan_id = data.staff_plan_id ? Number(data.staff_plan_id) : null;
            if (data.staff_plan_id !== null && (!Number.isInteger(data.staff_plan_id) || data.staff_plan_id < 1)) throw new Error('Gói Staff không hợp lệ.');
        }
        for (const name of ['u', 'd', 'transfer_enable']) {
            const original = originalTraffic[name];
            if (editing && original && data[name] === original.displayed) { delete data[name]; continue; }
            const bytes = Math.round(Number(data[name]) * bytesPerGb);
            if (data[name] === '' || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Dung lượng và lưu lượng phải là số không âm trong phạm vi cho phép.');
            data[name] = bytes;
        }
        data.speed_limit = data.speed_limit === '' ? null : Number(data.speed_limit);
        if (data.speed_limit !== null && (!Number.isInteger(data.speed_limit) || data.speed_limit < 0 || data.speed_limit > 2147483647)) throw new Error('Giới hạn tốc độ phải là số nguyên không âm.');
        data.expired_at = data.expired_at ? Math.floor(new Date(data.expired_at).getTime() / 1000) : null;
        if (!data.password) delete data.password;
        if (!editing) { delete data.id; delete data.banned; } else data.banned = Number(data.banned);
        await api(editing ? 'user/update' : 'user/create', data);
        $('customer-dialog').close(); await customers(); message('Đã lưu khách hàng.');
    }));
    $('search-form').addEventListener('submit', task(async () => { search = $('search-form').elements.search.value; page = 1; await customers(); }));
    $('new-customer').addEventListener('click', task(() => editCustomer()));
    $('previous').addEventListener('click', task(async () => { page--; await customers(); }));
    $('next').addEventListener('click', task(async () => { page++; await customers(); }));
    $('cancel-customer').addEventListener('click', () => $('customer-dialog').close());
    $('customer-plan').addEventListener('change', () => {
        const form = $('customer-form'), plan = availablePlans.find(item => String(item.id) === form.elements.staff_plan_id.value);
        if (!plan) return;
        form.elements.transfer_enable.value = String(plan.transfer_enable / bytesPerGb);
        form.elements.speed_limit.value = plan.speed_limit == null ? '' : String(plan.speed_limit);
    });
    menuAction('action-edit', user => editCustomer(user.id));
    menuAction('action-copy', user => subscription(user, false));
    menuAction('action-qr', user => subscription(user, true));
    menuAction('action-reset', async user => {
        if (!confirm('Đặt lại UUID đăng ký của ' + user.email + '? UUID và URL cũ sẽ ngừng hoạt động; khách cần nhập lại subscription mới.')) return;
        await api('user/resetSecret', { id: user.id, confirm: 1 });
        message('Đã đặt lại UUID và URL đăng ký. Hãy gửi subscription mới cho khách hàng.');
    });
    menuAction('action-traffic', async user => { openDetail(user, 'Lịch sử Data', 'traffic'); await loadDetail(); });
    menuAction('action-history', async user => {
        activitySearch = String(user.id); activityPage = 1;
        $('activity-search-form').elements.search.value = activitySearch;
        await activity(); showPage('history');
    });
    menuAction('action-delete', async user => {
        if (!confirm('Xóa người dùng ' + user.email + '? Tài khoản, đơn hàng, vé hỗ trợ và lịch sử Data của khách sẽ bị xóa. Thao tác không thể hoàn tác.')) return;
        await api('user/delUser', { id: user.id, confirm: 1 });
        if ($('customer-rows').children.length === 1 && page > 1) page--;
        await customers(); message('Đã xóa người dùng.');
    });
    $('close-customer-detail').addEventListener('click', closeDetail);
    $('customer-detail-dialog').addEventListener('cancel', closeDetail);
    $('customer-detail-dialog').addEventListener('close', () => { detailState = null; $('customer-detail-content').replaceChildren(); });
    $('detail-previous').addEventListener('click', task(async () => { if (detailState) { detailState.page--; await loadDetail(); } }));
    $('detail-next').addEventListener('click', task(async () => { if (detailState) { detailState.page++; await loadDetail(); } }));
    document.addEventListener('click', event => {
        if (!$('customer-menu').contains(event.target) && !(menuTrigger && menuTrigger.contains(event.target))) closeMenu();
    });
    const actionIds = ['action-edit', 'action-copy', 'action-qr', 'action-reset', 'action-traffic', 'action-history', 'action-delete'];
    $('customer-menu').addEventListener('keydown', event => {
        if (event.key === 'Escape') { const trigger = menuTrigger; closeMenu(); if (trigger) trigger.focus(); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); const index = actionIds.indexOf(event.target.id);
            $(actionIds[(index + (event.key === 'ArrowDown' ? 1 : actionIds.length - 1)) % actionIds.length]).focus();
        }
    });
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    $('nav-personalization').addEventListener('click', task(async () => { await personalization(); showPage(true); }));
    $('nav-customers').addEventListener('click', task(async () => { await customers(); showPage(false); }));
    $('nav-history').addEventListener('click', task(async () => { activitySearch = ''; activityPage = 1; $('activity-search-form').reset(); await activity(); showPage('history'); }));
    $('activity-search-form').addEventListener('submit', task(async () => { activitySearch = $('activity-search-form').elements.search.value; activityPage = 1; await activity(); }));
    $('activity-previous').addEventListener('click', task(async () => { activityPage--; await activity(); }));
    $('activity-next').addEventListener('click', task(async () => { activityPage++; await activity(); }));
    $('toggle-navigation').addEventListener('click', () => $('page-container').classList.toggle('sidebar-o-xs'));
    $('personalization-form').elements.app_name.addEventListener('input', event => {
        $('app-name-preview').textContent = event.currentTarget.value.trim();
    });
    $('personalization-form').addEventListener('submit', task(async () => {
        const { data } = await api('personalization/update', { app_name: $('personalization-form').elements.app_name.value.trim() });
        applyPersonalization(data);
        message('Đã lưu tên ứng dụng. Khách hàng hãy đồng bộ lại subscription để nhận tên mới.');
    }));
    if (token) task(enter)();
})();
