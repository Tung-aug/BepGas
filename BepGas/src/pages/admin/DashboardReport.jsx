// Trang báo cáo tổng hợp dành để in — mở trong tab mới từ nút "In báo cáo" trên Dashboard.
// Nhận tham số thời gian qua URL query: ?from=yyyy-MM-dd&to=yyyy-MM-dd&preset=tháng này
// Tự chứa inline CSS để không phụ thuộc admin.css, tối ưu bố cục A4 cho @media print.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { fmt } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const CSS = `
/* ── Reset & Base ─────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1f2937; background: #f3f4f6; }

/* ── Wrapper ─────────────────────────────── */
.rpt-wrap {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 28px;
  background: #fff;
  min-height: 100vh;
}

/* ── Top bar (ẩn khi in) ─────────────────── */
.rpt-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5e7eb;
}
.rpt-topbar-title { font-size: 1rem; font-weight: 700; color: #374151; }
.rpt-print-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  background: #f97316;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.rpt-print-btn:hover { background: #ea580c; }
.rpt-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 0.85rem;
  color: #6b7280;
  cursor: pointer;
  transition: border-color 0.15s;
}
.rpt-back-btn:hover { border-color: #9ca3af; color: #374151; }
.rpt-topbar-btns { display: flex; gap: 8px; }

/* ── Header báo cáo ─────────────────────── */
.rpt-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 2px solid #f97316;
}
.rpt-brand { display: flex; align-items: center; gap: 10px; }
.rpt-brand-logo {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111827;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -1px;
  flex-shrink: 0;
  border: 1px solid #d1d5db;
}
.rpt-brand-name { font-size: 1.15rem; font-weight: 800; color: #1f2937; }
.rpt-brand-sub { font-size: 0.78rem; color: #6b7280; margin-top: 2px; }
.rpt-meta { text-align: right; }
.rpt-meta-title { font-size: 1.05rem; font-weight: 800; color: #111827; margin-bottom: 4px; }
.rpt-meta-range { font-size: 0.82rem; color: #374151; margin-bottom: 2px; }
.rpt-meta-printed { font-size: 0.78rem; color: #9ca3af; }

/* ── Section chung ──────────────────────── */
.rpt-section { margin-bottom: 20px; }
.rpt-section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #111827;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 12px;
}

/* ── Key metrics ────────────────────────── */
.rpt-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.rpt-metric-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
  background: #fafafa;
}
.rpt-metric-card.rpt-metric-paid   { border-left: 3px solid #10b981; background: #f0fdf4; }
.rpt-metric-card.rpt-metric-est    { border-left: 3px solid #3b82f6; background: #eff6ff; }
.rpt-metric-card.rpt-metric-debt   { border-left: 3px solid #ef4444; background: #fef2f2; }
.rpt-metric-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 4px; }
.rpt-metric-value { font-size: 1.1rem; font-weight: 800; color: #1f2937; }
.rpt-metric-sub   { font-size: 0.72rem; color: #9ca3af; margin-top: 2px; }

/* Hàng đếm đơn */
.rpt-counts-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.rpt-count-box {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 10px;
  text-align: center;
  background: #fafafa;
}
.rpt-count-num  { font-size: 1.25rem; font-weight: 800; color: #1f2937; }
.rpt-count-lbl  { font-size: 0.72rem; color: #6b7280; margin-top: 2px; }

/* ── Tasks ──────────────────────────────── */
.rpt-tasks-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.rpt-task-box {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 8px;
  text-align: center;
}
.rpt-task-box.rpt-urgent { border-color: currentColor; background: #fff7ed; }
.rpt-task-num  { font-size: 1.3rem; font-weight: 800; }
.rpt-task-lbl  { font-size: 0.72rem; color: #6b7280; margin-top: 3px; }

.rpt-summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  margin-top: -2px;
}
.rpt-summary-table th {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid #d1d5db;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rpt-summary-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}
.rpt-summary-table tbody tr:last-child td { border-bottom: none; }
.rpt-summary-label { font-weight: 600; color: #111827; }
.rpt-summary-value {
  text-align: right;
  font-weight: 800;
  color: #111827;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.rpt-summary-note { color: #6b7280; font-size: 0.78rem; }
.rpt-summary-alert .rpt-summary-label,
.rpt-summary-alert .rpt-summary-value,
.rpt-summary-warn .rpt-summary-label,
.rpt-summary-warn .rpt-summary-value,
.rpt-summary-ok .rpt-summary-label,
.rpt-summary-ok .rpt-summary-value { color: #111827; }

/* ── Bảng ──────────────────────────────── */
.rpt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.rpt-table th {
  background: #f3f4f6;
  text-align: left;
  padding: 7px 10px;
  font-weight: 600;
  color: #374151;
  font-size: 0.78rem;
  border-bottom: 1px solid #e5e7eb;
}
.rpt-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.rpt-table tr:last-child td { border-bottom: none; }
.rpt-table .rpt-td-num { text-align: right; font-variant-numeric: tabular-nums; }
.rpt-table .rpt-td-center { text-align: center; }
.rpt-rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.72rem;
  font-weight: 700;
  background: #f3f4f6;
  color: #111827;
}
.rpt-rank-1,
.rpt-rank-2,
.rpt-rank-3 { background: #f3f4f6; color: #111827; }

/* Pill trạng thái */
.rpt-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  color: #111827 !important;
  background: #f3f4f6 !important;
  border: 1px solid #d1d5db;
}

/* Cảnh báo tồn kho */
.rpt-stock-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.rpt-stock-col-title {
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e5e7eb;
}
.rpt-stock-col-title.rpt-warn,
.rpt-stock-col-title.rpt-error { color: #111827; }
.rpt-stock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed #f3f4f6;
  font-size: 0.8rem;
}
.rpt-stock-item:last-child { border-bottom: none; }
.rpt-stock-name { color: #374151; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
.rpt-stock-qty-warn,
.rpt-stock-qty-error { color: #111827; font-weight: 700; font-size: 0.8rem; }

/* ── Footer ─────────────────────────────── */
.rpt-footer {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #9ca3af;
}

/* ── Loading / Error ─────────────────────── */
.rpt-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  color: #6b7280;
  font-size: 0.95rem;
}
.rpt-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #f3f4f6;
  border-top-color: #f97316;
  border-radius: 50%;
  animation: rpt-spin 0.7s linear infinite;
}
@keyframes rpt-spin { to { transform: rotate(360deg); } }
.rpt-error-box {
  padding: 20px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #b91c1c;
  text-align: center;
}

/* ── @media print ────────────────────────── */
@media print {
  body { background: #fff; font-size: 11px; }
  .rpt-topbar { display: none !important; }
  .rpt-wrap { padding: 0; max-width: 100%; }
  @page { size: A4; margin: 14mm 12mm; }
  .rpt-metrics-grid { grid-template-columns: repeat(3, 1fr); }
  .rpt-counts-row   { grid-template-columns: repeat(5, 1fr); }
  .rpt-tasks-grid   { grid-template-columns: repeat(5, 1fr); }
  .rpt-stock-grid   { grid-template-columns: 1fr 1fr; }
  .rpt-section { page-break-inside: avoid; }
  .rpt-summary-table { font-size: 10px; }
  .rpt-summary-table th { font-size: 9px; }
  .rpt-table { font-size: 10px; }
  .rpt-table th { font-size: 9px; }
}
`;

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

const STATUS_CFG = {
  pending:         { label: 'Chờ xử lý',     color: '#f59e0b', bg: '#fef3c7' },
  confirmed:       { label: 'Đã xác nhận',   color: '#3b82f6', bg: '#dbeafe' },
  shipping:        { label: 'Đang giao',     color: '#8b5cf6', bg: '#ede9fe' },
  delivered:       { label: 'Đã giao',       color: '#10b981', bg: '#d1fae5' },
  delivery_failed: { label: 'Giao thất bại', color: '#be185d', bg: '#fce7f3' },
  cancelled:       { label: 'Đã hủy',        color: '#ef4444', bg: '#fee2e2' },
  return_pending:  { label: 'Chờ hoàn trả',  color: '#f97316', bg: '#fff7ed' },
  returned:        { label: 'Đã hoàn trả',   color: '#6b7280', bg: '#f3f4f6' },
};

// Map trạng thái → tên field count tương ứng trong DashboardStatsResponse (đếm chính xác toàn bộ,
// không phải mẫu 10 đơn) — dùng cho bảng "Đơn hàng theo trạng thái" ở section 2.
const ORDER_STATUS_COUNT_FIELD = {
  pending: 'pendingOrders', confirmed: 'confirmedOrders', shipping: 'shippingOrders',
  delivered: 'deliveredOrders', delivery_failed: 'deliveryFailedOrders', cancelled: 'cancelledOrders',
  return_pending: 'returnPendingOrders', returned: 'returnedOrders',
};

const PRESET_LABELS = {
  all:    'Toàn bộ thời gian',
  today:  'Hôm nay',
  '7days': '7 ngày qua',
  month:  'Tháng này',
  custom: 'Khoảng tùy chọn',
};

const DashboardReport = () => {
  const [params] = useSearchParams();
  const { user, isAdmin } = useAuth();

  const from   = params.get('from') ?? '';
  const to     = params.get('to')   ?? '';
  const preset = params.get('preset') ?? 'all';

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [stats,       setStats]       = useState(null);
  const [orders,      setOrders]      = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock,    setLowStock]    = useState([]);
  const [outOfStock,  setOutOfStock]  = useState([]);

  useEffect(() => {
    Promise.all([
      adminAPI.getStats(from, to),
      adminAPI.getOrders(0, 10, '', from, to),
      adminAPI.getTopProducts(8, from, to),
      adminAPI.getLowStockProducts(20, 5),
      adminAPI.getLowStockProducts(20, 0),
    ])
      .then(([st, ords, top, low, out]) => {
        setStats(st?.data ?? st);
        setOrders(ords?.data?.content ?? ords?.content ?? []);
        setTopProducts(top?.data ?? top ?? []);
        const lowArr = (low?.data ?? low ?? []).filter(p => (p.stockQty ?? 0) > 0);
        const outArr = (out?.data ?? out ?? []).filter(p => (p.stockQty ?? 0) === 0);
        setLowStock(lowArr);
        setOutOfStock(outArr);
      })
      .catch(e => setError(e.message || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [from, to]);

  // Tự in sau khi tải xong
  useEffect(() => {
    if (!loading && !error) {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [loading, error]);

  const printedAt = new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const rangeLabel = (() => {
    if (preset === 'all') return 'Toàn bộ thời gian';
    if (from || to) return `${from || '...'} → ${to || '...'}`;
    return PRESET_LABELS[preset] ?? preset;
  })();

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rpt-wrap">
          <div className="rpt-loading">
            <div className="rpt-spinner" />
            <span>Đang tải dữ liệu báo cáo...</span>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rpt-wrap">
          <div className="rpt-error-box">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="rpt-wrap">

        {/* ── Top bar (ẩn khi in) ── */}
        <div className="rpt-topbar">
          <span className="rpt-topbar-title">Xem trước báo cáo — {rangeLabel}</span>
          <div className="rpt-topbar-btns">
            <button className="rpt-back-btn" onClick={() => window.close()}>✕ Đóng</button>
            <button className="rpt-print-btn" onClick={() => window.print()}>🖨 In báo cáo</button>
          </div>
        </div>

        {/* ── Header báo cáo ── */}
        <div className="rpt-header">
          <div className="rpt-brand">
            <div className="rpt-brand-logo">BG</div>
            <div>
              <div className="rpt-brand-name">BếpGasVN</div>
              <div className="rpt-brand-sub">Hệ thống quản lý bán hàng</div>
            </div>
          </div>
          <div className="rpt-meta">
            <div className="rpt-meta-title">BÁO CÁO TỔNG QUAN</div>
            <div className="rpt-meta-range">Khoảng thời gian: {rangeLabel}</div>
            <div className="rpt-meta-printed">In lúc: {printedAt}{user?.name ? ` · ${user.name}` : ''}</div>
          </div>
        </div>

        {/* ══ 1. Doanh thu ══ */}
        {isAdmin && (
          <div className="rpt-section">
            <div className="rpt-section-title">Doanh thu</div>
            <table className="rpt-summary-table">
              <thead>
                <tr>
                  <th>Chỉ tiêu</th>
                  <th className="rpt-summary-value">Giá trị</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="rpt-summary-label">Doanh thu thực thu</td>
                  <td className="rpt-summary-value">{fmt(stats?.paidRevenue ?? 0)}</td>
                  <td className="rpt-summary-note">Tiền đã thu thật, đã trừ hoàn tiền</td>
                </tr>
                <tr>
                  <td className="rpt-summary-label">COD chưa thu</td>
                  <td className="rpt-summary-value">{fmt(stats?.debtRevenue ?? 0)}</td>
                  <td className="rpt-summary-note">{stats?.codDeliveredUnpaid ?? 0} đơn đã giao chưa thu</td>
                </tr>
                <tr>
                  <td className="rpt-summary-label">Doanh thu tạm tính</td>
                  <td className="rpt-summary-value">{fmt(stats?.pendingRevenue ?? 0)}</td>
                  <td className="rpt-summary-note">COD đang chờ xử lý / đang giao</td>
                </tr>
                <tr>
                  <td className="rpt-summary-label">Tiền đã hoàn</td>
                  <td className="rpt-summary-value">{fmt(stats?.refundedAmount ?? 0)}</td>
                  <td className="rpt-summary-note">Gồm hoàn 1 phần, hoàn toàn bộ và đơn hủy đã hoàn tiền</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ══ 2. Tổng đơn hàng ══ */}
        <div className="rpt-section">
          <div className="rpt-section-title">Đơn hàng theo trạng thái</div>
          <table className="rpt-summary-table">
            <thead>
              <tr>
                <th>Trạng thái</th>
                <th className="rpt-summary-value">Số đơn</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'pending',         note: 'Đơn mới cần kiểm tra' },
                { key: 'confirmed',       note: 'Đã duyệt, chờ xử lý tiếp' },
                { key: 'shipping',        note: 'Đơn đang vận chuyển' },
                { key: 'delivered',       note: 'Đơn đã hoàn tất giao hàng' },
                { key: 'delivery_failed', note: 'Giao không thành công, cần xử lý lại' },
                { key: 'cancelled',       note: 'Đơn đã hủy' },
                { key: 'return_pending',  note: 'Yêu cầu hoàn trả đang chờ duyệt' },
                { key: 'returned',        note: 'Đã hoàn trả xong toàn bộ sản phẩm' },
              ].map(s => {
                const count = stats?.[ORDER_STATUS_COUNT_FIELD[s.key]] ?? 0;
                return (
                  <tr key={s.key}>
                    <td className="rpt-summary-label">{STATUS_CFG[s.key].label}</td>
                    <td className="rpt-summary-value">{count}</td>
                    <td className="rpt-summary-note">{s.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ══ 3. Việc cần xử lý ══ */}
        <div className="rpt-section">
          <div className="rpt-section-title">Việc cần xử lý</div>
          <table className="rpt-summary-table">
            <thead>
              <tr>
                <th>Hạng mục</th>
                <th className="rpt-summary-value">Số lượng</th>
                <th>Mức độ</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Chờ xác nhận', count: stats?.pendingOrders,       note: 'Cần xác nhận đơn' },
                { label: 'COD chưa thu',  count: stats?.codDeliveredUnpaid,  note: 'Cần đối soát tiền mặt' },
                { label: 'Chờ hoàn trả', count: stats?.returnPendingOrders, note: 'Cần duyệt hoàn trả' },
                { label: 'Sắp hết hàng', count: stats?.lowStockProducts,    note: 'Cần theo dõi nhập hàng' },
                { label: 'Hết hàng',      count: outOfStock.length,          note: 'Cần bổ sung tồn kho' },
              ].map(t => {
                const count = t.count ?? 0;
                return (
                  <tr key={t.label}>
                    <td className="rpt-summary-label">{t.label}</td>
                    <td className="rpt-summary-value">{count}</td>
                    <td className="rpt-summary-note">{count > 0 ? t.note : 'Không phát sinh'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ══ 4. Top bán chạy ══ */}
        <div className="rpt-section">
          <div className="rpt-section-title">Sản phẩm bán chạy nhất · {rangeLabel}</div>
          {topProducts.length === 0
            ? <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Chưa có dữ liệu trong khoảng này.</p>
            : (
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th className="rpt-td-center" style={{ width: 36 }}>#</th>
                    <th>Sản phẩm</th>
                    <th className="rpt-td-num">SL bán</th>
                    {isAdmin && <th className="rpt-td-num">Doanh thu</th>}
                    <th className="rpt-td-num">Tồn kho</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => {
                    const statusLabel =
                      p.status === 'out_of_stock' ? 'Hết hàng' :
                      p.status === 'inactive'     ? 'Ngừng bán' :
                      p.status === 'deleted'      ? 'Đã xóa' : 'Đang bán';
                    return (
                      <tr key={p.productId ?? i}>
                        <td className="rpt-td-center">
                          <span className={`rpt-rank-badge rpt-rank-${Math.min(i + 1, 3)}`}>{i + 1}</span>
                        </td>
                        <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.productName}
                        </td>
                        <td className="rpt-td-num">{(p.totalQty ?? 0).toLocaleString()}</td>
                        {isAdmin && (
                          <td className="rpt-td-num">{p.totalRevenue > 0 ? fmt(p.totalRevenue) : '—'}</td>
                        )}
                        <td className="rpt-td-num">{p.stockQty != null ? p.stockQty.toLocaleString() : '—'}</td>
                        <td>
                          <span className="rpt-pill">
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>

        {/* ══ 5. Đơn hàng gần nhất ══ */}
        <div className="rpt-section">
          <div className="rpt-section-title">Đơn hàng gần nhất</div>
          {orders.length === 0
            ? <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Không có đơn hàng trong khoảng này.</p>
            : (
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    {isAdmin && <th className="rpt-td-num">Tổng tiền</th>}
                    <th>Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const oid = o.orderId ?? o.id;
                    const st  = STATUS_CFG[o.status] ?? { label: o.status, color: '#6b7280', bg: '#f3f4f6' };
                    const payLabel = o.paymentMethod === 'cod' ? 'COD' : o.paymentMethod === 'vnpay' ? 'VNPay' : o.paymentMethod;
                    const paidLabel = o.paymentStatus === 'paid' ? 'Đã thu' : o.paymentStatus === 'unpaid' ? 'Chưa thu' : o.paymentStatus;
                    return (
                      <tr key={oid}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>#{o.orderCode ?? oid}</td>
                        <td>{o.shippingName ?? '—'}</td>
                        <td style={{ fontSize: '0.78rem' }}>
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'}
                        </td>
                        <td>
                          <span className="rpt-pill">
                            {st.label}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="rpt-td-num">{fmt(o.totalAmount)}</td>
                        )}
                        <td style={{ fontSize: '0.78rem' }}>
                          {payLabel} · {paidLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>

        {/* ══ 6. Cảnh báo tồn kho ══ */}
        {(lowStock.length > 0 || outOfStock.length > 0) && (
          <div className="rpt-section">
            <div className="rpt-section-title">Cảnh báo tồn kho</div>
            <div className="rpt-stock-grid">

              <div>
                <div className="rpt-stock-col-title rpt-warn">
                  Sắp hết hàng ({lowStock.length})
                </div>
                {lowStock.length === 0
                  ? <p style={{ fontSize: '0.8rem' }}>Không có sản phẩm sắp hết.</p>
                  : lowStock.map((p, i) => (
                    <div key={p.id ?? i} className="rpt-stock-item">
                      <span className="rpt-stock-name">{p.name ?? p.productName}</span>
                      <span className="rpt-stock-qty-warn">Còn {p.stockQty}</span>
                    </div>
                  ))
                }
              </div>

              <div>
                <div className="rpt-stock-col-title rpt-error">
                  Hết hàng ({outOfStock.length})
                </div>
                {outOfStock.length === 0
                  ? <p style={{ fontSize: '0.8rem' }}>Không có sản phẩm hết hàng.</p>
                  : outOfStock.map((p, i) => (
                    <div key={p.id ?? i} className="rpt-stock-item">
                      <span className="rpt-stock-name">{p.name ?? p.productName}</span>
                      <span className="rpt-stock-qty-error">Hết hàng</span>
                    </div>
                  ))
                }
              </div>

            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="rpt-footer">
          <span>BếpGasVN — Hệ thống quản lý bán hàng</span>
          <span>In lúc {printedAt}{user?.name ? ` bởi ${user.name}` : ''}</span>
        </div>

      </div>
    </>
  );
};

export default DashboardReport;
