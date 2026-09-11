// Trang biên lai hoàn trả dành cho khách hàng xem và in phiếu hoàn trả của đơn hàng.
// Truy cập qua /account/orders/:id/return-receipt sau khi khách gửi yêu cầu hoàn trả.
// CSS được nhúng trực tiếp vào trang thay vì dùng file riêng, để khi in không phụ thuộc vào file CSS toàn cục.

import { useEffect, useState } from 'react';

// useParams lấy id đơn hàng từ URL; useSearchParams lấy ?reqCode= để in đúng yêu cầu cụ thể
// khi đơn có nhiều lần hoàn trả từng phần (không truyền thì lấy yêu cầu gần nhất).
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { orderAPI } from '../services/api';

// fmt là hàm định dạng số tiền sang VNĐ, ví dụ 150000 → "150.000 ₫".
import { fmt } from '../utils/formatters';

// fmtDate chuyển chuỗi ISO date thành định dạng ngày giờ tiếng Việt dễ đọc.
// Trả về '—' nếu không có giá trị để tránh hiện "Invalid Date".
const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

// PAY_METHOD và PAY_STATUS dịch các giá trị enum từ backend sang tiếng Việt để hiển thị trên phiếu.
const PAY_METHOD = { cod: 'COD (Thu khi giao)', vnpay: 'VNPay' };
const PAY_STATUS = {
  unpaid:             'Chưa thanh toán',
  paid:               'Đã thanh toán',
  refund_pending:     'Chờ hoàn tiền',
  refunded:           'Đã hoàn tiền',
  partially_refunded: 'Đã hoàn 1 phần',
};

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

// CSS nhúng thẳng vào trang thay vì import từ file .css bên ngoài.
// Lý do: trang này được thiết kế để in ra giấy, nên cần tự đứng độc lập không phụ thuộc stylesheet khác.
// @media print: ẩn thanh nút điều hướng, xoá nền, và cho phép nội dung trải hết trang.
const CSS = `
.rrc-wrap{max-width:800px;margin:0 auto;padding:2rem;font-family:'Segoe UI',sans-serif;font-size:.9rem;color:#1f2937}
.rrc-top-bar{display:flex;gap:.75rem;justify-content:flex-end;margin-bottom:1.5rem}
.rrc-back{display:inline-flex;align-items:center;gap:6px;padding:.4rem 1rem;border-radius:6px;border:1.5px solid #e5e7eb;background:#fff;color:#374151;font-size:.88rem;font-weight:500;text-decoration:none;cursor:pointer}
.rrc-print-btn{padding:.5rem 1.4rem;background:#e85d04;color:#fff;border:none;border-radius:7px;font-weight:600;cursor:pointer;font-size:.9rem}
.rrc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e5e7eb;padding-bottom:1.25rem;margin-bottom:1.25rem}
.rrc-brand h1{font-size:1.6rem;font-weight:800;color:#e85d04;margin:0}
.rrc-brand p{color:#6b7280;font-size:.82rem;margin:.2rem 0 0}
.rrc-meta{text-align:right}
.rrc-meta h2{font-size:1.1rem;font-weight:700;margin:0 0 .35rem;text-transform:uppercase;letter-spacing:.03em}
.rrc-meta p{margin:.15rem 0;font-size:.85rem}
.rrc-parties{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem}
.rrc-party{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:.85rem 1rem}
.rrc-party h4{margin:0 0 .4rem;font-size:.78rem;text-transform:uppercase;color:#6b7280;letter-spacing:.05em}
.rrc-party p{margin:.2rem 0;font-size:.88rem}
.rrc-table{width:100%;border-collapse:collapse;margin-bottom:1rem}
.rrc-table th{background:#f3f4f6;padding:.55rem .65rem;font-size:.82rem;text-align:left;border:1px solid #e5e7eb}
.rrc-table td{padding:.55rem .65rem;border:1px solid #e5e7eb;font-size:.87rem}
.rrc-table tbody tr:nth-child(even){background:#fafafa}
.rrc-totals{width:280px;margin-left:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:1.25rem}
.rrc-total-row{display:flex;justify-content:space-between;padding:.45rem .85rem;font-size:.87rem;border-bottom:1px solid #f0f0f0}
.rrc-total-row:last-child{border-bottom:none}
.rrc-grand{background:#1f2937;color:#fff;font-weight:700;font-size:.95rem}
.rrc-refund{background:#fef2f2;color:#ef4444;font-weight:700}
.rrc-note{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:.65rem .85rem;margin-bottom:1rem;font-size:.86rem}
.rrc-proof-box{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:.85rem 1rem;margin-bottom:1.25rem}
.rrc-proof-box strong{color:#166534}
.rrc-footer{text-align:center;border-top:1px solid #e5e7eb;padding-top:1rem;color:#6b7280;font-size:.83rem}
.rrc-footer p{margin:.2rem 0}
@media print{
  .rrc-top-bar{display:none!important}
  body{background:#fff!important}
  .rrc-wrap{padding:0;max-width:100%}
}
`;

export default function ReturnReceiptClient() {
  // Lấy id đơn hàng từ URL để biết cần tải thông tin đơn nào.
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const reqCodeParam = searchParams.get('reqCode');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  // Gọi API lấy thông tin đơn hàng khi component mount.
  // Kiểm tra trạng thái đơn: chỉ cho xem biên lai nếu đơn đang chờ duyệt hoặc đã hoàn trả xong.
  useEffect(() => {
    orderAPI.getById(id)
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
      })
      .catch(err => setError(err.message || 'Không tải được đơn hàng'));
  }, [id]);

  // Hiện thông báo lỗi nếu đơn không tồn tại hoặc không có yêu cầu hoàn trả.
  if (error) return (
    <div style={{ padding: '2rem', color: '#ef4444' }}>
      {error}<br/>
      <Link to="/account" style={{ color: '#374151', fontSize: '.9rem' }}>← Quay lại tài khoản</Link>
    </div>
  );

  // Hiện trạng thái loading trong khi chờ API trả về dữ liệu đơn hàng.
  if (!order) return <div style={{ padding: '2rem' }}>Đang tải...</div>;

  // Chuẩn bị các dữ liệu cần dùng trong phiếu, xử lý tên field khác nhau giữa các phiên bản API.
  const items      = order.items ?? [];
  const history    = order.statusHistory ?? [];
  const oid        = order.orderId ?? order.id;
  const isReturned     = order.status === 'returned';
  const isCancelRefund = order.status === 'cancelled' &&
    (order.paymentStatus === 'refund_pending' || order.paymentStatus === 'refunded');

  // Đơn có thể có nhiều yêu cầu hoàn trả (hoàn từng phần nhiều lần) — nếu URL có ?reqCode= thì lấy
  // đúng yêu cầu đó, không thì lấy yêu cầu gần nhất (duyệt ngược để ra bản ghi mới nhất).
  const returnReq = reqCodeParam
    ? history.find(h => h.status === 'return_pending' && parseReturnRequest(h.note)?.reqCode === reqCodeParam)
    : [...history].reverse().find(h => h.status === 'return_pending');
  const returnReqData = returnReq ? parseReturnRequest(returnReq.note) : null;

  // Tìm quyết định tương ứng: dữ liệu mới khớp theo reqCode, dữ liệu cũ lấy bản ghi liền sau (logic cũ).
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

  const requestedAt = returnReq?.createdAt;
  const processedAt = returnDoneEntry?.createdAt;

  // Lý do + ảnh minh chứng: ưu tiên dữ liệu JSON (nhiều sản phẩm/nhiều ảnh), fallback dữ liệu cũ.
  const returnReason = returnReqData?.reason ?? returnReq?.note ?? '—';
  const returnImages = returnReqData?.images
    ?? (returnReq?.imageUrl ? returnReq.imageUrl.split(',').filter(Boolean) : []);
  // Sản phẩm hoàn trả: chỉ các sản phẩm/số lượng trong yêu cầu này — fallback cả đơn cho dữ liệu cũ.
  const returnItems = returnReqData?.items ?? null;

  const isApproved = returnReqData ? !!returnDecisionData?.approved : (isReturned || returnDoneEntry?.status === 'returned');
  const isRejected = returnReqData ? (returnDecisionData && !returnDecisionData.approved) : (returnDoneEntry && returnDoneEntry.status !== 'returned');

  // refundAmount: số tiền hoàn THỰC TẾ của yêu cầu này (không phải cả đơn) khi hoàn từng phần.
  // isCancelRefund (hủy đơn VNPay) vẫn hoàn toàn bộ vì là hủy cả đơn, không phải hoàn từng sản phẩm.
  const refundAmount = isCancelRefund
    ? ((order.paymentStatus === 'refunded' || order.paymentStatus === 'refund_pending') ? order.totalAmount : null)
    : returnReqData
      ? returnReqData.refundAmount
      : (order.paymentStatus === 'refunded' ? order.totalAmount : null); // dữ liệu cũ — hoàn cả đơn

  // Khi hoàn từng sản phẩm (returnItems có giá trị), "tạm tính" và "giảm giá" phải tính riêng theo
  // các sản phẩm trong YÊU CẦU này — không dùng order.subtotal/discountAmount vì đó là số liệu của
  // toàn bộ đơn hàng, gây hiểu nhầm là hoàn toàn bộ đơn khi khách chỉ chọn 1 sản phẩm.
  const returnGrossSubtotal = returnItems
    ? returnItems.reduce((sum, it) => sum + (it.unitPrice ?? 0) * (it.qty ?? 0), 0)
    : null;
  const returnDiscount = (returnGrossSubtotal != null && refundAmount != null)
    ? returnGrossSubtotal - refundAmount
    : null;

  // Trạng thái hiển thị trên phiếu — gộp 3 luồng: hủy đơn VNPay, hoàn trả từng phần (JSON), dữ liệu cũ.
  const wasRefunded = returnReqData ? !!returnDecisionData?.refunded
    : (order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded');
  const statusLabel = isCancelRefund
    ? (order.paymentStatus === 'refunded' ? 'Đã hoàn tiền' : 'Chờ hoàn tiền')
    : isRejected ? 'Đã từ chối'
    : isApproved ? (wasRefunded ? (order.paymentStatus === 'partially_refunded' ? 'Đã hoàn 1 phần' : 'Đã hoàn tiền') : 'Đã duyệt (chưa hoàn tiền)')
    : 'Chờ duyệt hoàn trả';
  const statusDone = isCancelRefund ? order.paymentStatus === 'refunded' : isApproved && wasRefunded;

  return (
    <>
      {/* Nhúng CSS trực tiếp vào <style> để phiếu in không bị ảnh hưởng bởi stylesheet toàn cục. */}
      <style>{CSS}</style>
      <div className="rrc-wrap">

        {/* Thanh nút điều hướng — ẩn hoàn toàn khi in để tờ giấy chỉ có nội dung phiếu. */}
        <div className="rrc-top-bar">
          <Link to={`/account/orders/${oid}`} className="rrc-back">← Quay lại đơn hàng</Link>
          <button className="rrc-print-btn" onClick={() => window.print()}>In biên lai</button>
        </div>

        {/* Header phiếu gồm logo thương hiệu bên trái và thông tin tóm tắt đơn bên phải.
            Tiêu đề thay đổi tuỳ trạng thái: chờ duyệt hay đã hoàn tiền xong. */}
        <div className="rrc-header">
          <div className="rrc-brand">
            <h1>BếpGasVN</h1>
            <p>Thiết bị bếp gas chính hãng</p>
          </div>
          <div className="rrc-meta">
            <h2>
              {isCancelRefund ? 'Biên lai hoàn tiền VNPay'
                : isApproved  ? 'Biên lai hoàn tiền'
                              : 'Phiếu yêu cầu hoàn trả'}
            </h2>
            <p>Số đơn: <strong>#{order.orderCode ?? oid}</strong></p>
            <p>Ngày đặt hàng: {fmtDate(order.createdAt)}</p>
            {requestedAt && <p>Ngày yêu cầu hoàn: {fmtDate(requestedAt)}</p>}
            {processedAt && <p>Ngày xử lý: {fmtDate(processedAt)}</p>}
            <p style={{ marginTop: '.4rem' }}>
              Trạng thái:&nbsp;
              <strong style={{ color: statusDone ? '#6b7280' : isRejected ? '#ef4444' : '#f97316' }}>
                {statusLabel}
              </strong>
            </p>
          </div>
        </div>

        {/* Hai ô thông tin: bên trái là thông tin giao hàng của khách, bên phải là phương thức và trạng thái thanh toán. */}
        <div className="rrc-parties">
          <div className="rrc-party">
            <h4>Khách hàng</h4>
            <p><strong>{order.shippingName}</strong></p>
            {order.shippingPhone   && <p>SĐT: {order.shippingPhone}</p>}
            {order.shippingAddress && <p>Địa chỉ: {order.shippingAddress}</p>}
          </div>
          <div className="rrc-party">
            <h4>Thanh toán gốc</h4>
            <p>{PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}</p>
            <p>{PAY_STATUS[order.paymentStatus] ?? order.paymentStatus}</p>
            {refundAmount != null && (
              <p style={{ marginTop: '.35rem' }}>
                Hoàn tiền: <strong style={{ color: '#ef4444' }}>{fmt(refundAmount)}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Bảng liệt kê sản phẩm trong đơn hoàn trả với số lượng, đơn giá và thành tiền. */}
        <table className="rrc-table">
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

        {/* Khối tổng tiền căn phải. Hoàn từng sản phẩm: chỉ tính trên các SP trong yêu cầu này,
            không hiện phí ship/lắp đặt hay tổng giá trị cả đơn vì không thuộc phạm vi hoàn trả. */}
        <div className="rrc-totals">
          {returnItems ? (
            <>
              <div className="rrc-total-row"><span>Tạm tính (SP hoàn trả)</span><span>{fmt(returnGrossSubtotal)}</span></div>
              {returnDiscount > 0 && (
                <div className="rrc-total-row"><span>Giảm giá tương ứng</span><span>−{fmt(returnDiscount)}</span></div>
              )}
            </>
          ) : (
            <>
              <div className="rrc-total-row"><span>Tạm tính</span><span>{fmt(order.subtotal ?? order.totalAmount)}</span></div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="rrc-total-row"><span>Giảm giá</span><span>−{fmt(order.discountAmount)}</span></div>
              )}
              <div className="rrc-total-row">
                <span>Phí vận chuyển</span>
                <span>{(order.shippingFee ?? 0) === 0 ? 'Miễn phí' : fmt(order.shippingFee)}</span>
              </div>
              {(order.installationFee ?? 0) > 0 && (
                <div className="rrc-total-row"><span>Phí lắp đặt</span><span>{fmt(order.installationFee)}</span></div>
              )}
              <div className="rrc-total-row rrc-grand"><span>TỔNG GIÁ TRỊ ĐƠN</span><span>{fmt(order.totalAmount)}</span></div>
            </>
          )}
          {refundAmount != null && (
            <div className="rrc-total-row rrc-refund">
              <span>{statusDone ? 'SỐ TIỀN ĐÃ HOÀN' : 'SỐ TIỀN SẼ HOÀN'}</span>
              <span>{fmt(refundAmount)}</span>
            </div>
          )}
        </div>

        {/* Lý do hoàn trả — đơn hủy VNPay hiện thông báo cố định, flow hoàn trả hiện lý do khách nhập */}
        <div className="rrc-note">
          {isCancelRefund
            ? <><strong>Lý do hoàn tiền:</strong> Bạn đã hủy đơn sau khi thanh toán qua VNPay. Shop sẽ chuyển khoản hoàn tiền thủ công.</>
            : <><strong>Lý do hoàn trả:</strong> {returnReason}</>}
        </div>

        {/* Ảnh minh chứng khách gửi kèm theo yêu cầu hoàn trả, chỉ hiện khi có ảnh. */}
        {returnImages.length > 0 && (
          <div className="rrc-note" style={{ marginTop: '-0.5rem' }}>
            <strong>Ảnh minh chứng (bạn đã gửi):</strong>
            <div style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {returnImages.map((url, i) => (
                <img key={i} src={url} alt={`Minh chứng ${i + 1}`}
                  style={{ maxWidth: 200, maxHeight: 160, objectFit: 'contain',
                    border: '1px solid #e5e7eb', borderRadius: 6 }}/>
              ))}
            </div>
          </div>
        )}

        {/* Ảnh chuyển khoản hoàn tiền từ phía shop, chỉ có sau khi shop đã xử lý xong. */}
        {order.refundReceiptUrl && (
          <div className="rrc-proof-box">
            <strong>Minh chứng chuyển khoản hoàn tiền</strong>
            <p style={{ margin: '.3rem 0 .75rem', fontSize: '.85rem', color: '#4b5563' }}>
              Shop đã chuyển khoản hoàn tiền. Vui lòng kiểm tra tài khoản ngân hàng của bạn.
            </p>
            <img src={order.refundReceiptUrl} alt="Minh chứng chuyển khoản"
              style={{ maxWidth: 280, maxHeight: 200, objectFit: 'contain',
                border: '1px solid #bbf7d0', borderRadius: 6 }}/>
          </div>
        )}

        {/* Footer phiếu in: thông tin liên hệ và thời điểm in để làm bằng chứng. */}
        <div className="rrc-footer">
          <p>BếpGasVN — Chính sách hoàn trả trong vòng 7 ngày kể từ ngày nhận hàng.</p>
          <p>Mọi thắc mắc vui lòng liên hệ hotline: <strong>1900 xxxx</strong></p>
          <p style={{ fontSize: '.78rem', marginTop: '.4rem' }}>In lúc: {new Date().toLocaleString('vi-VN')}</p>
        </div>

      </div>
    </>
  );
}
