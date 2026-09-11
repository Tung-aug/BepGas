// Trang in hóa đơn bán hàng cho admin và staff.
// Tự động gọi window.print() sau 600ms để hộp thoại in bật ngay khi trang load xong.
// Nút in thủ công có class 'no-print' để ẩn đi khi người dùng in thật qua @media print.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { fmt } from '../../utils/formatters';

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const PAY_METHOD = { cod: 'COD (Thu khi giao)', vnpay: 'VNPay' };
const PAY_STATUS = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', refund_pending: 'Chờ hoàn tiền', refunded: 'Đã hoàn tiền' };
const STATUS_LABEL = {
  pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', shipping: 'Đang giao',
  delivered: 'Đã giao', delivery_failed: 'Giao thất bại',
  cancelled: 'Đã hủy', return_pending: 'Chờ duyệt hoàn trả', returned: 'Đã hoàn trả',
};

const InvoicePrint = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminAPI.getOrderDetail(id)
      .then(res => {
        setOrder(res?.data ?? res);
        setTimeout(() => window.print(), 600);
      })
      .catch(err => setError(err.message || 'Không tải được đơn hàng'));
  }, [id]);

  if (error) return <div style={{ padding: '2rem', color: '#ef4444' }}>{error}</div>;
  if (!order) return <div style={{ padding: '2rem' }}>Đang tải...</div>;

  const items = order.items ?? [];
  const oid   = order.orderId ?? order.id;

  return (
    <div className="invoice-wrap">
      <div className="invoice-header">
        <div className="invoice-brand">
          <h1>BếpGasVN</h1>
          <p>Thiết bị bếp gas chính hãng</p>
        </div>
        <div className="invoice-meta">
          <h2>HOÁ ĐƠN BÁN HÀNG</h2>
          <p>Số đơn: <strong>#{oid}</strong></p>
          <p>Ngày đặt: {fmtDate(order.createdAt)}</p>
          <p>Trạng thái: <strong>{STATUS_LABEL[order.status] ?? order.status}</strong></p>
        </div>
      </div>

      <div className="invoice-parties">
        <div className="invoice-party">
          <h4>Người mua</h4>
          <p><strong>{order.shippingName ?? order.customerName}</strong></p>
          {order.shippingPhone && <p>SĐT: {order.shippingPhone}</p>}
          {order.shippingAddress && <p>Địa chỉ: {order.shippingAddress}</p>}
        </div>
        <div className="invoice-party">
          <h4>Thanh toán</h4>
          <p>{PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}</p>
          <p className={order.paymentStatus === 'paid' ? 'invoice-paid' : 'invoice-unpaid'}>
            {PAY_STATUS[order.paymentStatus] ?? order.paymentStatus}
          </p>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>STT</th>
            <th>Sản phẩm</th>
            <th style={{ width: '10%', textAlign: 'right' }}>SL</th>
            <th style={{ width: '18%', textAlign: 'right' }}>Đơn giá</th>
            <th style={{ width: '18%', textAlign: 'right' }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.orderItemId ?? i}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>
                {it.productName}
                {it.variantName && <div className="invoice-variant">{it.variantName}</div>}
              </td>
              <td style={{ textAlign: 'right' }}>{it.quantity}</td>
              <td style={{ textAlign: 'right' }}>{fmt(it.unitPrice ?? it.price)}</td>
              <td style={{ textAlign: 'right' }}>{fmt((it.unitPrice ?? it.price) * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div className="invoice-total-row"><span>Tổng tiền hàng</span><span>{fmt(order.subtotal)}</span></div>
        {(order.discountAmount ?? 0) > 0 && (
          <>
            <div className="invoice-total-row" style={{ color: '#10b981' }}>
              <span>Voucher{order.couponCode ? ` (${order.couponCode})` : ''}</span>
              <span>−{fmt(order.discountAmount)}</span>
            </div>
            <div className="invoice-total-row" style={{ fontSize: '0.82em', color: '#6b7280' }}>
              <span>Tiền hàng sau giảm</span>
              <span>{fmt((order.subtotal ?? 0) - (order.discountAmount ?? 0))}</span>
            </div>
          </>
        )}
        <div className="invoice-total-row"><span>Phí vận chuyển</span><span>{(order.shippingFee ?? 0) === 0 ? 'Miễn phí' : fmt(order.shippingFee)}</span></div>
        {(order.installationFee ?? 0) > 0 && (
          <div className="invoice-total-row"><span>Phí lắp đặt</span><span>{fmt(order.installationFee)}</span></div>
        )}
        <div className="invoice-total-row invoice-grand-total"><span>TỔNG CỘNG</span><span>{fmt(order.totalAmount)}</span></div>
      </div>

      {order.note && (
        <div className="invoice-note">
          <strong>Ghi chú:</strong> {order.note}
        </div>
      )}

      <div className="invoice-footer">
        <p>Cảm ơn quý khách đã mua hàng tại BếpGasVN!</p>
        <p>Mọi thắc mắc vui lòng liên hệ hotline: <strong>1800 1234</strong></p>
        <p className="invoice-print-date">In lúc: {new Date().toLocaleString('vi-VN')}</p>
      </div>

      <button className="invoice-print-btn no-print" onClick={() => window.print()}>In hoá đơn</button>
    </div>
  );
};

export default InvoicePrint;