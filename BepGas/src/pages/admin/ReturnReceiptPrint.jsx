// Trang in biên lai hoàn trả dành cho Admin và Staff.
// Chỉ hiển thị được với đơn hàng có trạng thái return_pending hoặc returned.
// Tương tự InvoicePrint — tự động gọi window.print() sau khi load xong.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { fmt } from '../../utils/formatters';

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const PAY_METHOD  = { cod: 'COD (Thu khi giao)', vnpay: 'VNPay' };
const PAY_STATUS  = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', refund_pending: 'Chờ hoàn tiền', refunded: 'Đã hoàn tiền', partially_refunded: 'Đã hoàn 1 phần' };

// parseReturnRequest/parseReturnDecision đọc JSON lưu trong statusHistory.note (hoàn trả từng sản phẩm).
// Trả null nếu không phải JSON đúng định dạng — dữ liệu cũ trước khi có tính năng này dùng fallback.
const parseReturnRequest = (note) => {
  if (!note) return null;
  try { const d = JSON.parse(note); return d?.type === 'return_request' ? d : null; }
  catch { return null; }
};
const parseReturnDecision = (note) => {
  if (!note) return null;
  try { const d = JSON.parse(note); return d?.type === 'return_decision' ? d : null; }
  catch { return null; }
};

const ReturnReceiptPrint = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const reqCodeParam = searchParams.get('reqCode');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminAPI.getOrderDetail(id)
      .then(res => {
        const o = res?.data ?? res;
        // Đơn có thể đã quay về 'delivered' sau khi 1 yêu cầu được xử lý (còn sản phẩm khác chưa hoàn) —
        // vẫn cho xem biên lai nếu lịch sử có ít nhất 1 yêu cầu hoàn trả, không chỉ dựa vào status hiện tại.
        const hasReturnHistory = (o.statusHistory ?? []).some(h => h.status === 'return_pending');
        const isReturnFlow   = o.status === 'return_pending' || o.status === 'returned' || hasReturnHistory;
        const isCancelRefund = o.status === 'cancelled' &&
          (o.paymentStatus === 'refund_pending' || o.paymentStatus === 'refunded');
        if (!isReturnFlow && !isCancelRefund) {
          setError('Đơn hàng này không có yêu cầu hoàn tiền.');
          return;
        }
        setOrder(o);
        setTimeout(() => window.print(), 600);
      })
      .catch(err => setError(err.message || 'Không tải được đơn hàng'));
  }, [id]);

  if (error) return <div style={{ padding: '2rem', color: '#ef4444' }}>{error}</div>;
  if (!order) return <div style={{ padding: '2rem' }}>Đang tải...</div>;

  const items     = order.items ?? [];
  const history   = order.statusHistory ?? [];
  const oid       = order.orderId ?? order.id;
  const isReturned     = order.status === 'returned';
  const isCancelRefund = order.status === 'cancelled' &&
    (order.paymentStatus === 'refund_pending' || order.paymentStatus === 'refunded');

  // Đơn có thể có nhiều yêu cầu hoàn trả (hoàn từng phần nhiều lần) — nếu URL có ?reqCode= thì lấy
  // đúng yêu cầu đó, không thì lấy yêu cầu gần nhất.
  const returnReq = reqCodeParam
    ? history.find(h => h.status === 'return_pending' && parseReturnRequest(h.note)?.reqCode === reqCodeParam)
    : [...history].reverse().find(h => h.status === 'return_pending');
  const returnReqData = returnReq ? parseReturnRequest(returnReq.note) : null;

  // Quyết định tương ứng: dữ liệu mới khớp theo reqCode, dữ liệu cũ lấy bản ghi liền sau (logic cũ).
  let returnDecisionData = null;
  let returnDoneEntry    = null;
  if (returnReqData) {
    for (const h of history) {
      const d = parseReturnDecision(h.note);
      if (d && d.reqCode === returnReqData.reqCode) { returnDecisionData = d; returnDoneEntry = h; break; }
    }
  } else if (returnReq) {
    const idx = history.indexOf(returnReq);
    returnDoneEntry = idx !== -1 ? (history[idx + 1] ?? null) : null;
  }

  const returnReason = returnReqData?.reason ?? returnReq?.note ?? '—';
  const returnImages = returnReqData?.images
    ?? (returnReq?.imageUrl ? returnReq.imageUrl.split(',').filter(Boolean) : []);
  const returnItems  = returnReqData?.items ?? null;
  const requestedAt  = returnReq?.createdAt;
  const processedAt  = returnDoneEntry?.createdAt;
  const processedBy  = returnDoneEntry?.changedBy ?? null;

  const isApproved = returnReqData ? !!returnDecisionData?.approved : (isReturned || returnDoneEntry?.status === 'returned');
  const isRejected = returnReqData ? (returnDecisionData && !returnDecisionData.approved) : (returnDoneEntry && returnDoneEntry.status !== 'returned');
  const wasRefunded = returnReqData ? !!returnDecisionData?.refunded
    : (order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded');
  const statusDone = isCancelRefund ? order.paymentStatus === 'refunded' : isApproved && wasRefunded;
  const statusLabel = isCancelRefund
    ? (order.paymentStatus === 'refunded' ? 'Đã hoàn tiền' : 'Chờ hoàn tiền')
    : isRejected ? 'Đã từ chối'
    : isApproved ? (wasRefunded ? (order.paymentStatus === 'partially_refunded' ? 'Đã hoàn 1 phần' : 'Đã hoàn tiền') : 'Đã duyệt (chưa hoàn tiền)')
    : 'Chờ hoàn tiền';

  // Số tiền hoàn: ưu tiên số tiền thực tế của yêu cầu (JSON) — hủy đơn VNPay vẫn hoàn toàn bộ.
  const refundAmount = isCancelRefund
    ? ((order.paymentStatus === 'refunded' || order.paymentStatus === 'refund_pending') ? order.totalAmount : null)
    : returnReqData
      ? returnReqData.refundAmount
      : (order.paymentStatus === 'refunded' ? order.totalAmount : null);

  // Khi hoàn từng sản phẩm (returnItems có giá trị), "tổng tiền hàng" và "voucher" phải tính riêng
  // theo các sản phẩm trong YÊU CẦU này — không dùng order.subtotal/discountAmount vì đó là số liệu
  // của toàn bộ đơn hàng, gây hiểu nhầm là hoàn toàn bộ đơn khi khách chỉ chọn 1 sản phẩm.
  const returnGrossSubtotal = returnItems
    ? returnItems.reduce((sum, it) => sum + (it.unitPrice ?? 0) * (it.qty ?? 0), 0)
    : null;
  const returnDiscount = (returnGrossSubtotal != null && refundAmount != null)
    ? returnGrossSubtotal - refundAmount
    : null;

  return (
    <div className="invoice-wrap">
      {/* Header */}
      <div className="invoice-header">
        <div className="invoice-brand">
          <h1>BếpGasVN</h1>
          <p>Thiết bị bếp gas chính hãng</p>
        </div>
        <div className="invoice-meta">
          <h2>BIÊN LAI HOÀN TIỀN</h2>
          <p>Số đơn: <strong>#{order.orderCode ?? oid}</strong></p>
          <p>Ngày đặt hàng: {fmtDate(order.createdAt)}</p>
          {requestedAt && <p>Ngày yêu cầu hoàn: {fmtDate(requestedAt)}</p>}
          {processedAt && (
            <p>Ngày xử lý: {fmtDate(processedAt)}</p>
          )}
          <p style={{ marginTop: '0.4rem' }}>
            Trạng thái:&nbsp;
            <strong style={{ color: statusDone ? '#6b7280' : isRejected ? '#ef4444' : '#f97316' }}>
              {statusLabel}
            </strong>
          </p>
        </div>
      </div>

      {/* Thông tin khách */}
      <div className="invoice-parties">
        <div className="invoice-party">
          <h4>Khách hàng</h4>
          <p><strong>{order.shippingName}</strong></p>
          {order.shippingPhone   && <p>SĐT: {order.shippingPhone}</p>}
          {order.shippingAddress && <p>Địa chỉ: {order.shippingAddress}</p>}
        </div>
        <div className="invoice-party">
          <h4>Thanh toán gốc</h4>
          <p>{PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}</p>
          <p>{PAY_STATUS[order.paymentStatus] ?? order.paymentStatus}</p>
          {refundAmount != null && (
            <p style={{ marginTop: '0.35rem' }}>
              Hoàn tiền: <strong style={{ color: '#ef4444' }}>{fmt(refundAmount)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Sản phẩm hoàn trả */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>STT</th>
            <th>Sản phẩm hoàn trả</th>
            <th style={{ width: '10%', textAlign: 'right' }}>SL</th>
            <th style={{ width: '18%', textAlign: 'right' }}>Đơn giá</th>
            <th style={{ width: '18%', textAlign: 'right' }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {returnItems ? returnItems.map((it, i) => (
            <tr key={it.orderItemId ?? i}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{it.name}</td>
              <td style={{ textAlign: 'right' }}>{it.qty}</td>
              <td style={{ textAlign: 'right' }}>{fmt(it.unitPrice)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(it.lineRefund)}</td>
            </tr>
          )) : items.map((it, i) => (
            <tr key={it.orderItemId ?? i}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{it.productName}</td>
              <td style={{ textAlign: 'right' }}>{it.quantity}</td>
              <td style={{ textAlign: 'right' }}>{fmt(it.unitPrice ?? it.price)}</td>
              <td style={{ textAlign: 'right' }}>{fmt((it.unitPrice ?? it.price) * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        {returnItems ? (
          <>
            <div className="invoice-total-row"><span>Tổng tiền hàng (SP hoàn trả)</span><span>{fmt(returnGrossSubtotal)}</span></div>
            {returnDiscount > 0 && (
              <div className="invoice-total-row" style={{ color: '#10b981' }}>
                <span>Voucher tương ứng{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                <span>−{fmt(returnDiscount)}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="invoice-total-row"><span>Tổng tiền hàng</span><span>{fmt(order.subtotal)}</span></div>
            {(order.discountAmount ?? 0) > 0 && (
              <>
                <div className="invoice-total-row" style={{ color: '#10b981' }}>
                  <span>Voucher{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                  <span>−{fmt(order.discountAmount)}</span>
                </div>
                <div className="invoice-total-row" style={{ fontSize: '0.82em', color: '#6b7280' }}>
                  <span>↳ Tiền hàng sau giảm</span>
                  <span>{fmt((order.subtotal ?? 0) - (order.discountAmount ?? 0))}</span>
                </div>
              </>
            )}
            <div className="invoice-total-row"><span>Phí vận chuyển</span><span>{(order.shippingFee ?? 0) === 0 ? 'Miễn phí' : fmt(order.shippingFee)}</span></div>
            {(order.installationFee ?? 0) > 0 && (
              <div className="invoice-total-row"><span>Phí lắp đặt</span><span>{fmt(order.installationFee)}</span></div>
            )}
            <div className="invoice-total-row invoice-grand-total"><span>TỔNG GIÁ TRỊ ĐƠN</span><span>{fmt(order.totalAmount)}</span></div>
          </>
        )}
        {refundAmount != null && (
          <div className="invoice-total-row" style={{ color: '#ef4444', fontWeight: 700 }}>
            <span>SỐ TIỀN HOÀN TRẢ</span><span>{fmt(refundAmount)}</span>
          </div>
        )}
      </div>

      {/* Lý do hoàn trả — chỉ hiện với flow hoàn trả, không áp dụng cho đơn hủy VNPay */}
      {!isCancelRefund && (
        <div className="invoice-note" style={{ marginTop: '1.25rem' }}>
          <strong>Lý do hoàn trả:</strong> {returnReason}
        </div>
      )}
      {isCancelRefund && (
        <div className="invoice-note" style={{ marginTop: '1.25rem' }}>
          <strong>Lý do hoàn tiền:</strong> Khách hàng đã hủy đơn sau khi thanh toán qua VNPay
        </div>
      )}

      {/* Ảnh minh chứng khách gửi */}
      {returnImages.length > 0 && (
        <div className="invoice-note" style={{ marginTop: '0.75rem' }}>
          <strong>Ảnh minh chứng (khách gửi):</strong>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {returnImages.map((url, i) => (
              <img key={i} src={url} alt={`Minh chứng ${i + 1}`}
                style={{ maxWidth: '200px', maxHeight: '160px', objectFit: 'contain',
                         border: '1px solid #e5e7eb', borderRadius: 6 }}/>
            ))}
          </div>
        </div>
      )}

      {/* Minh chứng chuyển khoản hoàn tiền */}
      {order.refundReceiptUrl && (
        <div className="invoice-note" style={{ marginTop: '0.75rem' }}>
          <strong>Minh chứng chuyển khoản hoàn tiền:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            <img src={order.refundReceiptUrl} alt="Minh chứng chuyển khoản"
              style={{ maxWidth: '280px', maxHeight: '200px', objectFit: 'contain',
                       border: '1px solid #e5e7eb', borderRadius: 6 }}/>
          </div>
        </div>
      )}

      {/* Xử lý bởi */}
      {(isApproved || isRejected) && processedBy && (
        <div className="invoice-note" style={{ marginTop: '0.75rem' }}>
          <strong>Xử lý bởi:</strong> {processedBy.includes('@') ? 'Admin' : processedBy}
        </div>
      )}

      <div className="invoice-footer">
        <p>BếpGasVN — Chính sách hoàn trả trong vòng 7 ngày kể từ ngày nhận hàng.</p>
        <p>Mọi thắc mắc vui lòng liên hệ hotline: <strong>1800 1234</strong></p>
        <p className="invoice-print-date">In lúc: {new Date().toLocaleString('vi-VN')}</p>
      </div>

      <button className="invoice-print-btn no-print" onClick={() => window.print()}>
        In biên lai hoàn tiền
      </button>
    </div>
  );
};

export default ReturnReceiptPrint;
