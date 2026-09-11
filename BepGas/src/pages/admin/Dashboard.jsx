// Trang tổng quan quản trị — hiển thị doanh thu, đơn hàng, sản phẩm bán chạy và tồn kho sắp hết.
// Mỗi block dữ liệu tải độc lập (per-block loading) để không chặn toàn trang khi một block lỗi.
// Staff không thấy số liệu doanh thu (ẩn), Admin xem đầy đủ mọi thông tin.
// Bộ lọc thời gian dùng local date (không UTC) để tránh lệch ngày theo múi giờ Việt Nam.
import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Package, Calendar,
  Loader, Clock, Truck, CheckCircle, XCircle,
  Banknote, AlertTriangle, Route, RotateCcw, RefreshCw,
  ExternalLink, ChevronRight, Printer,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import { fmt } from '../../utils/formatters';
import { toast } from '../../utils/toast';

// Hiển thị thời gian tương đối như "5 phút trước", "Hôm qua" thay vì timestamp đầy đủ.
const timeAgo = (dateStr) => {
  if (!dateStr) return '—';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Vừa xong';
  if (mins  < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days  === 1) return 'Hôm qua';
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const getProductImg = (p) =>
  p.images?.find(i => i.isPrimary)?.imageUrl ?? p.images?.[0]?.imageUrl
  ?? p.primaryImageUrl ?? p.imageUrl ?? p.image ?? '';

const STATUS_CFG = {
  pending:         { label:'Chờ xử lý',     color:'#f59e0b', bg:'#fef3c7', icon:<Clock size={12}/> },
  confirmed:       { label:'Đã xác nhận',   color:'#3b82f6', bg:'#dbeafe', icon:<CheckCircle size={12}/> },
  shipping:        { label:'Đang giao',      color:'#8b5cf6', bg:'#ede9fe', icon:<Truck size={12}/> },
  delivered:       { label:'Đã giao',       color:'#10b981', bg:'#d1fae5', icon:<CheckCircle size={12}/> },
  delivery_failed: { label:'Giao thất bại', color:'#be185d', bg:'#fce7f3', icon:<XCircle size={12}/> },
  cancelled:       { label:'Đã hủy',        color:'#ef4444', bg:'#fee2e2', icon:<XCircle size={12}/> },
  return_pending:  { label:'Chờ hoàn trả', color:'#f97316', bg:'#fff7ed', icon:<RotateCcw size={12}/> },
  returned:        { label:'Đã hoàn trả',   color:'#6b7280', bg:'#f3f4f6', icon:<RotateCcw size={12}/> },
};

// ORDER_STATUS_KEYS: thứ tự hiển thị 8 trạng thái trong lưới "Thống kê đơn hàng" — khớp luồng
// nghiệp vụ pending → confirmed → shipping → delivered (hoặc delivery_failed/cancelled/return_pending → returned).
const ORDER_STATUS_KEYS = [
  'pending', 'confirmed', 'shipping', 'delivered',
  'delivery_failed', 'cancelled', 'return_pending', 'returned',
];
// Map trạng thái → tên field count tương ứng trong DashboardStatsResponse
const ORDER_STATUS_COUNT_FIELD = {
  pending: 'pendingOrders', confirmed: 'confirmedOrders', shipping: 'shippingOrders',
  delivered: 'deliveredOrders', delivery_failed: 'deliveryFailedOrders', cancelled: 'cancelledOrders',
  return_pending: 'returnPendingOrders', returned: 'returnedOrders',
};

const BlockLoader = () => (
  <div className="dash-block-loader"><Loader size={20} className="spin"/></div>
);
const BlockError = ({ msg, onRetry }) => (
  <div className="dash-block-error">
    <AlertTriangle size={16}/> {msg}
    {onRetry && <button onClick={onRetry} className="dash-retry-btn"><RefreshCw size={12}/> Thử lại</button>}
  </div>
);

// Chuyển Date object thành chuỗi YYYY-MM-DD theo múi giờ local (không UTC) để tránh lệch ngày ở VN.
const toLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => toLocalDate(new Date());
const nDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toLocalDate(d); };
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const TIME_PRESETS = [
  { key: 'all',    label: 'Tất cả',     getRange: () => ({ from: '', to: '' }) },
  { key: 'today',  label: 'Hôm nay',    getRange: () => ({ from: today(), to: today() }) },
  { key: '7days',  label: '7 ngày',     getRange: () => ({ from: nDaysAgo(6), to: today() }) },
  { key: 'month',  label: 'Tháng này',  getRange: () => ({ from: monthStart(), to: today() }) },
  { key: 'custom', label: 'Tùy chọn',   getRange: null },
];

const Dashboard = () => {
  const navigate        = useNavigate();
  const { isAdmin }     = useAuth(); // staff không thấy doanh thu

  // ── Time filter state ──
  const [activePreset,  setActivePreset]  = useState('all');
  const [customFrom,    setCustomFrom]    = useState('');
  const [customTo,      setCustomTo]      = useState('');

  const getActiveDates = () => {
    const preset = TIME_PRESETS.find(p => p.key === activePreset);
    if (activePreset === 'custom') return { from: customFrom, to: customTo };
    return preset?.getRange?.() ?? { from: '', to: '' };
  };

  const [stats,           setStats]          = useState(null);
  const [orders,          setOrders]         = useState([]);
  const [topProducts,     setTopProducts]    = useState([]);
  const [lowStockList,    setLowStockList]   = useState([]);
  const [outOfStockList,  setOutOfStockList] = useState([]);
  const [statsLoading,    setStatsLoading]   = useState(true);
  const [ordersLoading,   setOrdersLoading]  = useState(true);
  const [productsLoading, setProductsLoading]= useState(true);
  const [statsError,      setStatsError]     = useState('');
  const [ordersError,     setOrdersError]    = useState('');
  const [productsError,   setProductsError]  = useState('');
  const [updating,        setUpdating]       = useState(null);

  const fetchStats = useCallback(async (from = '', to = '') => {
    setStatsLoading(true); setStatsError('');
    try   { const r = await adminAPI.getStats(from, to); setStats(r?.data ?? r); }
    catch (e) { setStatsError(e.message || 'Không tải được thống kê'); setStats(null); }
    finally { setStatsLoading(false); }
  }, []);

  const fetchOrders = useCallback(async (from = '', to = '') => {
    setOrdersLoading(true); setOrdersError('');
    try {
      const r = await adminAPI.getOrders(0, 10, '', from, to);
      setOrders(r?.data?.content ?? r?.content ?? []);
    } catch (e) { setOrdersError(e.message || 'Lỗi tải đơn hàng'); }
    finally     { setOrdersLoading(false); }
  }, []);

  const fetchProducts = useCallback(async (from = '', to = '') => {
    setProductsLoading(true); setProductsError('');
    try {
      // Top bán chạy từ đơn đã giao trong khoảng thời gian đang chọn
      const top = await adminAPI.getTopProducts(5, from, to);
      setTopProducts(top?.data ?? top ?? []);
      // Sắp hết hàng / hết hàng — luôn từ toàn DB (không lọc theo thời gian)
      const lowRes = await adminAPI.getLowStockProducts(8, 5);
      const allLow = lowRes?.data ?? lowRes ?? [];
      setLowStockList(allLow.filter(p => (p.stockQty ?? 0) > 0));
      const outRes = await adminAPI.getLowStockProducts(12, 0);
      const allOut = outRes?.data ?? outRes ?? [];
      setOutOfStockList(allOut.filter(p => (p.stockQty ?? 0) === 0));
    } catch (e) { setProductsError(e.message || 'Lỗi tải sản phẩm'); }
    finally      { setProductsLoading(false); }
  }, []);

  useEffect(() => {
    const { from, to } = getActiveDates();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats(from, to);
    fetchOrders(from, to);
    fetchProducts(from, to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStats, fetchOrders, fetchProducts]);

  // Khi thay đổi preset: re-fetch tất cả theo range mới
  const applyPreset = (preset) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const p = TIME_PRESETS.find(x => x.key === preset);
      const { from, to } = p.getRange?.() ?? { from: '', to: '' };
      fetchStats(from, to);
      fetchOrders(from, to);
      fetchProducts(from, to);
    }
  };

  const applyCustomRange = () => {
    if (customFrom || customTo) {
      fetchStats(customFrom, customTo);
      fetchOrders(customFrom, customTo);
      fetchProducts(customFrom, customTo);
    }
  };

  const refreshAll = () => {
    const { from, to } = getActiveDates();
    fetchStats(from, to); fetchOrders(from, to); fetchProducts(from, to);
  };

  const quickConfirmPayment = async (orderId) => {
    setUpdating(orderId);
    try {
      await adminAPI.confirmPayment(orderId);
      setOrders(prev => prev.map(o =>
        (o.orderId ?? o.id) === orderId ? { ...o, paymentStatus: 'paid' } : o));
      const { from, to } = getActiveDates();
      fetchStats(from, to);
    } catch (e) {
      toast.error('Lỗi xác nhận thanh toán: ' + (e.message || 'Vui lòng thử lại'));
    } finally { setUpdating(null); }
  };

  /* ── Tasks — mỗi ô là 1 việc cần xử lý ── */
  // Gắn fromDate/toDate vào link khi đang lọc theo thời gian
  const withDateRange = (base) => {
    if (activePreset === 'all') return base;
    const { from, to } = getActiveDates();
    const sep = base.includes('?') ? '&' : '?';
    const params = [from ? `fromDate=${from}` : '', to ? `toDate=${to}` : '']
      .filter(Boolean).join('&');
    return params ? `${base}${sep}${params}` : base;
  };

  // Link sang trang chi tiết doanh thu (/admin/dashboard/revenue-detail?type=...), giữ đúng
  // khoảng thời gian đang chọn trên Dashboard để số liệu 2 trang khớp nhau.
  const revenueDetailHref = (type) => {
    const params = new URLSearchParams({ type });
    if (activePreset !== 'all') {
      const { from, to } = getActiveDates();
      if (from) params.set('fromDate', from);
      if (to)   params.set('toDate',   to);
    }
    return `/admin/dashboard/revenue-detail?${params}`;
  };

  // Phân biệt tasks theo range vs. toàn hệ thống
  const TASKS = [
    {
      label: 'Chờ xác nhận', count: stats?.pendingOrders,
      color: '#f59e0b', icon: <Clock size={18}/>,
      href: withDateRange('/admin/orders?status=pending'),
      urgent: (stats?.pendingOrders ?? 0) > 0,
      ranged: true, // bị lọc theo date range
    },
    {
      label: 'COD chưa thu', count: stats?.codDeliveredUnpaid,
      color: '#dc2626', icon: <Banknote size={18}/>,
      href: withDateRange('/admin/orders?status=delivered&paymentMethod=cod&paymentStatus=unpaid'),
      urgent: (stats?.codDeliveredUnpaid ?? 0) > 0,
      ranged: true,
    },
    {
      label: 'Chờ hoàn trả', count: stats?.returnPendingOrders,
      color: '#f97316', icon: <RotateCcw size={18}/>,
      href: withDateRange('/admin/orders?status=return_pending'),
      urgent: (stats?.returnPendingOrders ?? 0) > 0,
      ranged: true,
    },
    {
      label: 'Sắp hết hàng', count: stats?.lowStockProducts,
      color: '#f97316', icon: <Package size={18}/>,
      href: '/admin/products?lowStock=1',
      urgent: (stats?.lowStockProducts ?? 0) > 0,
      ranged: false,
    },
    {
      label: 'Hết hàng', count: outOfStockList.length,
      color: '#ef4444', icon: <XCircle size={18}/>,
      href: '/admin/products?status=out_of_stock',
      urgent: outOfStockList.length > 0,
      ranged: false,
    },
  ];

  return (
    <div className="admin-page">

      {/* ── Header + Time filter ── */}
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <span className="admin-date">
            {new Date().toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}
          </span>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button className="admin-btn-ghost dash-refresh-btn" onClick={() => {
            const { from, to } = getActiveDates();
            const p = new URLSearchParams({ preset: activePreset });
            if (from) p.set('from', from);
            if (to)   p.set('to',   to);
            window.open(`/admin/dashboard/report?${p.toString()}`, '_blank');
          }}>
            <Printer size={15}/> In báo cáo
          </button>
          <button className="admin-btn-ghost dash-refresh-btn" onClick={refreshAll}>
            <RefreshCw size={15}/> Làm mới
          </button>
        </div>
      </div>

      {/* ── Bộ lọc thời gian — ảnh hưởng TẤT CẢ KPI ── */}
      <div className="dash-time-filter-bar">
        <Calendar size={15} style={{ color:'var(--text-light)', flexShrink:0 }}/>
        <div className="dash-preset-btns">
          {TIME_PRESETS.map(p => (
            <button key={p.key}
              className={`dash-tf-btn ${activePreset === p.key ? 'active' : ''}`}
              onClick={() => applyPreset(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        {activePreset === 'custom' && (
          <div className="dash-custom-range">
            <input type="date" value={customFrom} max={customTo || today()}
              onChange={e => setCustomFrom(e.target.value)}
              className="dash-date-input" title="Từ ngày"/>
            <span style={{ color:'var(--text-light)' }}>—</span>
            <input type="date" value={customTo} min={customFrom} max={today()}
              onChange={e => setCustomTo(e.target.value)}
              className="dash-date-input" title="Đến ngày"/>
            <button className="admin-btn-primary" style={{ padding:'0.3rem 0.75rem', fontSize:'0.82rem' }}
              onClick={applyCustomRange}
              disabled={!customFrom && !customTo}>
              Áp dụng
            </button>
          </div>
        )}

        {/* Label khoảng thời gian đang xem */}
        {activePreset !== 'all' && (
          <span className="dash-range-label">
            {activePreset === 'custom'
              ? (customFrom || customTo ? `${customFrom || '...'} → ${customTo || '...'}` : '')
              : (() => { const { from, to } = getActiveDates(); return `${from} → ${to}`; })()}
          </span>
        )}
      </div>

      {/* Lỗi stats — banner cảnh báo nổi bật */}
      {statsError && (
        <div className="dash-stats-error">
          <AlertTriangle size={16}/>
          <span>Không tải được thống kê: <strong>{statsError}</strong></span>
          <button className="dash-retry-btn" onClick={() => { const { from, to } = getActiveDates(); fetchStats(from, to); }}>
            <RefreshCw size={13}/> Thử lại
          </button>
        </div>
      )}

      {/* ══ 4 ô Doanh thu — bấm vào mở trang chi tiết danh sách đơn cấu thành con số đó ══ */}
      {isAdmin && (
        <div className="dash-revenue-grid">
          <Link to={revenueDetailHref('actual')} className="dash-rev-card dash-rev-paid dash-rev-link">
            <div className="dash-rev-icon"><Banknote size={22}/></div>
            <div className="dash-rev-body">
              <span className="dash-rev-label">Doanh thu thực thu</span>
              {statsLoading
                ? <span className="dash-rev-value">—</span>
                : <strong className="dash-rev-value">{fmt(stats?.paidRevenue)}</strong>}
              <span className="dash-rev-sub">Tiền đã thu thật, đã trừ hoàn tiền</span>
            </div>
            <ChevronRight size={16} className="dash-rev-arrow"/>
          </Link>

          <Link to={revenueDetailHref('cod-unpaid')}
            className={`dash-rev-card dash-rev-link ${(stats?.debtRevenue ?? 0) > 0 ? 'dash-rev-debt-urgent' : 'dash-rev-debt'}`}>
            <div className="dash-rev-icon" style={{ position:'relative' }}>
              <AlertTriangle size={22}/>
              {(stats?.debtRevenue ?? 0) > 0 && <span className="dash-rev-dot"/>}
            </div>
            <div className="dash-rev-body">
              <span className="dash-rev-label">
                COD chưa thu
                {(stats?.codDeliveredUnpaid ?? 0) > 0 && (
                  <span className="dash-debt-badge">{stats.codDeliveredUnpaid} đơn</span>
                )}
              </span>
              {statsLoading
                ? <span className="dash-rev-value">—</span>
                : <strong className="dash-rev-value">{fmt(stats?.debtRevenue)}</strong>}
              <span className="dash-rev-sub">Đã giao, chưa xác nhận thu tiền</span>
            </div>
            <ChevronRight size={16} className="dash-rev-arrow"/>
          </Link>

          <Link to={revenueDetailHref('estimated')} className="dash-rev-card dash-rev-pending dash-rev-link">
            <div className="dash-rev-icon"><Route size={22}/></div>
            <div className="dash-rev-body">
              <span className="dash-rev-label">Doanh thu tạm tính</span>
              {statsLoading
                ? <span className="dash-rev-value">—</span>
                : <strong className="dash-rev-value">{fmt(stats?.pendingRevenue)}</strong>}
              <span className="dash-rev-sub">COD đang chờ xử lý / đang giao</span>
            </div>
            <ChevronRight size={16} className="dash-rev-arrow"/>
          </Link>

          <Link to={revenueDetailHref('refunded')} className="dash-rev-card dash-rev-refunded dash-rev-link">
            <div className="dash-rev-icon"><RotateCcw size={22}/></div>
            <div className="dash-rev-body">
              <span className="dash-rev-label">Tiền đã hoàn</span>
              {statsLoading
                ? <span className="dash-rev-value">—</span>
                : <strong className="dash-rev-value">{fmt(stats?.refundedAmount)}</strong>}
              <span className="dash-rev-sub">Hoàn 1 phần / toàn bộ / đơn hủy đã thanh toán</span>
            </div>
            <ChevronRight size={16} className="dash-rev-arrow"/>
          </Link>
        </div>
        
      )}

      {/* ══ Việc cần xử lý ══ */}
      <div className="dash-tasks-block">
        <div className="dash-tasks-title">
          <AlertTriangle size={16} color="#f59e0b"/> Cần xử lý
          <span className="dash-tasks-note">
            {activePreset === 'all'
              ? '— Toàn bộ hệ thống'
              : `— Theo ${TIME_PRESETS.find(p => p.key === activePreset)?.label ?? 'khoảng chọn'} · *Hết hàng: luôn là trạng thái hiện tại`}
          </span>
        </div>
        <div className="dash-tasks-grid">
          {TASKS.map(t => (
            <Link key={t.label} to={t.href}
              className={`dash-task-card ${(t.count ?? 0) > 0 ? 'dash-task-active' : 'dash-task-zero'} ${t.urgent && (t.count ?? 0) > 0 ? 'dash-task-urgent' : ''} ${t.noPrint ? 'dash-task-no-print' : ''}`}
            >
              <div className="dash-task-icon" style={{ color: (t.count ?? 0) > 0 ? t.color : '#d1d5db' }}>
                {statsLoading ? <Loader size={18} className="spin"/> : t.icon}
              </div>
              <span className="dash-task-count">
                {statsLoading ? '—' : (t.count ?? 0)}
              </span>
              <span className="dash-task-label">{t.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ══ Thống kê đơn hàng — đủ 8 trạng thái, số liệu chính xác từ stats (không phải mẫu 10 đơn) ══ */}
      <div className="dash-tasks-block">
        <div className="dash-tasks-title">
          <ShoppingBag size={16} color="#3b82f6"/> Thống kê đơn hàng
          <span className="dash-tasks-note">
            {activePreset === 'all'
              ? '— Toàn bộ hệ thống'
              : `— Theo ${TIME_PRESETS.find(p => p.key === activePreset)?.label ?? 'khoảng chọn'}`}
          </span>
        </div>

        {/* KPI tổng hợp — Giá trị TB/đơn và Tiền đã hoàn chỉ Admin mới thấy (gắn với doanh thu) */}
        <div className="dash-order-kpi-row">
          <div className="dash-order-kpi">
            <span className="dash-order-kpi-label">Tổng đơn</span>
            <strong>{statsLoading ? '—' : (stats?.totalOrders ?? 0)}</strong>
          </div>
          <div className="dash-order-kpi">
            <span className="dash-order-kpi-label">Đơn hôm nay</span>
            <strong>{statsLoading ? '—' : (stats?.todayOrders ?? 0)}</strong>
          </div>
          {isAdmin && (
            <div className="dash-order-kpi">
              <span className="dash-order-kpi-label">Giá trị TB/đơn</span>
              <strong>{statsLoading ? '—' : fmt((stats?.paidRevenue ?? 0) / Math.max(stats?.deliveredOrders ?? 0, 1))}</strong>
            </div>
          )}
          {isAdmin && (stats?.refundedAmount ?? 0) > 0 && (
            <div className="dash-order-kpi">
              <span className="dash-order-kpi-label">Tiền đã hoàn trong kỳ</span>
              <strong style={{ color: '#c2410c' }}>−{fmt(stats.refundedAmount)}</strong>
            </div>
          )}
        </div>

        {/* Lưới đủ 8 trạng thái — bấm vào điều hướng sang danh sách đơn đã lọc đúng trạng thái + khoảng thời gian */}
        <div className="dash-tasks-grid">
          {ORDER_STATUS_KEYS.map(key => {
            const cfg   = STATUS_CFG[key];
            const count = stats?.[ORDER_STATUS_COUNT_FIELD[key]] ?? 0;
            return (
              <Link key={key} to={withDateRange(`/admin/orders?status=${key}`)}
                className={`dash-task-card ${count > 0 ? 'dash-task-active' : 'dash-task-zero'}`}
              >
                <div className="dash-task-icon" style={{ color: count > 0 ? cfg.color : '#d1d5db' }}>
                  {statsLoading ? <Loader size={18} className="spin"/> : cfg.icon}
                </div>
                <span className="dash-task-count">{statsLoading ? '—' : count}</span>
                <span className="dash-task-label">{cfg.label}</span>
              </Link>
            );
          })}
          {/* COD đã giao chưa thu — không phải 1 order status riêng (là delivered+cod+unpaid) nên tách khỏi ORDER_STATUS_KEYS */}
          <Link to={withDateRange('/admin/orders?status=delivered&paymentMethod=cod&paymentStatus=unpaid')}
            className={`dash-task-card ${(stats?.codDeliveredUnpaid ?? 0) > 0 ? 'dash-task-active' : 'dash-task-zero'}`}
          >
            <div className="dash-task-icon" style={{ color: (stats?.codDeliveredUnpaid ?? 0) > 0 ? '#dc2626' : '#d1d5db' }}>
              {statsLoading ? <Loader size={18} className="spin"/> : <Banknote size={12}/>}
            </div>
            <span className="dash-task-count">{statsLoading ? '—' : (stats?.codDeliveredUnpaid ?? 0)}</span>
            <span className="dash-task-label">COD đã giao chưa thu</span>
          </Link>
        </div>
      </div>

      {/* ══ 2 cột chính ══ */}
      <div className="dash-main-grid">

        {/* ── Đơn hàng — title và note thay đổi theo time filter ── */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>
              <ShoppingBag size={16}/>
              {activePreset === 'all'
                ? ' Đơn hàng gần đây'
                : ` Đơn hàng ${TIME_PRESETS.find(p => p.key === activePreset)?.label ?? 'đã chọn'}`}
            </h3>
            <Link to={withDateRange('/admin/orders')} className="admin-see-all">Xem tất cả →</Link>
          </div>
          <p className="dash-data-note">
            {activePreset === 'all'
              ? '10 đơn mới nhất toàn hệ thống'
              : `10 đơn tạo trong khoảng ${activePreset === 'custom' ? `${customFrom || '...'} → ${customTo || '...'}` : TIME_PRESETS.find(p => p.key === activePreset)?.label}`}
          </p>

          {ordersLoading ? <BlockLoader/> : ordersError ? <BlockError msg={ordersError} onRetry={() => { const { from, to } = getActiveDates(); fetchOrders(from, to); }}/> : (
            <div className="dash-orders-list">
              {orders.length === 0
                ? <p className="dash-empty">Chưa có đơn hàng.</p>
                : orders.map(o => {
                    const oid = o.orderId ?? o.id;
                    const st  = STATUS_CFG[o.status] ?? { label: o.status, color:'#6b7280', bg:'#f3f4f6', icon:null };
                    const busy = updating === oid;
                    return (
                      <div key={oid} className="dash-order-row">
                        <div className="dash-order-info">
                          <span className="dash-order-code">#{o.orderCode ?? oid}</span>
                          <span className="dash-order-meta">
                            {o.shippingName} · {timeAgo(o.createdAt)}
                          </span>
                        </div>
                        <div className="dash-order-mid">
                          <span className="dash-status-pill" style={{ color: st.color, background: st.bg }}>
                            {st.icon} {st.label}
                          </span>
                          {isAdmin && <span className="dash-order-amount">{fmt(o.totalAmount)}</span>}
                        </div>
                        <div className="dash-order-actions">
                          <button className="dash-act-btn" title="Xem chi tiết đơn hàng"
                            onClick={() => navigate(`/admin/orders?orderId=${oid}`)}>
                            <ExternalLink size={13}/>
                          </button>
                          {o.status === 'delivered' && o.paymentMethod === 'cod' && o.paymentStatus === 'unpaid' && (
                            <button className="dash-act-btn dash-act-cod"
                              title="Xác nhận đã thu COD" disabled={busy}
                              onClick={() => quickConfirmPayment(oid)}>
                              {busy ? <Loader size={13} className="spin"/> : <Banknote size={13}/>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}
        </div>

        {/* ── Cột phải ── */}
        <div className="dash-col-right">

          {/* Bán chạy nhất */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3><Package size={16}/> Bán chạy nhất</h3>
              <Link to="/admin/sales" className="admin-see-all">Xem tất cả →</Link>
            </div>
            <p className="dash-data-note">
              Đơn đã giao ·{' '}
              {activePreset === 'all'   ? 'Toàn bộ thời gian'
              : activePreset === 'custom' ? `${customFrom || '...'} → ${customTo || '...'}`
              : TIME_PRESETS.find(x => x.key === activePreset)?.label ?? activePreset}
            </p>
            {productsLoading ? <BlockLoader/> : productsError
              ? <BlockError msg={productsError} onRetry={() => { const {from,to}=getActiveDates(); fetchProducts(from,to); }}/>
              : (
              <div className="dash-top-list">
                {topProducts.length === 0
                  ? <p className="dash-empty">Chưa có sản phẩm bán trong khoảng này.</p>
                  : topProducts.map((p, i) => {
                      const isOOS      = p.status === 'out_of_stock';
                      const isInactive = p.status === 'inactive';
                      const isDeleted  = p.status === 'deleted';
                      const needRestock = isOOS && (p.totalQty ?? 0) >= 3;
                      return (
                        <div key={p.productId ?? i}
                          className={`dash-top-row${needRestock ? ' dash-restock-alert' : ''}`}>
                          <span className={`dash-rank dash-rank-${Math.min(i + 1, 5)}`}>{i + 1}</span>
                          <div className="dash-top-img">
                            {p.productImage
                              ? <img src={p.productImage} alt={p.productName}/>
                              : <Package size={16} color="#d1d5db"/>}
                          </div>
                          <div className="dash-top-info">
                            <span className="admin-top-name">
                              {p.productName}
                              {isOOS      && <span className="dash-inactive-badge" style={{background:'#fee2e2',color:'#ef4444',borderColor:'#fca5a5'}}>Hết hàng</span>}
                              {isInactive && <span className="dash-inactive-badge">Ngừng bán</span>}
                              {isDeleted  && <span className="dash-inactive-badge">Đã xóa</span>}
                            </span>
                            <span className="admin-top-reviews">
                              <strong>{(p.totalQty ?? 0).toLocaleString()}</strong> sản phẩm
                              {/* Doanh thu — đang tạm ẩn theo yêu cầu.
                              {isAdmin && p.totalRevenue > 0 && (
                                <span style={{ marginLeft:6, color:'#6b7280' }}>· {fmt(p.totalRevenue)}</span>
                              )}
                              */}
                            </span>
                          </div>
                          <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                            {/* Nút "Xem sản phẩm" (mở trong cửa sổ mới) — đang tạm ẩn theo yêu cầu.
                                {!isDeleted && p.slug && (
                                  <Link to={`/admin/products`}
                                    className="dash-act-btn" title="Xem sản phẩm">
                                    <ExternalLink size={13}/>
                                  </Link>
                                )}
                            */}
                            {(isOOS || isInactive) && (
                              <Link to={`/admin/products`}
                                className="dash-act-btn dash-act-warn" title="Sửa tồn kho">
                                <AlertTriangle size={13}/>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                }
              </div>
            )}
          </div>

          {/* Sắp hết hàng (stockQty 1–5) */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 style={{ color: lowStockList.length > 0 ? '#f97316' : 'inherit' }}>
                <AlertTriangle size={16}/> Sắp hết hàng
                {lowStockList.length > 0 && (
                  <span className="dash-debt-badge" style={{ background:'#fff7ed', color:'#f97316' }}>
                    {lowStockList.length}
                  </span>
                )}
              </h3>
              <Link to="/admin/products?lowStock=1" className="admin-see-all">Quản lý →</Link>
            </div>
            {productsLoading ? <BlockLoader/> : (
              lowStockList.length === 0
                ? <p className="dash-empty" style={{ color:'#10b981' }}>✓ Tồn kho ổn định</p>
                : <div className="dash-top-list">
                    {lowStockList.map((p, i) => (
                      <div key={p.id ?? i} className="dash-top-row dash-low-stock-row">
                        <div className="dash-top-img">
                          {getProductImg(p) ? <img src={getProductImg(p)} alt={p.name}/> : <Package size={16} color="#d1d5db"/>}
                        </div>
                        <div className="dash-top-info">
                          <span className="admin-top-name">{p.name ?? p.productName}</span>
                          <span className="admin-top-reviews" style={{ color:'#f97316' }}>
                            Còn {p.stockQty}
                          </span>
                        </div>
                        <Link to="/admin/products?lowStock=1" className="dash-act-btn" title="Quản lý">
                          <ExternalLink size={13}/>
                        </Link>
                      </div>
                    ))}
                  </div>
            )}
          </div>

          {/* Hết hàng (stockQty = 0) */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 style={{ color: outOfStockList.length > 0 ? '#ef4444' : 'inherit' }}>
                <XCircle size={16}/> Hết hàng
                {outOfStockList.length > 0 && (
                  <span className="dash-debt-badge" style={{ background:'#fee2e2', color:'#ef4444' }}>
                    {outOfStockList.length}
                  </span>
                )}
              </h3>
              <Link to="/admin/products?status=out_of_stock" className="admin-see-all">Quản lý →</Link>
            </div>
            {productsLoading ? <BlockLoader/> : (
              outOfStockList.length === 0
                ? <p className="dash-empty" style={{ color:'#10b981' }}>✓ Không có sản phẩm hết hàng</p>
                : <div className="dash-top-list">
                    {outOfStockList.map((p, i) => (
                      <div key={p.id ?? i} className="dash-top-row dash-low-stock-row">
                        <div className="dash-top-img">
                          {getProductImg(p) ? <img src={getProductImg(p)} alt={p.name}/> : <Package size={16} color="#d1d5db"/>}
                        </div>
                        <div className="dash-top-info">
                          <span className="admin-top-name">{p.name ?? p.productName}</span>
                          <span className="admin-top-reviews" style={{ color:'#ef4444', fontWeight:600 }}>
                            Hết hàng
                          </span>
                        </div>
                        <Link to="/admin/products?status=out_of_stock" className="dash-act-btn" title="Quản lý">
                          <ExternalLink size={13}/>
                        </Link>
                      </div>
                    ))}
                  </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
