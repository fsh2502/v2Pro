(function () {
    'use strict';
    let Component;
    window.createCtvComponent = function (React, Layout) {
        if (Component) return Component;
        const h = React.createElement, StaffPlans = window.createStaffPlansComponent(React);
        Component = class CtvManagement extends React.Component {
            constructor(props) {
                super(props);
                this.state = { tab: 'staff', rows: [], total: 0, page: 1, search: '', filterOwner: '',
                    busy: false, message: '', error: false, selected: null, form: {} };
                this.requestId = 0;
            }
            componentDidMount() { this.run(() => this.load()); }
            componentWillUnmount() { this.requestId++; if (this.dialog && this.dialog.open) this.dialog.close(); }
            async api(path, data) {
                const response = await fetch('/api/v1/' + window.settings.secure_path + '/ctv/' + path, {
                    method: data ? 'POST' : 'GET', cache: 'no-store',
                    headers: { Authorization: window.localStorage.getItem('authorization') || '', Accept: 'application/json', 'Content-Type': 'application/json' },
                    ...(data ? { body: JSON.stringify(data) } : {})
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.errors ? Object.values(body.errors).flat().join('\n') : body.message || 'Không thể quản lý CTV.');
                return body;
            }
            async run(callback) {
                this.setState({ busy: true, message: '', error: false });
                try { await callback(); }
                catch (error) { this.setState({ message: error.message, error: true }); }
                finally { this.setState({ busy: false }); }
            }
            async load() {
                const requestId = ++this.requestId, state = this.state;
                const query = new URLSearchParams({ current: String(state.page), pageSize: '20', search: state.search });
                if (state.tab !== 'staff' && state.filterOwner) query.set(state.tab === 'history' ? 'staff_id' : 'staff_owner_id', state.filterOwner);
                const body = await this.api((state.tab === 'staff' ? 'fetch?' : state.tab === 'history' ? 'activity?' : 'customers?') + query);
                if (requestId === this.requestId) this.setState({ rows: body.data, total: body.total });
            }
            switchTab(tab) {
                if (tab === this.state.tab) return;
                this.setState({ tab, page: 1, search: '', filterOwner: '', rows: [], total: 0 }, () => this.run(() => this.load()));
            }
            edit(row) {
                const form = this.state.tab === 'staff' ? { staff_customer_limit: String(row.staff_customer_limit),
                    staff_app_name: row.staff_app_name || '', banned: String(row.banned) } : {
                    staff_owner_id: row.staff_owner_id == null ? '' : String(row.staff_owner_id),
                    staff_creator_id: row.staff_creator_id == null ? '' : String(row.staff_creator_id) };
                this.setState({ selected: row, form, message: '', error: false }, () => this.dialog.showModal());
            }
            change(key, value) { this.setState({ form: { ...this.state.form, [key]: value } }); }
            save(event) {
                event.preventDefault();
                return this.run(async () => {
                    const state = this.state, row = state.selected, form = state.form;
                    let data;
                    if (state.tab === 'staff') {
                        const limit = Number(form.staff_customer_limit);
                        if (form.staff_customer_limit === '' || !Number.isInteger(limit) || limit < row.customer_count || limit > 2147483647) {
                            throw new Error('Hạn mức phải là số nguyên và không nhỏ hơn số khách đang quản lý.');
                        }
                        data = { id: row.id, staff_customer_limit: limit, staff_app_name: form.staff_app_name.trim() || null, banned: Number(form.banned) };
                    } else {
                        const idValue = value => {
                            if (!value) return null;
                            const id = Number(value);
                            if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new Error('ID CTV phải là số nguyên dương hợp lệ.');
                            return id;
                        };
                        data = { id: row.id, staff_owner_id: idValue(form.staff_owner_id) };
                        if (!row.staff_creator_id && form.staff_creator_id) data.staff_creator_id = idValue(form.staff_creator_id);
                    }
                    await this.api(state.tab === 'staff' ? 'update' : 'assign', data);
                    this.dialog.close(); await this.load();
                    this.setState({ selected: null, message: state.tab === 'staff' ? 'Đã lưu thiết lập CTV.' : 'Đã lưu phân công khách hàng.' });
                });
            }
            renderDialog() {
                const state = this.state, row = state.selected, staff = state.tab === 'staff', form = state.form;
                const input = (label, key, extra = {}) => h('label', { key }, label, h('input', {
                    className: 'ant-input', value: form[key] || '', onChange: e => this.change(key, e.target.value), ...extra }));
                return h('dialog', { className: 'ctv-settings-dialog', ref: el => { this.dialog = el; }, 'aria-label': staff ? 'Thiết lập CTV' : 'Phân công khách hàng' },
                    h('div', { className: 'ctv-toolbar' }, h('h3', null, staff ? 'Thiết lập CTV' : 'Phân công khách hàng'),
                        h('button', { type: 'button', className: 'ant-btn', onClick: () => this.dialog.close() }, 'Đóng')),
                    row ? h('form', { onSubmit: event => this.save(event) },
                        h('p', null, (staff ? row.staff_code : row.customer_code || 'Khách ID ' + row.id) + ' · ' + row.email),
                        state.error ? h('p', { className: 'staff-plans-message error', role: 'alert' }, state.message) : null,
                        h('fieldset', { disabled: state.busy }, staff ? h(React.Fragment, null,
                            h('p', null, 'Đang quản lý ' + row.customer_count + ' khách hàng. Khách bị khóa hoặc hết hạn vẫn tính vào hạn mức.'),
                            input('Số khách hàng tối đa', 'staff_customer_limit', { type: 'number', min: row.customer_count, max: 2147483647, step: 1, required: true }),
                            input('Tên ứng dụng riêng (appName)', 'staff_app_name', { type: 'text', maxLength: 64, placeholder: row.staff_code }),
                            h('p', { className: 'text-muted' }, 'Để trống để dùng mã CTV. CTV vẫn có thể tự đổi tên trong Cá nhân hóa.'),
                            h('label', null, 'Trạng thái CTV', h('select', { className: 'ant-input', value: form.banned, onChange: e => this.change('banned', e.target.value) },
                                h('option', { value: '0' }, 'Hoạt động'), h('option', { value: '1' }, 'Đã khóa')))
                        ) : h(React.Fragment, null,
                            input('ID CTV phụ trách', 'staff_owner_id', { type: 'number', min: 1, max: 2147483647, step: 1 }),
                            h('p', { className: 'text-muted' }, 'Để trống nếu Admin quản lý. CTV chỉ được sửa khách do chính mình tạo và đang phụ trách.'),
                            row.staff_creator_id ? h('p', null, 'CTV đã tạo khách hàng: ' + row.creator_code + ' · Không được thay đổi lịch sử người tạo.') : h(React.Fragment, null,
                                input('ID CTV đã tạo khách hàng', 'staff_creator_id', { type: 'number', min: 1, max: 2147483647, step: 1 }),
                                h('p', { className: 'text-muted' }, 'Chỉ xác nhận một lần khi có căn cứ về người tạo dữ liệu cũ.'))),
                            h('div', { className: 'ctv-dialog-actions' }, h('button', { type: 'submit', className: 'ant-btn ant-btn-primary' }, 'Lưu thiết lập')))) : null);
            }
            render() {
                const state = this.state, staff = state.tab === 'staff', history = state.tab === 'history';
                const headers = history ? ['Người thực hiện / Thời gian', 'Đối tượng', 'Thao tác', 'Thay đổi'] : staff ? ['Mã CTV', 'Email', 'Tên ứng dụng', 'Khách / Hạn mức', 'Gói được cấp', 'Trạng thái', 'Thiết lập'] : ['ID', 'Mã khách hàng', 'Email', 'CTV phụ trách', 'CTV đã tạo', 'Thiết lập'];
                const cell = (value, key) => h('td', { key }, value);
                return h(Layout, { ...this.props, title: 'Quản Lý CTV' }, h('div', { className: 'block ctv-page' },
                    h('div', { className: 'ctv-toolbar' }, h('h2', null, 'Quản Lý CTV'), h(StaffPlans, { catalogOnly: true, buttonLabel: 'Danh mục gói CTV' })),
                    h('p', { className: 'text-muted' }, 'Thiết lập dành cho tài khoản được bật quyền Staff. Bật quyền trong Quản Lý Người Dùng để tài khoản xuất hiện ở đây.'),
                    h('div', { className: 'ctv-tabs', role: 'tablist', 'aria-label': 'Quản lý CTV' },
                        h('button', { type: 'button', role: 'tab', 'aria-selected': staff, className: 'ant-btn' + (staff ? ' ant-btn-primary' : ''), disabled: state.busy, onClick: () => this.switchTab('staff') }, 'Danh sách CTV'),
                        h('button', { type: 'button', role: 'tab', 'aria-selected': state.tab === 'customers', className: 'ant-btn' + (state.tab === 'customers' ? ' ant-btn-primary' : ''), disabled: state.busy, onClick: () => this.switchTab('customers') }, 'Khách hàng & Phân công'),
                        h('button', { type: 'button', role: 'tab', 'aria-selected': history, className: 'ant-btn' + (history ? ' ant-btn-primary' : ''), disabled: state.busy, onClick: () => this.switchTab('history') }, 'Lịch sử thao tác')),
                    state.message && !this.dialog?.open ? h('p', { className: 'staff-plans-message' + (state.error ? ' error' : ''), role: 'status' }, state.message) : null,
                    h('form', { className: 'ctv-search', onSubmit: event => { event.preventDefault(); this.setState({ page: 1 }, () => this.run(() => this.load())); } },
                        h('input', { className: 'ant-input', 'aria-label': history ? 'Tìm lịch sử thao tác' : staff ? 'Tìm CTV' : 'Tìm khách hàng CTV', placeholder: staff ? 'Email, ID hoặc mã CTV' : 'Email, ID hoặc mã khách hàng', value: state.search,
                            onChange: event => this.setState({ search: event.target.value }) }),
                        !staff ? h('input', { className: 'ant-input', type: 'number', min: 1, 'aria-label': history ? 'Lọc lịch sử theo ID CTV' : 'Lọc theo ID CTV phụ trách', placeholder: 'ID CTV phụ trách', value: state.filterOwner,
                            onChange: event => this.setState({ filterOwner: event.target.value }) }) : null,
                        h('button', { type: 'submit', className: 'ant-btn ant-btn-primary', disabled: state.busy }, 'Tìm kiếm')),
                    h('div', { className: 'ctv-table-scroll' }, h('table', { className: 'ctv-table' + (history ? ' activity-table' : '') },
                        h('thead', null, h('tr', null, ...headers.map(title => h('th', { key: title }, title)))),
                        h('tbody', null, ...state.rows.map(row => h('tr', { key: row.id }, ...(history ? [
                            cell(h(React.Fragment, null, h('strong', { className: 'activity-actor' }, row.actor_label), h('div', null, window.CtvActivity.date(row.created_at))), 'actor'),
                            cell(row.target_label, 'target'), cell(window.CtvActivity.action(row.action), 'action'),
                            cell(h('details', { className: 'activity-details' }, h('summary', null, 'Xem ' + Object.keys(row.changes || {}).length + ' thay đổi'),
                                h('ul', null, ...window.CtvActivity.changes(row).map((line, index) => h('li', { key: index }, line)))), 'changes')
                        ] : staff ? [
                            cell(row.staff_code, 'code'), cell(row.email, 'email'), cell(row.app_name, 'name'),
                            cell(row.customer_count + ' / ' + row.staff_customer_limit, 'quota'), cell(row.allowed_plan_count, 'plans'),
                            cell(h('span', { className: 'ant-tag ant-tag-' + (row.banned ? 'red' : 'green') }, row.banned ? 'Đã khóa' : 'Hoạt động'), 'status'),
                            cell(h('div', { className: 'ctv-row-actions' }, h('button', { className: 'ant-btn', disabled: state.busy, type: 'button', onClick: () => this.edit(row) }, 'Thiết lập'),
                                h(StaffPlans, { staffId: row.id, staffCode: row.staff_code, buttonLabel: 'Gói được phép', onPermissionsSaved: () => this.run(() => this.load()) })), 'actions')
                        ] : [cell(row.id, 'id'), cell(row.customer_code || '—', 'code'), cell(row.email, 'email'), cell(row.owner_code || 'Admin', 'owner'), cell(row.creator_code || 'Chưa xác nhận', 'creator'),
                            cell(h('button', { className: 'ant-btn', type: 'button', disabled: state.busy, onClick: () => this.edit(row) }, 'Phân công'), 'actions')]))),
                            !state.rows.length ? h('tr', null, h('td', { colSpan: headers.length }, state.busy ? 'Đang tải...' : 'Chưa có dữ liệu phù hợp.')) : null))),
                    h('div', { className: 'ctv-pagination' }, h('button', { className: 'ant-btn', disabled: state.busy || state.page <= 1, onClick: () => this.setState({ page: state.page - 1 }, () => this.run(() => this.load())) }, 'Trang trước'),
                        h('span', null, 'Trang ' + state.page + ' · ' + state.total + (history ? ' thao tác' : staff ? ' CTV' : ' khách hàng')),
                        h('button', { className: 'ant-btn', disabled: state.busy || state.page * 20 >= state.total, onClick: () => this.setState({ page: state.page + 1 }, () => this.run(() => this.load())) }, 'Trang sau')),
                    this.renderDialog()));
            }
        };
        return Component;
    };
})();
