#!/bin/bash
# V2Board Server Deep Optimization Script
# Target: khai thác tối đa bandwidth VPS (5Gbps)
# Usage: sudo bash optimize-server.sh
# Reboot sau khi chạy để áp dụng hoàn toàn

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[-]${NC} $1"; }

echo "============================================"
echo "  V2Board Deep Network Optimization (5Gbps)"
echo "============================================"
echo ""

# ==========================================
# 0. Chẩn đoán trước khi tối ưu
# ==========================================
log "Diagnosing current system..."
echo ""

CPU_CORES=$(nproc)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
VIRT=$(systemd-detect-virt 2>/dev/null || echo "unknown")
CURRENT_CC=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo "unknown")
CURRENT_QDISC=$(sysctl -n net.core.default_qdisc 2>/dev/null || echo "unknown")
NIC=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'dev \K\S+' || echo "eth0")
NIC_SPEED=$(ethtool "$NIC" 2>/dev/null | grep "Speed:" | awk '{print $2}' || echo "unknown")
NIC_DRIVER=$(ethtool -i "$NIC" 2>/dev/null | grep "driver:" | awk '{print $2}' || echo "unknown")
NIC_QUEUES=$(ls -d /sys/class/net/"$NIC"/queues/rx-* 2>/dev/null | wc -l || echo "1")
XRAY_PID=$(pgrep -x xray 2>/dev/null || pgrep -x v2ray 2>/dev/null || pgrep -x sing-box 2>/dev/null || echo "")

echo "  CPU cores:      $CPU_CORES"
echo "  RAM:            ${TOTAL_RAM_MB}MB"
echo "  Virtualization: $VIRT"
echo "  NIC:            $NIC ($NIC_SPEED, driver: $NIC_DRIVER)"
echo "  NIC RX queues:  $NIC_QUEUES"
echo "  Congestion:     $CURRENT_CC (qdisc: $CURRENT_QDISC)"
if [ -n "$XRAY_PID" ]; then
    XRAY_NAME=$(ps -p "$XRAY_PID" -o comm= 2>/dev/null || echo "proxy")
    XRAY_CPU=$(ps -p "$XRAY_PID" -o %cpu= 2>/dev/null | xargs || echo "?")
    XRAY_MEM=$(ps -p "$XRAY_PID" -o rss= 2>/dev/null | awk '{printf "%.0fMB", $1/1024}' || echo "?")
    echo "  Proxy core:     $XRAY_NAME (PID: $XRAY_PID, CPU: ${XRAY_CPU}%, RAM: $XRAY_MEM)"
else
    warn "No proxy core (xray/v2ray/sing-box) running"
fi
echo ""

if [ "$CPU_CORES" -lt 4 ]; then
    warn "CPU $CPU_CORES cores: bottleneck cho 5Gbps (khuyến nghị >= 4 cores)"
fi
if [ "$TOTAL_RAM_MB" -lt 1024 ]; then
    warn "RAM ${TOTAL_RAM_MB}MB: buffer lớn sẽ chiếm nhiều RAM"
fi

# ==========================================
# 1. BBR Congestion Control
# ==========================================
echo ""
log "[1/7] BBR congestion control..."

modprobe tcp_bbr 2>/dev/null || true
if ! grep -q "tcp_bbr" /etc/modules-load.d/modules.conf 2>/dev/null; then
    mkdir -p /etc/modules-load.d
    echo "tcp_bbr" >> /etc/modules-load.d/modules.conf
fi
log "  BBR module ready."

# ==========================================
# 2. Kernel Network Tuning
# ==========================================
log "[2/7] Kernel network parameters..."

# Tính buffer dựa trên RAM thực tế
# 5Gbps × 200ms = 125MB, nhưng giới hạn theo RAM
if [ "$TOTAL_RAM_MB" -ge 4096 ]; then
    TCP_BUF_MAX=134217728   # 128MB
    TCP_BUF_DEF=4194304     # 4MB
elif [ "$TOTAL_RAM_MB" -ge 2048 ]; then
    TCP_BUF_MAX=67108864    # 64MB
    TCP_BUF_DEF=2097152     # 2MB
else
    TCP_BUF_MAX=33554432    # 32MB
    TCP_BUF_DEF=1048576     # 1MB
fi

SYSCTL_CONF="/etc/sysctl.d/99-v2board-optimize.conf"

cat > "$SYSCTL_CONF" << EOF
# V2Board Optimized - $(date)
# Target: 5Gbps, $CPU_CORES cores, ${TOTAL_RAM_MB}MB RAM

# === BBR ===
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# === TCP Buffer ===
# Tự động tính: max=${TCP_BUF_MAX} bytes ($(( TCP_BUF_MAX / 1048576 ))MB)
net.core.rmem_max = ${TCP_BUF_MAX}
net.core.wmem_max = ${TCP_BUF_MAX}
net.ipv4.tcp_rmem = 4096 ${TCP_BUF_DEF} ${TCP_BUF_MAX}
net.ipv4.tcp_wmem = 4096 ${TCP_BUF_DEF} ${TCP_BUF_MAX}
net.core.rmem_default = ${TCP_BUF_DEF}
net.core.wmem_default = ${TCP_BUF_DEF}

# === Connection Queue ===
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 250000
net.ipv4.tcp_max_syn_backlog = 65535

# === TCP Keepalive ===
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5

# === TCP Performance ===
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_max_tw_buckets = 131072
net.ipv4.tcp_no_metrics_save = 1
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_sack = 1
net.ipv4.tcp_adv_win_scale = -2
net.ipv4.tcp_max_orphans = 65535
net.ipv4.ip_local_port_range = 1024 65535

# === File Descriptors ===
fs.file-max = 2097152
fs.nr_open = 2097152

# === UDP Buffer (Hysteria2, TUIC) ===
net.core.optmem_max = 65535
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192

# === Conntrack (nếu có) ===
# Tăng bảng tracking connection cho nhiều user
# net.netfilter.nf_conntrack_max = 2097152
# net.netfilter.nf_conntrack_tcp_timeout_established = 7200
# net.netfilter.nf_conntrack_tcp_timeout_time_wait = 30
EOF

# Bật conntrack tuning nếu module đã load
if lsmod | grep -q nf_conntrack; then
    sed -i 's/^# net.netfilter/net.netfilter/' "$SYSCTL_CONF"
    log "  Conntrack tuning enabled."
fi

sysctl -p "$SYSCTL_CONF" > /dev/null 2>&1
log "  Kernel parameters applied (buffer max: $(( TCP_BUF_MAX / 1048576 ))MB)."

# ==========================================
# 3. NIC Optimization
# ==========================================
log "[3/7] NIC optimization ($NIC)..."

# Tăng ring buffer
ethtool -G "$NIC" rx 4096 tx 4096 2>/dev/null && log "  Ring buffer: 4096" || warn "  Ring buffer: không thay đổi được (VPS ảo hóa)"

# Bật offloading
for OFFLOAD in gro gso tso; do
    ethtool -K "$NIC" "$OFFLOAD" on 2>/dev/null || true
done
log "  GRO/GSO/TSO offload enabled."

# Multi-queue RPS (phân tải packet xử lý trên nhiều CPU)
if [ "$CPU_CORES" -gt 1 ]; then
    # Tính RPS mask cho tất cả CPU cores
    RPS_MASK=$(printf '%x' $(( (1 << CPU_CORES) - 1 )))
    for RX_QUEUE in /sys/class/net/"$NIC"/queues/rx-*/rps_cpus; do
        echo "$RPS_MASK" > "$RX_QUEUE" 2>/dev/null || true
    done
    for RX_QUEUE in /sys/class/net/"$NIC"/queues/rx-*/rps_flow_cnt; do
        echo 32768 > "$RX_QUEUE" 2>/dev/null || true
    done
    # RFS - Receive Flow Steering
    echo 65536 > /proc/sys/net/core/rps_sock_flow_entries 2>/dev/null || true
    log "  RPS/RFS enabled (CPU mask: 0x$RPS_MASK, $CPU_CORES cores)."
else
    warn "  Single CPU core - RPS skipped."
fi

# XPS - Transmit Packet Steering
if [ "$CPU_CORES" -gt 1 ]; then
    CPU_IDX=0
    for TX_QUEUE in /sys/class/net/"$NIC"/queues/tx-*/xps_cpus; do
        XPS_MASK=$(printf '%x' $(( 1 << (CPU_IDX % CPU_CORES) )))
        echo "$XPS_MASK" > "$TX_QUEUE" 2>/dev/null || true
        CPU_IDX=$((CPU_IDX + 1))
    done
    log "  XPS enabled."
fi

# ==========================================
# 4. IRQ Affinity
# ==========================================
log "[4/7] IRQ affinity..."

if [ "$CPU_CORES" -gt 1 ] && [ -d /proc/irq ]; then
    NIC_IRQS=$(grep "$NIC" /proc/interrupts 2>/dev/null | awk '{print $1}' | tr -d ':')
    if [ -n "$NIC_IRQS" ]; then
        CPU_IDX=0
        for IRQ in $NIC_IRQS; do
            IRQ_MASK=$(printf '%x' $(( 1 << (CPU_IDX % CPU_CORES) )))
            echo "$IRQ_MASK" > /proc/irq/"$IRQ"/smp_affinity 2>/dev/null || true
            CPU_IDX=$((CPU_IDX + 1))
        done
        log "  Distributed $CPU_IDX NIC IRQs across $CPU_CORES CPUs."
    else
        warn "  No NIC IRQs found (normal for virtio VPS)."
    fi
    # Disable irqbalance nếu đã set thủ công
    systemctl stop irqbalance 2>/dev/null || true
    systemctl disable irqbalance 2>/dev/null || true
else
    warn "  IRQ affinity skipped (single core or no access)."
fi

# ==========================================
# 5. File Descriptor & Process Limits
# ==========================================
log "[5/7] File descriptor limits..."

cat > /etc/security/limits.d/99-v2board.conf << 'EOF'
* soft nofile 2097152
* hard nofile 2097152
* soft nproc 131072
* hard nproc 131072
root soft nofile 2097152
root hard nofile 2097152
EOF

# Systemd service overrides
for SERVICE_NAME in xray v2ray sing-box; do
    SERVICE_DIR="/etc/systemd/system/${SERVICE_NAME}.service.d"
    if systemctl list-unit-files 2>/dev/null | grep -q "${SERVICE_NAME}.service"; then
        mkdir -p "$SERVICE_DIR"
        cat > "$SERVICE_DIR/override.conf" << 'SEOF'
[Service]
LimitNOFILE=2097152
LimitNPROC=131072
LimitMEMLOCK=infinity
LimitCORE=infinity
# Tự restart nếu crash
Restart=on-failure
RestartSec=3
SEOF
        log "  ${SERVICE_NAME} service limits configured."
    fi
done

systemctl daemon-reload 2>/dev/null || true

# ==========================================
# 6. Tắt các service không cần thiết
# ==========================================
log "[6/7] Disabling unnecessary services..."

STOPPED=0
for SVC in snapd snapd.socket unattended-upgrades apt-daily.timer apt-daily-upgrade.timer man-db.timer; do
    if systemctl is-active --quiet "$SVC" 2>/dev/null; then
        systemctl stop "$SVC" 2>/dev/null || true
        systemctl disable "$SVC" 2>/dev/null || true
        STOPPED=$((STOPPED + 1))
    fi
done
log "  Stopped $STOPPED unnecessary services."

# Tắt transparent hugepages (gây latency spike)
if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then
    echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
    echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true
    log "  Transparent Hugepages disabled."
fi

# ==========================================
# 7. Persist NIC settings qua reboot
# ==========================================
log "[7/7] Persisting settings..."

PERSIST_SCRIPT="/etc/v2board-nic-optimize.sh"
cat > "$PERSIST_SCRIPT" << 'PEOF'
#!/bin/bash
# Auto-applied on boot by v2board
NIC=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'dev \K\S+' || echo "eth0")
CPU_CORES=$(nproc)

# Ring buffer
ethtool -G "$NIC" rx 4096 tx 4096 2>/dev/null || true

# Offloading
for F in gro gso tso; do ethtool -K "$NIC" "$F" on 2>/dev/null || true; done

# RPS
if [ "$CPU_CORES" -gt 1 ]; then
    RPS_MASK=$(printf '%x' $(( (1 << CPU_CORES) - 1 )))
    for Q in /sys/class/net/"$NIC"/queues/rx-*/rps_cpus; do echo "$RPS_MASK" > "$Q" 2>/dev/null || true; done
    for Q in /sys/class/net/"$NIC"/queues/rx-*/rps_flow_cnt; do echo 32768 > "$Q" 2>/dev/null || true; done
    echo 65536 > /proc/sys/net/core/rps_sock_flow_entries 2>/dev/null || true
fi

# XPS
if [ "$CPU_CORES" -gt 1 ]; then
    I=0
    for Q in /sys/class/net/"$NIC"/queues/tx-*/xps_cpus; do
        echo $(printf '%x' $(( 1 << (I % CPU_CORES) ))) > "$Q" 2>/dev/null || true
        I=$((I + 1))
    done
fi

# THP off
echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true
PEOF
chmod +x "$PERSIST_SCRIPT"

# Systemd service để chạy lúc boot
cat > /etc/systemd/system/v2board-optimize.service << EOF
[Unit]
Description=V2Board NIC Optimization
After=network.target

[Service]
Type=oneshot
ExecStart=$PERSIST_SCRIPT
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable v2board-optimize.service 2>/dev/null
log "  Boot persistence configured."

# ==========================================
# Final Report
# ==========================================
echo ""
echo "============================================"
echo "  Optimization Complete"
echo "============================================"
echo ""
echo "  System:     $CPU_CORES cores, ${TOTAL_RAM_MB}MB RAM, $VIRT"
echo "  NIC:        $NIC ($NIC_SPEED, $NIC_QUEUES queues)"
echo "  BBR:        $(sysctl -n net.ipv4.tcp_congestion_control)"
echo "  Qdisc:      $(sysctl -n net.core.default_qdisc)"
echo "  Buffer max: $(( TCP_BUF_MAX / 1048576 ))MB"
echo "  File max:   $(sysctl -n fs.file-max)"
echo "  Fastopen:   $(sysctl -n net.ipv4.tcp_fastopen)"
echo "  Port range: $(sysctl -n net.ipv4.ip_local_port_range)"
echo ""
echo -e "${YELLOW}QUAN TRONG - hãy reboot để áp dụng hoàn toàn:${NC}"
echo "  reboot"
echo ""
echo "Sau khi reboot, test tốc độ thực tế:"
echo '  # Test download thuần (không qua proxy) - kiểm tra bandwidth VPS'
echo '  curl -o /dev/null http://speedtest.tele2.net/1GB.zip 2>&1 | tail -1'
echo ""
echo '  # Test tốc độ iperf3 (cài iperf3 trên cả server và client)'
echo '  # Server: iperf3 -s'
echo '  # Client:  iperf3 -c <server_ip> -P 4 -t 30'
echo ""
echo "Nếu tốc độ vẫn thấp sau khi tối ưu, kiểm tra:"
echo "  1. CPU usage khi test: top -d1 (nếu 1 core 100% = bottleneck mã hóa)"
echo "  2. Protocol: đổi sang VLESS+Reality+TCP (nhẹ nhất)"
echo "  3. Đường truyền: traceroute đến VPS có thể bị throttle bởi ISP"
echo "  4. Cân nhắc dùng Hysteria2 (UDP) nếu ISP throttle TCP"
