// Trang chi tiết doanh thu — admin bấm vào 1 trong 4 ô doanh thu trên Dashboard để xem đúng
// danh sách đơn cấu thành con số đó (?type=actual|cod-unpaid|estimated|refunded).
// Dùng chung 1 trang cho cả 4 loại — chỉ đổi tiêu đề, mô tả và nhãn cột cuối theo type.
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader } from 'lucide-react';
import { adminAPI } from '../../services/api';
import ErrorState from '../../components/ErrorState';
import { fmt } from '../../utils/formatters';
import {
  ORDER_STATUS_CONFIG as statusConfig,
  PAY_METHOD_LABEL as paymentLabels,
  PAY_STATUS_CONFIG as payStatusConfig,
} from '../../constants/adminConstants';

// Cấu hình hiển thị riêng cho từng type — title/description cho header, label cho cột cuối bảng
// và dòng tổng "Tổng theo chỉ số".
const TYPE_CONFIG = {
  actual: {
    title: 'Doanh thu thực thu',
    desc: 'Tiền đã thu thật, đã trừ phần đã hoàn cho khách',
    countedLabel: 'Thực thu',
  },
  'cod-unpaid': {
    title: 'COD chưa thu',
    desc: 'Đơn COD đã giao nhưng chưa xác nhận thu tiền',
    countedLabel: 'Chưa thu',
  },
  estimated: {
    title: 'Doanh thu tạm tính',
    desc: 'Đơn COD đang chờ xử lý hoặc đang giao',
    countedLabel: 'Tạm tính',
  },
  refunded: {
    title: 'Tiền đã hoàn',
    desc: 'Số tiền đã hoàn cho khách trong kỳ — gồm hoàn 1 phần, hoàn toàn bộ sản phẩm và đơn hủy VNPay đã thanh toán',
    countedLabel: 'Đã hoàn',
  },
};

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const DashboardRevenueDetail = () => {
  const [searchParams] = useSearchParams();
  const type     = searchParams.get('type') ?? 'actual';
  const fromDate = searchParams.get('fromDate') ?? '';
  const toDate   = searchParams.get('toDate') ?? '';
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.actual;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    adminAPI.getRevenueDetail(type, fromDate, toDate)
      .then(res => setData(res?.data ?? res))
      .catch(err => setError(err.message || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [type, fromDate, toDate]);

  const backHref = `/admin${(fromDate || toDate)
    ? `?${[fromDate && `fromDate=${fromDate}`, toDate && `toDate=${toDate}`].filter(Boolean).join('&')}`
    : ''}`;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <Link to={backHref} className="admin-btn-ghost" style={{ marginBottom: '0.6rem', display: 'inline-flex' }}>
            <ArrowLeft size={15}/> Quay lại Dashboard
          </Link>
          <h1>{cfg.title}</h1>
          <span className="admin-date">
            {cfg.desc}{(fromDate || toDate) ? ` — ${fromDate || '...'} → ${toDate || '...'}` : ' — Toàn bộ thời gian'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="admin-center"><Loader size={32} className="spin"/><p>Đang tải...</p></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); }}/>
      ) : (
        <>
          {/* Tổng hợp — đối chiếu với con số đang hiện trên dashboard */}
          <div className="rvd-summary-grid">
            <div className="rvd-summary-box">
              <span className="rvd-summary-label">Tổng đơn</span>
              <strong>{data.totalOrders}</strong>
            </div>
            <div className="rvd-summary-box">
              <span className="rvd-summary-label">Tổng giá trị đơn</span>
              <strong>{fmt(data.totalAmountSum)}</strong>
            </div>
            <div className="rvd-summary-box">
              <span className="rvd-summary-label">Đã hoàn</span>
              <strong style={{ color: (data.refundedAmountSum ?? 0) > 0 ? '#c2410c' : undefined }}>
                {fmt(data.refundedAmountSum)}
              </strong>
            </div>
            <div className="rvd-summary-box rvd-summary-counted">
              <span className="rvd-summary-label">Tổng theo chỉ số ({cfg.countedLabel})</span>
              <strong>{fmt(data.countedAmountSum)}</strong>
            </div>
          </div>

          <div className="admin-card">
            {data.rows.length === 0 ? (
              <p className="text-light" style={{ padding: '1.5rem', textAlign: 'center' }}>
                Không có đơn nào trong khoảng thời gian này.
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày</th>
                    <th>Khách hàng</th>
                    <th>Phương thức</th>
                    <th>Trạng thái đơn</th>
                    <th>Trạng thái tiền</th>
                    <th style={{ textAlign: 'right' }}>Tổng đơn</th>
                    <th style={{ textAlign: 'right' }}>Đã hoàn</th>
                    <th style={{ textAlign: 'right' }}>{cfg.countedLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => {
                    const sc = statusConfig[row.status] ?? { label: row.status, color: '#6b7280', bg: '#f3f4f6' };
                    const ps = payStatusConfig[row.paymentStatus];
                    return (
                      <tr key={row.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>#{row.orderCode ?? row.id}</td>
                        <td>{fmtDate(row.createdAt)}</td>
                        <td>{row.shippingName ?? '—'}</td>
                        <td><span className="admin-pay-tag">{paymentLabels[row.paymentMethod] ?? row.paymentMethod}</span></td>
                        <td><span className="admin-badge" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span></td>
                        <td>{ps ? <span style={{ color: ps.color, fontWeight: 600 }}>{ps.label}</span> : (row.paymentStatus ?? '—')}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(row.totalAmount)}</td>
                        <td style={{ textAlign: 'right', color: (row.refundedAmount ?? 0) > 0 ? '#c2410c' : undefined }}>
                          {(row.refundedAmount ?? 0) > 0 ? fmt(row.refundedAmount) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.countedAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardRevenueDetail;
