(function () {
    'use strict';
    // The admin is distributed as a prebuilt bundle; keep this component's
    // source separate and mount it from the existing TLS settings drawer.
    window.createNodeCertificateComponent = function (React) {
        return class NodeCertificate extends React.Component {
            constructor(props) {
                super(props);
                this.state = { data: null, error: '', busy: false };
            }
            componentDidMount() {
                this.active = true;
                this.refresh();
                this.timer = window.setInterval(() => this.refresh(), 15000);
            }
            componentWillUnmount() {
                this.active = false;
                window.clearInterval(this.timer);
                if (this.controller) this.controller.abort();
            }
            async refresh() {
                if (!this.props.nodeId || this.state.busy) return;
                this.setState({ busy: true, error: '' });
                this.controller = new AbortController();
                const timeout = window.setTimeout(() => this.controller.abort(), 10000);
                try {
                    const response = await fetch('/api/v1/' + window.settings.secure_path
                        + '/server/v2node/certificate?id=' + encodeURIComponent(this.props.nodeId), {
                        headers: { Authorization: window.localStorage.getItem('authorization') || '', Accept: 'application/json' },
                        cache: 'no-store', signal: this.controller.signal
                    });
                    if (!response.ok) throw new Error('Không thể lấy vân tay chứng chỉ (' + response.status + ').');
                    const body = await response.json();
                    if (this.active) this.setState({ data: body.data });
                } catch (error) {
                    if (this.active) this.setState({ error: error.name === 'AbortError' ? 'Hết thời gian chờ panel.' : error.message });
                } finally {
                    window.clearTimeout(timeout);
                    if (this.active) this.setState({ busy: false });
                }
            }
            render() {
                const h = React.createElement;
                const data = this.state.data || {};
                return h('div', { className: 'form-group node-certificate', 'aria-live': 'polite' },
                    h('label', null, 'Vân tay chứng chỉ (tự động)'),
                    h('div', null, h('code', { style: { overflowWrap: 'anywhere' } }, data.sha256
                        || (this.props.nodeId ? 'Chưa nhận được SHA256 từ node' : 'Lưu node để bắt đầu nhận vân tay'))),
                    data.public_key_sha256 && h('div', null, 'Khóa công khai: ', h('code', { style: { overflowWrap: 'anywhere' } }, data.public_key_sha256)),
                    data.updated_at && h('small', null, 'Node báo lúc ' + new Date(data.updated_at * 1000).toLocaleString('vi-VN')
                        + (data.not_after ? ' · Hết hạn ' + new Date(data.not_after * 1000).toLocaleDateString('vi-VN') : '')),
                    h('p', null, data.status === 'disabled' ? 'Cấu hình đã lưu chưa bật TLS thường.'
                        : 'v2nodePro tự báo theo chu kỳ đẩy dữ liệu. Cần cập nhật binary node có hỗ trợ tính năng này.'),
                    this.state.error && h('p', { role: 'alert', style: { color: '#c0392b' } }, this.state.error),
                    h('button', { type: 'button', className: 'ant-btn ant-btn-sm', disabled: this.state.busy || !this.props.nodeId, onClick: () => this.refresh() }, this.state.busy ? 'Đang lấy...' : 'Làm mới'),
                    h('label', { style: { display: 'block', marginTop: 12 } },
                        h('input', { type: 'checkbox', checked: this.props.enabled, onChange: event => this.props.onChange(event.target.checked ? '1' : '0') }),
                        ' Ghim chứng chỉ tự động trong subscription'),
                    h('small', null, 'Tắt ghim nếu client kết nối qua CDN hoặc proxy kết thúc TLS bằng chứng chỉ khác. Thay đổi có hiệu lực sau khi lưu node.'),
                    h('label', { style: { display: 'block', marginTop: 12 } },
                        h('input', {
                            type: 'checkbox', checked: this.props.proxyTermination,
                            onChange: event => this.props.onProxyTerminationChange(event.target.checked ? '1' : '0')
                        }),
                        ' TLS tại Nginx (backend WebSocket thường)'),
                    h('small', null, 'Giữ TLS/WSS trong subscription, nhưng v2node chỉ nghe WS nội bộ. Nginx phải dùng đúng Cert File và Key File bên dưới.')
                );
            }
        };
    };
})();
