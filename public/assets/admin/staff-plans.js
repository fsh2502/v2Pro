(function () {
    'use strict';
    let Component;
    const bytesPerGb = 1073741824;
    const blank = () => ({ name: '', group_id: '', transfer_enable: '', speed_limit: '', device_limit: '', enabled: 1 });
    window.createStaffPlansComponent = function (React) {
        if (Component) return Component;
        const h = React.createElement;
        Component = class StaffPlans extends React.Component {
            constructor(props) {
                super(props);
                this.state = { plans: [], groups: [], selected: [], form: blank(), busy: false, message: '', error: false };
            }
            componentWillUnmount() { if (this.dialog && this.dialog.open) this.dialog.close(); }
            async api(path, data) {
                const response = await fetch('/api/v1/' + window.settings.secure_path + '/staff-plan/' + path, {
                    method: data ? 'POST' : 'GET', cache: 'no-store',
                    headers: { Authorization: window.localStorage.getItem('authorization') || '', Accept: 'application/json', 'Content-Type': 'application/json' },
                    ...(data ? { body: JSON.stringify(data) } : {})
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.errors ? Object.values(body.errors).flat().join('\n') : body.message || 'Không thể quản lý gói Staff.');
                return body.data;
            }
            async load() {
                const data = await this.api('fetch' + (this.props.catalogOnly ? '' : '?staff_id=' + encodeURIComponent(this.props.staffId)));
                this.setState({ plans: data.plans, groups: data.groups, selected: data.allowed_plan_ids.map(Number) });
            }
            async run(callback) {
                this.setState({ busy: true, message: '', error: false });
                try { await callback(); }
                catch (error) { this.setState({ message: error.message, error: true }); }
                finally { this.setState({ busy: false }); }
            }
            open() { this.dialog.showModal(); this.run(() => this.load()); }
            change(key, value) { this.setState({ form: { ...this.state.form, [key]: value } }); }
            edit(plan) {
                this.setState({ form: { ...plan, transfer_enable: String(plan.transfer_enable / bytesPerGb),
                    group_id: String(plan.group_id), speed_limit: plan.speed_limit == null ? '' : String(plan.speed_limit),
                    device_limit: plan.device_limit == null ? '' : String(plan.device_limit), enabled: plan.enabled ? 1 : 0 } });
            }
            save(event) {
                event.preventDefault();
                event.stopPropagation();
                this.run(async () => {
                    const form = this.state.form, bytes = Math.round(Number(form.transfer_enable) * bytesPerGb);
                    if (!Number.isSafeInteger(bytes) || bytes < 1) throw new Error('Vui lòng nhập dung lượng lớn hơn 0.');
                    await this.api('save', { ...(form.id ? { id: form.id } : {}), name: form.name,
                        group_id: Number(form.group_id), transfer_enable: bytes, enabled: Number(form.enabled),
                        speed_limit: form.speed_limit === '' ? null : Number(form.speed_limit),
                        device_limit: form.device_limit === '' ? null : Number(form.device_limit) });
                    const data = await this.api('fetch' + (this.props.catalogOnly ? '' : '?staff_id=' + encodeURIComponent(this.props.staffId)));
                    this.setState({ plans: data.plans, groups: data.groups, form: blank(), message: this.props.catalogOnly
                        ? 'Đã lưu danh mục gói CTV. Mở Gói được phép của từng CTV để cấp quyền.'
                        : 'Đã lưu gói riêng cho Staff. Chọn gói và lưu quyền sử dụng bên trên để cấp cho nhân viên.' });
                });
            }
            render() {
                const state = this.state, form = state.form, catalog = !!this.props.catalogOnly;
                const field = (label, key, type, extra = {}) => h('label', { key }, label,
                    h('input', { className: 'ant-input', type, value: form[key], onChange: e => this.change(key, e.target.value), ...extra }));
                return h(React.Fragment, null,
                    h('button', { type: 'button', className: 'ant-btn', onClick: () => this.open() }, this.props.buttonLabel || 'Gói Staff được phép sử dụng'),
                    h('dialog', { className: 'staff-plans-dialog', ref: element => { this.dialog = element; }, 'aria-label': 'Quản lý gói riêng cho Staff',
                        onKeyDown: event => { if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); event.stopPropagation(); } } },
                        h('div', { className: 'staff-plans-header' }, h('h3', null, catalog ? 'Danh mục gói CTV' : 'Gói riêng · ' + (this.props.staffCode || 'Staff ' + this.props.staffId)),
                            h('button', { type: 'button', className: 'ant-btn', onClick: () => this.dialog.close() }, 'Đóng')),
                        h('p', null, catalog ? 'Danh mục gói chung dành cho CTV, tách khỏi các gói bán chính. Quyền dùng từng gói được cấp riêng cho mỗi CTV.'
                            : 'Danh mục này tách khỏi các gói bán chính. Chọn gói nhân viên này được dùng; gói đang tắt sẽ không xuất hiện trên Staff.'),
                        state.message ? h('p', { className: 'staff-plans-message' + (state.error ? ' error' : ''), role: 'status' }, state.message) : null,
                        h('fieldset', { disabled: state.busy },
                            h('div', { className: 'staff-plans-list' }, h('table', null,
                                h('thead', null, h('tr', null, ...[...(catalog ? [] : ['Cho phép']), 'Gói', 'Dung lượng (GB)', 'Tốc độ (Mbps)', 'Trạng thái', ''].map(title => h('th', { key: title }, title)))),
                                h('tbody', null, ...state.plans.map(plan => h('tr', { key: plan.id },
                                    catalog ? null : h('td', null, h('input', { type: 'checkbox', 'aria-label': 'Cho phép ' + plan.name, checked: state.selected.includes(Number(plan.id)), onChange: e => {
                                        this.setState({ selected: e.target.checked ? [...state.selected, Number(plan.id)] : state.selected.filter(id => id !== Number(plan.id)) });
                                    } })),
                                    h('td', null, plan.name + ' · ID ' + plan.id), h('td', null, (plan.transfer_enable / bytesPerGb).toFixed(2)),
                                    h('td', null, plan.speed_limit == null ? 'Không giới hạn' : plan.speed_limit), h('td', null, plan.enabled ? 'Đang bật' : 'Đang tắt'),
                                    h('td', null, h('button', { className: 'ant-btn', type: 'button', onClick: () => this.edit(plan) }, 'Chỉnh sửa gói')))),
                                    !state.plans.length ? h('tr', null, h('td', { colSpan: catalog ? 5 : 6 }, 'Chưa có gói Staff. Tạo gói bên dưới.')) : null))),
                            catalog ? null : h('button', { className: 'ant-btn ant-btn-primary', type: 'button', onClick: () => this.run(async () => {
                                await this.api('assign', { staff_id: Number(this.props.staffId), plan_ids: state.selected });
                                this.setState({ message: 'Đã lưu quyền sử dụng gói cho Staff này.' });
                                if (this.props.onPermissionsSaved) await this.props.onPermissionsSaved();
                            }) }, 'Lưu quyền sử dụng'),
                            h('div', { className: 'staff-plans-form' },
                                h('div', { className: 'staff-plans-toolbar' }, h('h4', null, form.id ? 'Chỉnh sửa gói Staff · ID ' + form.id : 'Tạo gói Staff'),
                                    h('button', { className: 'ant-btn', type: 'button', onClick: () => this.setState({ form: blank() }) }, 'Tạo gói mới')),
                                field('Tên gói', 'name', 'text', { required: true, maxLength: 128 }),
                                h('label', null, 'Nhóm máy chủ', h('select', { className: 'ant-input', value: form.group_id, required: true, onChange: e => this.change('group_id', e.target.value) },
                                    h('option', { value: '' }, 'Chọn nhóm máy chủ'), ...state.groups.map(group => h('option', { value: String(group.id), key: group.id }, group.name)))),
                                h('div', { className: 'staff-plans-form-grid' }, field('Dung lượng (GB)', 'transfer_enable', 'number', { required: true, min: 0, step: 'any' }),
                                    field('Giới hạn tốc độ (Mbps)', 'speed_limit', 'number', { min: 0, step: 1 }), field('Giới hạn số thiết bị', 'device_limit', 'number', { min: 0, step: 1 })),
                                h('label', null, 'Trạng thái gói', h('select', { className: 'ant-input', value: form.enabled, onChange: e => this.change('enabled', Number(e.target.value)) },
                                    h('option', { value: 1 }, 'Đang bật'), h('option', { value: 0 }, 'Đang tắt'))),
                                h('button', { className: 'ant-btn ant-btn-primary', type: 'button', onClick: event => this.save(event) }, 'Lưu gói Staff')))));
            }
        };
        return Component;
    };
})();
