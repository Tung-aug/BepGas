// Trang chi tiết đơn hàng dành cho khách hàng xem đơn của mình.
// Hiển thị timeline tiến trình, lịch sử trạng thái, danh sách sản phẩm,
// địa chỉ giao hàng, chi tiết thanh toán và thông tin bảo hành.
// Hành động: hủy đơn, yêu cầu hoàn trả (trong 7 ngày sau giao), thanh toán lại VNPay, mua lại.
// Route: /account/orders/:id — yêu cầu đăng nhập.

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, Phone, Truck,
  CreditCard, RotateCcw, XCircle, CheckCircle, Clock,
  Star, Loader, AlertCircle, ShieldCheck, Upload,
  ChevronDown, ChevronUp, Printer,
} from 'lucide-react';
import { useAuth }    from '../context/AuthContext';
import { useCart }    from '../context/CartContext';
import { orderAPI, paymentAPI, cartAPI, uploadAPI, reviewAPI } from '../services/api';
import { fmt }        from '../utils/formatters';

// getWarrantyInfo tính trạng thái và thời gian còn lại của bảo hành từng sản phẩm.
import { getWarrantyInfo } from '../utils/warranty';

// fmtDate định dạng ngày giờ sang tiếng Việt chuẩn dd/mm/yyyy hh:mm.
const fmtDate = (s) => s
  ? new Date(s).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  : '';

// STATUS_CFG ánh xạ trạng thái đơn hàng sang màu sắc, nền và icon để hiển thị badge nhất quán.
const STATUS_CFG = {
  pending:         { label: 'Chờ xử lý',          color: '#f59e0b', bg: '#fef3c7', icon: <Clock size={14}/> },
  confirmed:       { label: 'Đã xác nhận',         color: '#3b82f6', bg: '#dbeafe', icon: <CheckCircle size={14}/> },
  shipping:        { label: 'Đang giao hàng',      color: '#8b5cf6', bg: '#ede9fe', icon: <Truck size={14}/> },
  delivered:       { label: 'Đã giao',             color: '#10b981', bg: '#d1fae5', icon: <CheckCircle size={14}/> },
  delivery_failed: { label: 'Giao thất bại',       color: '#be185d', bg: '#fce7f3', icon: <AlertCircle size={14}/> },
  cancelled:       { label: 'Đã hủy',              color: '#ef4444', bg: '#fee2e2', icon: <XCircle size={14}/> },
  return_pending:  { label: 'Chờ duyệt hoàn trả', color: '#f97316', bg: '#fff7ed', icon: <RotateCcw size={14}/> },
  returned:        { label: 'Đã hoàn trả',         color: '#6b7280', bg: '#f3f4f6', icon: <RotateCcw size={14}/> },
};

// PAY_STATUS và PAY_METHOD dịch các giá trị enum thanh toán sang tiếng Việt.
const PAY_STATUS = {
  unpaid:             { label: 'Chưa thanh toán',  color: '#f59e0b' },
  paid:               { label: 'Đã thanh toán',    color: '#10b981' },
  refund_pending:     { label: 'Chờ hoàn tiền',    color: '#f97316' },
  refunded:           { label: 'Đã hoàn tiền',     color: '#6b7280' },
  partially_refunded: { label: 'Đã hoàn 1 phần',  color: '#f59e0b' },
};
const PAY_METHOD = { cod: 'Thanh toán khi nhận hàng (COD)', vnpay: 'VNPay' };

// ORDER_STEPS định nghĩa 4 bước trong timeline tiến trình đơn hàng.
// Chỉ dùng cho 4 trạng thái chính, các trạng thái đặc biệt (cancelled, returned...) không hiện timeline.
const ORDER_STEPS = [
  { key: 'pending',   label: 'Đặt hàng'  },
  { key: 'confirmed', label: 'Xác nhận'  },
  { key: 'shipping',  label: 'Đang giao' },
  { key: 'delivered', label: 'Đã nhận'   },
];

// Danh sách gợi ý lý do hoàn trả để người dùng chọn nhanh thay vì phải tự gõ.
const RETURN_SUGGESTIONS = [
  'Sản phẩm bị lỗi hoặc hư hỏng',
  'Giao sai sản phẩm',
  'Thiếu phụ kiện',
  'Sản phẩm không đúng mô tả',
  'Muốn đổi/trả vì lý do cá nhân',
];
const RETURN_MAX_IMAGES    = 3;
const RETURN_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB mỗi ảnh

// parseReturnRequest/parseReturnDecision đọc JSON lưu trong statusHistory.note (hoàn trả từng sản phẩm).
// Trả null nếu note không phải JSON đúng định dạng — tức dữ liệu cũ (trước khi có tính năng này),
// để FE tự fallback hiển thị kiểu cũ (1 lý do + 1 chuỗi ảnh) cho các bản ghi lịch sử trước đó.
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

// formatHistoryNote dịch note JSON (hoàn trả từng sản phẩm) sang câu tóm tắt dễ đọc cho timeline
// chung — tránh hiện thẳng chuỗi JSON thô. Note dạng text thường (lý do hủy, giao thất bại...) giữ nguyên.
const formatHistoryNote = (h) => {
  const reqData = parseReturnRequest(h.note);
  if (reqData) {
    const itemsSummary = (reqData.items ?? []).map(it => `${it.name} x${it.qty}`).join(', ');
    return `Yêu cầu hoàn trả: ${itemsSummary}${reqData.reason ? ` — Lý do: ${reqData.reason}` : ''}`;
  }
  const decisionData = parseReturnDecision(h.note);
  if (decisionData) {
    return decisionData.approved
      ? `Đã chấp nhận hoàn trả${decisionData.refunded ? ' — đã hoàn tiền' : ''}`
      : `Đã từ chối hoàn trả${decisionData.rejectReason ? `: ${decisionData.rejectReason}` : ''}`;
  }
  return h.note;
};

// fmtHistoryDate định dạng ngày trong lịch sử trạng thái theo kiểu dd/mm/yyyy · hh:mm.
const fmtHistoryDate = (s) => {
  if (!s) return '';
  const d    = new Date(s);
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${dd}/${mm}/${d.getFullYear()} · ${time}`;
};

// calcReturnDaysLeft tính số ngày còn lại trong thời hạn hoàn trả 7 ngày kể từ ngày giao.
// Dùng deliveredAt (không phải updatedAt) để khớp với cách backend tính deadline —
// updatedAt bị reset mỗi khi admin sửa đơn sau khi giao, gây lệch hạn hoàn trả giữa FE/BE.
const calcReturnDaysLeft = (deliveredAt) => {
  if (!deliveredAt) return 0;
  return Math.max(0, 7 - Math.floor((Date.now() - new Date(deliveredAt)) / 86_400_000));
};

// OrderTimeline hiển thị 4 bước tiến trình đơn hàng với dấu chấm và đường kết nối.
// Bước hiện tại được đánh dấu to hơn, bước đã qua có màu đầy đủ, bước chưa tới có màu mờ.
// Component trả về null nếu trạng thái đơn không thuộc 4 bước chính (ví dụ cancelled).
const OrderTimeline = ({ status }) => {
  if (!['pending','confirmed','shipping','delivered'].includes(status)) return null;
  const curIdx = ORDER_STEPS.findIndex(s => s.key === status);
  return (
    <div className="od-timeline">
      {ORDER_STEPS.map((step, i) => (
        <div key={step.key} className="od-tl-item">
          {i > 0 && <div className={`od-tl-line${i <= curIdx ? ' od-tl-fill' : ''}`}/>}
          <div className={`od-tl-dot${i <= curIdx ? ' od-tl-done' : ''}${i === curIdx ? ' od-tl-active' : ''}`}>
            {i < curIdx && <CheckCircle size={12}/>}
          </div>
          <span className={`od-tl-label${i <= curIdx ? ' od-tl-label-done' : ''}${i === curIdx ? ' od-tl-label-active' : ''}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const OrderDetail = () => {
  const { id }         = useParams(); // id đơn hàng từ URL
  const navigate       = useNavigate();
  const { isLoggedIn } = useAuth();
  const { fetchCart }  = useCart();

  // Các state chính của trang.
  const [order,            setOrder]            = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');

  // confirm lưu thông tin modal đang hiện: null khi đóng, object khi mở.
  // type có thể là 'cancel' (hủy đơn) hoặc 'return' (yêu cầu hoàn trả).
  const [confirm,          setConfirm]          = useState(null);

  // Các cờ loading cho từng hành động để disable nút và hiện spinner trong khi chờ API.
  const [canceling,        setCanceling]        = useState(false);
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [uploadingProof,   setUploadingProof]   = useState(false);
  const [proofDragOver,    setProofDragOver]    = useState(false);
  const proofImgRef = useRef(null); // ref input file ẩn cho drag-drop ảnh minh chứng
  const [retryingPayment,  setRetryingPayment]  = useState(false);
  const [buyingAgain,      setBuyingAgain]      = useState(false);

  // reviewedIds là Set chứa productId của các sản phẩm người dùng đã đánh giá,
  // dùng để hiện "Xem đánh giá" thay vì "Đánh giá" nếu đã đánh giá rồi.
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [actionMsg,   setActionMsg]   = useState(''); // thông báo kết quả hành động hiện tạm 4 giây
  const [showHistory, setShowHistory] = useState(false); // toggle hiện/ẩn lịch sử trạng thái

  // Tải thông tin đơn hàng khi vào trang, redirect về login nếu chưa đăng nhập.
  useEffect(() => {
    if (!isLoggedIn) { navigate('/login'); return; }
    orderAPI.getById(id)
      .then(res => setOrder(res?.data ?? res))
      .catch(err => setError(err.message || 'Không tải được đơn hàng'))
      .finally(() => setLoading(false));
  }, [id, isLoggedIn, navigate]);

  // Tải danh sách productId đã được đánh giá khi đơn hàng ở trạng thái delivered.
  // Chỉ fetch khi cần (status đã delivered) để không gọi API thừa.
  useEffect(() => {
    if (!order || order.status !== 'delivered') return;
    reviewAPI.getMyReviewedProductIds()
      .then(res => setReviewedIds(new Set(res?.data ?? res ?? [])))
      .catch(() => {});
  }, [order?.status]);

  // notify hiện thông báo ngắn gọn ở đầu trang trong 4 giây rồi tự ẩn.
  const notify = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 4000); };

  // handleCancelOrder mở modal xác nhận hủy đơn với select lý do.
  const handleCancelOrder = () =>
    setConfirm({ type: 'cancel', reason: '', customReason: '' });

  // doCancelOrder gọi API hủy đơn rồi cập nhật trạng thái local thay vì reload trang.
  const doCancelOrder = async (reason) => {
    setCanceling(true);
    try {
      await orderAPI.cancel(order.orderId ?? order.id, reason || undefined);
      setOrder(prev => ({ ...prev, status: 'cancelled', statusReason: reason }));
      notify('Đã hủy đơn hàng thành công.');
    } catch (err) {
      notify('Lỗi: ' + (err.message || 'Không thể hủy đơn'));
    } finally { setCanceling(false); }
  };

  // handleRequestReturn mở modal chọn sản phẩm + số lượng, nhập lý do và upload ảnh minh chứng.
  const handleRequestReturn = () =>
    setConfirm({ type: 'return', items: order.items ?? [], selected: {}, reason: '', returnImgs: [], returnReasonTouched: false });

  // handleUploadProof nhận file từ input hoặc drag-drop, upload lên server và lưu URL vào confirm state.
  // Giới hạn tối đa 3 ảnh, mỗi ảnh ≤ 5MB, chỉ chấp nhận định dạng ảnh.
  const handleUploadProof = async (files) => {
    const candidates = Array.from(files ?? []).filter(Boolean);
    if (!candidates.length) return;

    const currentCount = confirm?.returnImgs?.length ?? 0;
    const remaining    = RETURN_MAX_IMAGES - currentCount;
    if (remaining <= 0) return notify(`Chỉ được tải tối đa ${RETURN_MAX_IMAGES} ảnh.`);

    const validFiles = [];
    for (const file of candidates.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) { notify('Vui lòng chọn đúng định dạng ảnh.'); continue; }
      if (file.size > RETURN_MAX_IMAGE_SIZE) { notify('Mỗi ảnh minh chứng không được vượt quá 5MB.'); continue; }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    setUploadingProof(true);
    try {
      const urls = [];
      for (const file of validFiles) {
        const res = await uploadAPI.uploadImage(file);
        const url = res?.data ?? res;
        if (typeof url !== 'string') throw new Error('Không lấy được URL ảnh');
        urls.push(url);
      }
      setConfirm(prev => ({
        ...prev,
        returnImgs: [...(prev.returnImgs ?? []), ...urls].slice(0, RETURN_MAX_IMAGES),
      }));
    } catch (err) {
      notify('Lỗi upload ảnh: ' + (err.message || 'Thử lại sau'));
    } finally { setUploadingProof(false); }
  };

  // doRequestReturn gọi API gửi yêu cầu hoàn trả với sản phẩm đã chọn, lý do và ảnh minh chứng.
  const doRequestReturn = async (reason, images, items) => {
    setRequestingReturn(true);
    try {
      const res = await orderAPI.requestReturn(order.orderId ?? order.id, { reason, images, items });
      const updated = res?.data ?? res;
      setOrder(prev => ({ ...prev, ...updated }));
      notify('Đã gửi yêu cầu hoàn trả. Chúng tôi sẽ phản hồi trong 1–2 ngày làm việc.');
    } catch (err) {
      notify('Lỗi: ' + (err.message || 'Không thể gửi yêu cầu'));
    } finally { setRequestingReturn(false); }
  };

  // handleRetryPayment tạo URL thanh toán VNPay mới cho đơn chưa thanh toán rồi redirect.
  const handleRetryPayment = async () => {
    setRetryingPayment(true);
    try {
      const res = await paymentAPI.createVNPay(order.orderId ?? order.id);
      const url = typeof res === 'string' ? res : (res?.data ?? res?.url ?? null);
      if (!url) throw new Error('Không lấy được URL thanh toán.');
      window.location.href = url;
    } catch (err) {
      notify('Lỗi: ' + (err.message || 'Không thể thanh toán'));
      setRetryingPayment(false);
    }
  };

  // handleBuyAgain thêm lại tất cả sản phẩm trong đơn vào giỏ hàng hiện tại.
  // Dùng for...of để add tuần tự, bỏ qua sản phẩm lỗi (có thể đã hết hàng).
  const handleBuyAgain = async () => {
    const orderItems = order?.items ?? [];
    if (!orderItems.length) return;
    setBuyingAgain(true);
    let added = 0;
    for (const item of orderItems) {
      if (!item.productId) continue;
      try { await cartAPI.add(item.productId, item.quantity ?? 1); added++; }
      catch { /* bỏ qua sản phẩm không thêm được */ }
    }
    await fetchCart().catch(() => {});
    setBuyingAgain(false);
    notify(added > 0 ? `Đã thêm ${added} sản phẩm vào giỏ hàng.` : 'Không thể thêm sản phẩm (có thể đã hết hàng).');
  };

  // Hiện trạng thái loading và lỗi trước khi render nội dung chính.
  if (loading) return (
    <main className="container od-loading">
      <Loader size={32} className="spin"/><p>Đang tải đơn hàng...</p>
    </main>
  );
  if (error || !order) return (
    <main className="container od-error">
      <AlertCircle size={40} color="#ef4444"/>
      <p>{error || 'Không tìm thấy đơn hàng.'}</p>
      <Link to="/account" state={{ tab: 'orders' }} className="btn btn-outline">
        <ArrowLeft size={15}/> Quay lại đơn hàng
      </Link>
    </main>
  );

  // Tính sẵn các giá trị dùng nhiều lần trong render.
  const oid          = order.orderId ?? order.id;
  const st           = STATUS_CFG[order.status] ?? { label: order.status, color:'#6b7280', bg:'#f3f4f6', icon: null };
  const pst          = PAY_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, color:'#6b7280' };
  const items        = order.items ?? [];
  const isCancelable = order.status === 'pending' || order.status === 'confirmed';

  // isRetryable: chỉ cho thanh toán lại khi đơn chưa bị hủy, dùng VNPay và chưa thanh toán.
  const isRetryable = isCancelable && order.paymentMethod === 'vnpay' && order.paymentStatus === 'unpaid';
  const returnLeft  = calcReturnDaysLeft(order.deliveredAt);
  const canReturn   = order.status === 'delivered' && returnLeft > 0;

  // Dựng danh sách yêu cầu hoàn trả từ lịch sử trạng thái: mỗi dòng return_pending là 1 yêu cầu,
  // ghép với dòng quyết định (returned=duyệt / delivered=từ chối) có cùng reqCode nếu đã xử lý.
  // Dữ liệu cũ (trước khi có hoàn trả từng sản phẩm) không parse được JSON → fallback hiển thị kiểu cũ.
  const history = order.statusHistory ?? [];
  const decisionsByCode = {};
  history.forEach(h => {
    const d = parseReturnDecision(h.note);
    if (d) decisionsByCode[d.reqCode] = { decision: d, createdAt: h.createdAt };
  });
  const returnRequests = history.reduce((acc, h, idx) => {
    if (h.status !== 'return_pending') return acc;
    const data = parseReturnRequest(h.note);
    if (data) {
      acc.push({ kind: 'json', createdAt: h.createdAt, data, resolved: decisionsByCode[data.reqCode] ?? null });
    } else {
      // Dữ liệu cũ: bản ghi quyết định là dòng liền sau trong lịch sử (theo logic cũ)
      acc.push({ kind: 'legacy', createdAt: h.createdAt, note: h.note, imageUrl: h.imageUrl,
        legacyResolved: history[idx + 1] ?? null });
    }
    return acc;
  }, []).reverse(); // mới nhất lên đầu

  return (
    <main className="container od-page">

      {/* Breadcrumb điều hướng: Trang chủ / Đơn hàng / Mã đơn cụ thể. */}
      <nav className="od-breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/account" state={{ tab: 'orders' }}>Đơn hàng của tôi</Link>
        <span>/</span>
        <span>#{order.orderCode ?? oid}</span>
      </nav>

      {/* Thông báo kết quả hành động (hủy đơn, mua lại...) hiện tạm 4 giây rồi tự ẩn. */}
      {actionMsg && (
        <div className="od-action-msg"><CheckCircle size={16}/> {actionMsg}</div>
      )}

      {/* Header gọn: nút quay lại, mã đơn, ngày đặt và badge trạng thái + thanh toán. */}
      <div className="od-header">
        <div className="od-header-left">
          <button className="od-back-btn" onClick={() => navigate('/account', { state: { tab: 'orders' } })}>
            <ArrowLeft size={18}/>
          </button>
          <div>
            <h1 className="od-title">Đơn hàng #{order.orderCode ?? oid}</h1>
            <p className="od-date">Đặt lúc {fmtDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="od-header-badges">
          <span className="od-status-badge" style={{ color: st.color, background: st.bg }}>
            {st.icon} {st.label}
          </span>
          <span className="od-pay-badge" style={{ color: pst.color }}>{pst.label}</span>
        </div>
      </div>

      {/* Banner trạng thái đặc biệt hiện cho delivered, cancelled và returned. */}
      {order.status === 'delivered' && (
        <div className="od-status-banner od-status-banner-delivered">
          <CheckCircle size={20} style={{ flexShrink: 0 }}/>
          <span>Đơn hàng đã giao thành công{order.deliveredAt ? ` ngày ${fmtDate(order.deliveredAt)}` : ''}</span>
        </div>
      )}
      {order.status === 'cancelled' && order.paymentStatus === 'refunded' ? (
        // Đã hoàn tiền xong — kết quả tích cực, dùng banner xanh thành công thay vì đỏ "đã hủy"
        <div className="od-status-banner od-status-banner-refunded">
          <CheckCircle size={20} style={{ flexShrink: 0 }}/>
          <span>Đơn hàng đã hủy — Đã hoàn tiền VNPay thành công</span>
        </div>
      ) : order.status === 'cancelled' && (
        <div className="od-status-banner od-status-banner-cancelled">
          <XCircle size={20} style={{ flexShrink: 0 }}/>
          <span>
            {order.paymentStatus === 'refund_pending'
              ? 'Đơn hàng đã hủy — Shop đang xử lý hoàn tiền VNPay'
              : 'Đơn hàng đã bị hủy'}
          </span>
        </div>
      )}
      {order.status === 'returned' && (
        <div className="od-status-banner od-status-banner-returned">
          <RotateCcw size={20} style={{ flexShrink: 0 }}/>
          <span>Đơn hàng đã được hoàn trả</span>
        </div>
      )}

      {/* Dải tóm tắt nhanh: người nhận, ngày đặt và tổng tiền hiện cạnh nhau. */}
      {order.shippingName && (
        <div className="od-summary-strip">
          <div className="od-summary-item">
            <span className="od-summary-label"><MapPin size={11} style={{ verticalAlign: 'middle', marginRight: 3 }}/>Giao tới</span>
            <span className="od-summary-value">{order.shippingName}</span>
            <span className="od-summary-sub">{order.shippingPhone}</span>
          </div>
          <div className="od-summary-item">
            <span className="od-summary-label"><Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }}/>Ngày đặt</span>
            <span className="od-summary-value">{fmtDate(order.createdAt)}</span>
            <span className="od-summary-sub">{PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}</span>
          </div>
          <div className="od-summary-item">
            <span className="od-summary-label"><CreditCard size={11} style={{ verticalAlign: 'middle', marginRight: 3 }}/>Tổng cộng</span>
            <span className="od-summary-value" style={{ color: 'var(--primary)', fontSize: '1rem' }}>{fmt(order.totalAmount)}</span>
            <span className="od-summary-sub" style={{ color: pst.color, fontWeight: 600 }}>{pst.label}</span>
          </div>
        </div>
      )}

      {/* Block thông tin hoàn trả — mỗi yêu cầu (có thể nhiều lần, mỗi lần 1 phần sản phẩm)
          hiện thành 1 card riêng: trạng thái, sản phẩm đã chọn, lý do, ảnh, phản hồi admin. */}
      {returnRequests.length > 0 && (
        <div className="od-card od-return-info-block">
          <h2 className="od-section-title"><RotateCcw size={16}/> Thông tin hoàn trả</h2>
          {returnRequests.map((req, ri) => (
            <div key={ri} className="od-return-request-card">
              {req.kind === 'json' && (
                <div className="od-return-req-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="od-return-req-code">#{req.data.reqCode}</span>
                    <a href={`/account/orders/${oid}/return-receipt?reqCode=${req.data.reqCode}`} target="_blank" rel="noreferrer"
                      className="od-return-print-link">
                      <Printer size={12}/> In phiếu này
                    </a>
                  </div>
                  <div className="od-return-timeline">
                    <span className="od-return-timeline-step od-return-timeline-done">Đã gửi</span>
                    <span className="od-return-timeline-sep"/>
                    <span className={`od-return-timeline-step ${!req.resolved ? 'od-return-timeline-active' : 'od-return-timeline-done'}`}>
                      Đang duyệt
                    </span>
                    <span className="od-return-timeline-sep"/>
                    <span className={`od-return-timeline-step ${
                      req.resolved ? (req.resolved.decision.approved ? 'od-return-timeline-done' : 'od-return-timeline-rejected') : ''
                    }`}>
                      {req.resolved ? (req.resolved.decision.approved ? 'Đã duyệt' : 'Từ chối') : 'Đã duyệt / Từ chối'}
                    </span>
                  </div>
                </div>
              )}
              <div className="od-return-info-grid">
                <div className="od-return-info-row">
                  <span className="od-return-info-label">Trạng thái:</span>
                  <span className="od-return-info-value">
                    {req.kind === 'json' ? (
                      !req.resolved ? (
                        <span className="od-return-status-badge od-return-status-pending">
                          <RotateCcw size={12}/> Chờ xét duyệt
                        </span>
                      ) : req.resolved.decision.approved ? (
                        <span className="od-return-status-badge od-return-status-approved">
                          <CheckCircle size={12}/> Đã được chấp nhận
                        </span>
                      ) : (
                        <span className="od-return-status-badge od-return-status-rejected">
                          <XCircle size={12}/> Đã bị từ chối
                        </span>
                      )
                    ) : (
                      !req.legacyResolved ? (
                        <span className="od-return-status-badge od-return-status-pending">
                          <RotateCcw size={12}/> Chờ xét duyệt
                        </span>
                      ) : req.legacyResolved.status === 'returned' ? (
                        <span className="od-return-status-badge od-return-status-approved">
                          <CheckCircle size={12}/> Đã được chấp nhận
                        </span>
                      ) : (
                        <span className="od-return-status-badge od-return-status-rejected">
                          <XCircle size={12}/> Đã bị từ chối
                        </span>
                      )
                    )}
                  </span>
                </div>
                <div className="od-return-info-row">
                  <span className="od-return-info-label">Ngày yêu cầu:</span>
                  <span className="od-return-info-value">{fmtDate(req.createdAt)}</span>
                </div>

                {req.kind === 'json' ? (
                  <>
                    <div className="od-return-info-row" style={{ alignItems: 'flex-start' }}>
                      <span className="od-return-info-label">Sản phẩm:</span>
                      <div>
                        {(req.data.items ?? []).map((line, li) => (
                          <div key={li} className="od-return-info-value">
                            {line.name} × {line.qty} — {fmt(line.lineRefund)}
                          </div>
                        ))}
                        <div className="od-return-info-value" style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                          Tổng tiền hoàn: {fmt(req.data.refundAmount)}
                        </div>
                      </div>
                    </div>
                    {req.data.reason && (
                      <div className="od-return-info-row">
                        <span className="od-return-info-label">Lý do:</span>
                        <span className="od-return-info-value">{req.data.reason}</span>
                      </div>
                    )}
                    {(req.data.images ?? []).length > 0 && (
                      <div className="od-return-info-row" style={{ alignItems: 'flex-start' }}>
                        <span className="od-return-info-label">Ảnh minh chứng:</span>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {req.data.images.map((url, ii) => (
                            <a key={ii} href={url} target="_blank" rel="noreferrer" title="Nhấn để xem ảnh gốc">
                              <img src={url} alt={`Minh chứng ${ii + 1}`} className="od-return-img-proof"/>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {req.resolved && (
                      <div className={`od-return-admin-resp ${
                        !req.resolved.decision.approved ? 'rejected'
                          : req.resolved.decision.refunded ? 'approved' : 'pending-refund'
                      }`}>
                        <strong>
                          {req.resolved.decision.approved ? '✓ Đã chấp nhận' : '✗ Đã từ chối'}
                          {req.resolved.createdAt && ` — ${fmtDate(req.resolved.createdAt)}`}
                        </strong>
                        {req.resolved.decision.approved && (
                          <p style={{ margin: '0.25rem 0 0' }}>
                            {req.resolved.decision.refunded
                              ? 'Đã hoàn tiền cho yêu cầu này.'
                              : 'Đang chờ shop chuyển khoản hoàn tiền.'}
                          </p>
                        )}
                        {!req.resolved.decision.approved && req.resolved.decision.rejectReason && (
                          <p style={{ margin: '0.25rem 0 0' }}>{req.resolved.decision.rejectReason}</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Dữ liệu cũ trước khi có hoàn trả từng sản phẩm — note text thường, 1 chuỗi ảnh */}
                    {req.note && (
                      <div className="od-return-info-row">
                        <span className="od-return-info-label">Lý do:</span>
                        <span className="od-return-info-value">{req.note}</span>
                      </div>
                    )}
                    {req.imageUrl && (
                      <div className="od-return-info-row" style={{ alignItems: 'flex-start' }}>
                        <span className="od-return-info-label">Ảnh minh chứng:</span>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {req.imageUrl.split(',').filter(Boolean).map((url, i2) => (
                            <a key={i2} href={url} target="_blank" rel="noreferrer" title="Nhấn để xem ảnh gốc">
                              <img src={url} alt={`Minh chứng ${i2 + 1}`} className="od-return-img-proof"/>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {req.legacyResolved && (
                      <div className={`od-return-admin-resp ${req.legacyResolved.status === 'returned' ? 'approved' : 'rejected'}`}>
                        <strong>
                          {req.legacyResolved.status === 'returned' ? '✓ Đã chấp nhận' : '✗ Đã từ chối'}
                          {req.legacyResolved.createdAt && ` — ${fmtDate(req.legacyResolved.createdAt)}`}
                        </strong>
                        {req.legacyResolved.note && <p style={{ margin: '0.25rem 0 0' }}>{req.legacyResolved.note}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="od-grid">

        {/* Cột trái: timeline tiến trình, danh sách sản phẩm, địa chỉ giao hàng và bảo hành. */}
        <div className="od-col-main">

          {/* Card tiến trình với timeline 4 bước và lịch sử trạng thái có thể thu/mở. */}
          <div className="od-card">
            <h2 className="od-section-title"><Truck size={16}/> Tiến trình đơn hàng</h2>
            <OrderTimeline status={order.status}/>
            {(order.statusHistory ?? []).length > 0 && (
              <>
                <button className="od-hist-toggle" onClick={() => setShowHistory(v => !v)}>
                  {showHistory ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  {showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử giao hàng'}
                </button>
                {showHistory && (
                  <div className="od-hist-list">
                    {/* Duyệt ngược lịch sử để bản ghi mới nhất hiện đầu tiên. */}
                    {[...(order.statusHistory)].reverse().map((h, i, arr) => {
                      const sc       = STATUS_CFG[h.status] ?? { label: h.status, color: '#6b7280' };
                      const isLatest = i === 0;
                      return (
                        <div key={i} className="od-hist-item">
                          <div className="od-hist-dot-col">
                            <div className="od-hist-dot" style={isLatest ? { borderColor: sc.color, background: sc.color } : {}}/>
                            {i < arr.length - 1 && <div className="od-hist-connector"/>}
                          </div>
                          <div className="od-hist-body">
                            <span className="od-hist-status" style={{ color: isLatest ? sc.color : 'var(--text)' }}>
                              {sc.label}
                            </span>
                            {h.note && <span className="od-hist-note">{formatHistoryNote(h)}</span>}
                            {h.imageUrl && (
                              <a href={h.imageUrl} target="_blank" rel="noreferrer" className="od-hist-img-link">
                                Xem ảnh minh chứng
                              </a>
                            )}
                            <span className="od-hist-time">{fmtHistoryDate(h.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Card danh sách sản phẩm với nút đánh giá đặt cạnh giá mỗi sản phẩm.
              Hiện "Xem đánh giá" nếu đã đánh giá, "Đánh giá" nếu chưa, chỉ khi đơn đã giao. */}
          <div className="od-card">
            <h2 className="od-section-title">
              <Package size={16}/> Sản phẩm ({items.reduce((s, i) => s + i.quantity, 0)})
            </h2>
            <div className="od-items">
              {items.map((item, i) => (
                <div key={i} className="od-item-row">
                  <div className="od-item-img">
                    {item.productImage
                      ? <img src={item.productImage} alt={item.productName}/>
                      : <Package size={22} color="#d1d5db"/>}
                  </div>
                  <div className="od-item-info">
                    {item.productId ? (
                      <Link to={`/products/${item.productSlug ?? item.productId}`} className="od-item-name">
                        {item.productName}
                      </Link>
                    ) : (
                      <span className="od-item-name">{item.productName}</span>
                    )}
                    <span className="od-item-qty">Số lượng: {item.quantity}</span>
                  </div>
                  <div className="od-item-price-wrap">
                    {item.quantity > 1 && (
                      <span className="od-item-unit">{fmt(item.unitPrice)} × {item.quantity}</span>
                    )}
                    <span className="od-item-total">{fmt((item.unitPrice ?? 0) * item.quantity)}</span>
                    {order.status === 'delivered' && item.productId && (
                      reviewedIds.has(item.productId) ? (
                        <a href={`/products/${item.productSlug ?? item.productId}#reviews`}
                          className="od-review-link od-review-done">
                          <CheckCircle size={12}/> Xem đánh giá
                        </a>
                      ) : (
                        <a href={`/products/${item.productSlug ?? item.productId}?review=1`}
                          className="od-review-link">
                          <Star size={12}/> Đánh giá
                        </a>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Địa chỉ giao hàng chỉ hiện khi có dữ liệu shippingName. */}
          {order.shippingName && (
            <div className="od-card">
              <h2 className="od-section-title"><MapPin size={16}/> Địa chỉ giao hàng</h2>
              <div className="od-addr">
                <p className="od-addr-name">{order.shippingName}</p>
                <p className="od-addr-phone"><Phone size={13}/> {order.shippingPhone}</p>
                <p className="od-addr-line"><MapPin size={13}/> {order.shippingAddress}</p>
              </div>
            </div>
          )}

          {/* Thông tin bảo hành chỉ hiện khi đơn đã giao và có ít nhất một sản phẩm có bảo hành. */}
          {order.status === 'delivered' && items.some(it => (it.warrantyMonths ?? 0) > 0) && (
            <div className="od-card">
              <h2 className="od-section-title"><ShieldCheck size={16}/> Bảo hành sản phẩm</h2>
              <div className="od-warranty-list">
                {items.map(it => {
                  const w = getWarrantyInfo(it, order.deliveredAt, order.status);
                  if ((it.warrantyMonths ?? 0) === 0) return null;
                  const iconColor = w.status === 'active' ? '#10b981' : w.status === 'expiring' ? '#f97316' : w.status === 'expired' ? '#ef4444' : '#9ca3af';
                  return (
                    <div key={it.orderItemId ?? it.productId} className="od-warranty-item">
                      <div className="od-wi-header">
                        <ShieldCheck size={16} color={iconColor} style={{ flexShrink: 0, marginTop: 2 }}/>
                        <span className="od-wi-name">{it.productName}</span>
                        {w.hasWarranty && (
                          <span className={`od-wi-badge od-wi-badge-${w.status}`}>{w.statusLabel}</span>
                        )}
                      </div>
                      {w.hasWarranty ? (
                        <div className="od-wi-details">
                          <span>Thời hạn: <strong>{w.months} tháng</strong></span>
                          {w.status !== 'not_started' && w.startDateStr && (
                            <span>{w.startDateStr} – {w.endDateStr}</span>
                          )}
                        </div>
                      ) : (
                        <div className="od-wi-details">
                          <span className="od-warranty-none">Không có bảo hành</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cột phải sticky: bảng phí thanh toán và tất cả nút hành động gộp chung. */}
        <div className="od-col-side">
          <div className="od-card">
            <h2 className="od-section-title"><CreditCard size={16}/> Thanh toán</h2>
            <div className="od-fees">
              <div className="od-fee-row"><span>Tạm tính</span><span>{fmt(order.subtotal)}</span></div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="od-fee-row od-fee-green">
                  <span>Giảm giá</span><span>−{fmt(order.discountAmount)}</span>
                </div>
              )}
              <div className="od-fee-row">
                <span>Phí vận chuyển</span>
                <span className={(order.shippingFee ?? 0) === 0 ? 'od-fee-green' : ''}>
                  {(order.shippingFee ?? 0) === 0 ? 'Miễn phí' : fmt(order.shippingFee)}
                </span>
              </div>
              {(order.installationFee ?? 0) > 0 && (
                <div className="od-fee-row">
                  <span>Phí lắp đặt</span><span>{fmt(order.installationFee)}</span>
                </div>
              )}
              <div className="od-fee-divider"/>
              <div className="od-fee-total">
                <span>Tổng cộng</span><span>{fmt(order.totalAmount)}</span>
              </div>
            </div>
            <p className="od-pay-method">
              <CreditCard size={13}/> {PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}
              {' · '}
              <span style={{ color: pst.color, fontWeight: 600 }}>{pst.label}</span>
            </p>

            {/* Các nút hành động xuất hiện tuỳ theo trạng thái đơn hàng:
                - pending/confirmed: Thanh toán lại VNPay, Hủy đơn
                - delivered: Mua lại, Yêu cầu hoàn trả (hoặc thông báo hết hạn)
                - cancelled/returned: Mua lại
                - return_pending: Thông báo đang chờ duyệt và link xem phiếu hoàn trả */}
            <div className="od-actions-inline">
              {isRetryable && (
                <button className="btn btn-primary od-action-btn" disabled={retryingPayment} onClick={handleRetryPayment}>
                  {retryingPayment ? <><Loader size={15} className="spin"/> Đang xử lý...</> : <><CreditCard size={15}/> Thanh toán VNPay</>}
                </button>
              )}
              {isCancelable && (
                <button className="btn btn-outline od-action-btn" disabled={canceling} onClick={handleCancelOrder}>
                  {canceling ? <><Loader size={15} className="spin"/> Đang hủy...</> : <><XCircle size={15}/> Hủy đơn hàng</>}
                </button>
              )}
              {order.status === 'delivered' && (
                <>
                  <button className="btn btn-outline od-action-btn" disabled={buyingAgain} onClick={handleBuyAgain}>
                    {buyingAgain ? <><Loader size={15} className="spin"/> Đang thêm...</> : <><RotateCcw size={15}/> Mua lại</>}
                  </button>
                  {canReturn ? (
                    <button className="od-return-btn od-action-btn" disabled={requestingReturn} onClick={handleRequestReturn}>
                      {requestingReturn
                        ? <><Loader size={15} className="spin"/> Đang gửi...</>
                        : <><RotateCcw size={15}/> Yêu cầu hoàn trả{returnLeft <= 3 ? ` (còn ${returnLeft} ngày)` : ''}</>}
                    </button>
                  ) : (
                    <p className="od-return-expired"><AlertCircle size={13}/> Đã hết thời hạn hoàn trả 7 ngày</p>
                  )}
                  {/* Đơn đã quay về delivered sau khi 1 yêu cầu hoàn trả từng phần được xử lý — vẫn xem lại được biên lai.
                      Nút "Xem lịch sử hoàn trả" — đang tạm ẩn theo yêu cầu. Bỏ comment để hiện lại.
                  {returnRequests.length > 0 && (
                    <Link to={`/account/orders/${oid}/return-receipt`}
                      className="btn btn-outline od-action-btn" style={{ fontSize: '0.85rem' }}>
                      <RotateCcw size={14}/> Xem lịch sử hoàn trả
                    </Link>
                  )}
                  */}
                </>
              )}
              {(order.status === 'cancelled' || order.status === 'returned') && (
                <button className="btn btn-outline od-action-btn" disabled={buyingAgain} onClick={handleBuyAgain}>
                  <RotateCcw size={15}/> Mua lại
                </button>
              )}
              {order.status === 'cancelled' &&
               (order.paymentStatus === 'refund_pending' || order.paymentStatus === 'refunded') && (
                <Link to={`/account/orders/${order.orderId ?? order.id}/return-receipt`}
                  className="btn btn-outline od-action-btn" style={{ fontSize: '0.85rem' }}>
                  <CreditCard size={14}/> Xem biên lai hoàn tiền
                </Link>
              )}
              {order.status === 'return_pending' && (
                <>
                  <p className="od-return-pending-note"><RotateCcw size={13}/> Yêu cầu hoàn trả đang chờ xét duyệt (1–2 ngày làm việc)</p>
                  {/* Nút "Xem phiếu yêu cầu hoàn trả" — đang tạm ẩn theo yêu cầu. Bỏ comment để hiện lại.
                  <a href={`/account/orders/${order.orderId ?? order.id}/return-receipt`} target="_blank" rel="noreferrer"
                    className="btn btn-outline od-action-btn" style={{ fontSize: '0.85rem' }}>
                    <RotateCcw size={14}/> Xem phiếu yêu cầu hoàn trả
                  </a>
                  */}
                </>
              )}
              {order.status === 'returned' && (
                <Link to={`/account/orders/${order.orderId ?? order.id}/return-receipt`}
                  className="btn btn-outline od-action-btn" style={{ fontSize: '0.85rem' }}>
                  <RotateCcw size={14}/> Xem biên lai hoàn tiền
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal xác nhận hủy đơn với dropdown chọn lý do và ô nhập lý do khác. */}
      {confirm?.type === 'cancel' && (
        <div className="admin-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="admin-modal admin-modal-sm return-request-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Xác nhận hủy đơn hàng</h2>
              <button onClick={() => setConfirm(null)} aria-label="Đóng"><XCircle size={18}/></button>
            </div>
            <div className="admin-modal-body">
              {order.paymentStatus === 'paid' && (
                <p style={{ marginBottom: '0.75rem', padding: '0.6rem 0.8rem', background: '#fff7ed',
                  border: '1px solid #fed7aa', borderRadius: 6, fontSize: '0.85rem', color: '#9a3412' }}>
                  Đơn hàng này đã thanh toán qua VNPay — sau khi hủy, shop sẽ hoàn tiền lại cho bạn trong <strong>3–5 ngày làm việc</strong>.
                </p>
              )}
              <p style={{ marginBottom: '0.75rem' }}>Vui lòng cho biết lý do hủy:</p>
              <select value={confirm.reason}
                onChange={e => setConfirm({ ...confirm, reason: e.target.value, customReason: '' })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.9rem' }}>
                <option value="">— Chọn lý do —</option>
                <option value="Đặt nhầm sản phẩm">Đặt nhầm sản phẩm</option>
                <option value="Tìm được giá tốt hơn">Tìm được giá tốt hơn</option>
                <option value="Thay đổi địa chỉ giao hàng">Thay đổi địa chỉ giao hàng</option>
                <option value="Không còn nhu cầu">Không còn nhu cầu</option>
                <option value="other">Lý do khác...</option>
              </select>
              {confirm.reason === 'other' && (
                <input type="text" value={confirm.customReason}
                  onChange={e => setConfirm({ ...confirm, customReason: e.target.value })}
                  placeholder="Nhập lý do hủy..."
                  style={{ marginTop: '0.5rem', width: '100%', padding: '0.45rem 0.7rem', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: '0.88rem' }}
                />
              )}
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setConfirm(null)}>Quay lại</button>
              <button className="admin-btn-danger"
                disabled={!confirm.reason || (confirm.reason === 'other' && !confirm.customReason.trim())}
                onClick={() => {
                  const r = confirm.reason === 'other' ? confirm.customReason.trim() : confirm.reason;
                  setConfirm(null);
                  doCancelOrder(r);
                }}>
                <XCircle size={14}/> Hủy đơn hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal yêu cầu hoàn trả: textarea lý do + gợi ý chip + upload tối đa 3 ảnh minh chứng. */}
      {confirm?.type === 'return' && (() => {
        // Tổng tiền hoàn realtime — tính lại mỗi khi tick/đổi số lượng sản phẩm.
        const refundTotal = Object.entries(confirm.selected ?? {}).reduce((sum, [iid, qty]) => {
          const item = (confirm.items ?? []).find(i => i.orderItemId === Number(iid));
          return sum + (item ? item.unitPrice * qty : 0);
        }, 0);
        return (
        <div className="admin-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="admin-modal admin-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Yêu cầu hoàn trả đơn #{order.orderCode ?? oid}</h2>
              <button onClick={() => setConfirm(null)} aria-label="Đóng"><XCircle size={18}/></button>
            </div>
            <div className="admin-modal-body">
              {/* Chọn sản phẩm cần hoàn trả + số lượng — chỉ sản phẩm còn có thể hoàn trả mới chọn được */}
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Chọn sản phẩm hoàn trả <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(confirm.items ?? []).map(item => {
                    const iid = item.orderItemId;
                    const maxQty = item.quantity - (item.returnedQty ?? 0);
                    const sel = confirm.selected?.[iid];
                    const checked = sel != null;
                    if (maxQty <= 0) {
                      return (
                        <div key={iid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.5rem 0.7rem', border: '1.5px solid var(--border)', borderRadius: 8,
                          opacity: 0.55, fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                            {item.productImage
                              ? <img src={item.productImage} alt={item.productName} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}/>
                              : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-gray)', flexShrink: 0 }}/>}
                            <span>{item.productName}</span>
                          </div>
                          <span style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>Đã yêu cầu hoàn trả hết</span>
                        </div>
                      );
                    }
                    return (
                      <div key={iid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '0.6rem', padding: '0.5rem 0.7rem', border: '1.5px solid var(--border)', borderRadius: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                          <input type="checkbox" checked={checked} style={{ width: 17, height: 17, flexShrink: 0, cursor: 'pointer' }}
                            onChange={e => setConfirm(prev => {
                              const next = { ...(prev.selected ?? {}) };
                              if (e.target.checked) next[iid] = 1; else delete next[iid];
                              return { ...prev, selected: next };
                            })}/>
                          {item.productImage
                            ? <img src={item.productImage} alt={item.productName} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}/>
                            : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-gray)', flexShrink: 0 }}/>}
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.86rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.productName}
                            </span>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                              {fmt(item.unitPrice)} · đã mua {item.quantity} / còn được trả {maxQty}
                            </span>
                          </span>
                        </label>
                        {checked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <button type="button" disabled={sel <= 1}
                              onClick={() => setConfirm(prev => ({ ...prev, selected: { ...prev.selected, [iid]: Math.max(1, sel - 1) } }))}
                              style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid var(--border)', background: '#fff', cursor: 'pointer' }}>−</button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '1.2em', textAlign: 'center' }}>{sel}</span>
                            <button type="button" disabled={sel >= maxQty}
                              onClick={() => setConfirm(prev => ({ ...prev, selected: { ...prev.selected, [iid]: Math.min(maxQty, sel + 1) } }))}
                              style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid var(--border)', background: '#fff', cursor: 'pointer' }}>+</button>
                            <span style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>/ tối đa {maxQty}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Lý do hoàn trả <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea value={confirm.reason}
                  onChange={e => setConfirm({ ...confirm, reason: e.target.value, returnReasonTouched: true })}
                  onBlur={() => setConfirm({ ...confirm, returnReasonTouched: true })}
                  placeholder="Mô tả lý do hoàn trả của bạn..."
                  rows={3}
                  className={confirm.returnReasonTouched && !confirm.reason?.trim() ? 'is-error' : ''}
                  style={{ minHeight: 92 }}
                />
                {/* Các chip gợi ý để click chọn nhanh thay vì gõ tay. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.45rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', alignSelf: 'center' }}>Gợi ý:</span>
                  {RETURN_SUGGESTIONS.map(s => (
                    <button key={s} type="button"
                      onClick={() => setConfirm({ ...confirm, reason: s, returnReasonTouched: true })}
                      style={{
                        fontSize: '0.76rem', padding: '0.2rem 0.55rem', borderRadius: 20,
                        border: '1px solid var(--border)', background: confirm.reason === s ? 'var(--primary-light)' : '#f9fafb',
                        color: confirm.reason === s ? 'var(--primary)' : 'var(--text)',
                        cursor: 'pointer', fontWeight: confirm.reason === s ? 600 : 400,
                        transition: 'all 0.12s',
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Vùng upload ảnh với drag-drop và click-to-upload, tối đa 3 ảnh mỗi ≤ 5MB. */}
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Ảnh minh chứng{' '}
                  <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(tuỳ chọn, tối đa 3 ảnh)</span>
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {(confirm.returnImgs ?? []).map((url, idx) => (
                    <div key={url} style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={url} alt={`ảnh ${idx + 1}`}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6,
                          border: '1px solid var(--border)', display: 'block' }}/>
                      <button
                        onClick={() => setConfirm(prev => ({
                          ...prev, returnImgs: (prev.returnImgs ?? []).filter((_, i) => i !== idx)
                        }))}
                        style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444',
                          border: 'none', borderRadius: '50%', width: 18, height: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#fff', fontSize: 11, padding: 0 }}>
                        ×
                      </button>
                    </div>
                  ))}
                  {(confirm.returnImgs ?? []).length < 3 && (
                    <div
                      onClick={() => !uploadingProof && proofImgRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setProofDragOver(true); }}
                      onDragLeave={() => setProofDragOver(false)}
                      onDrop={e => {
                        e.preventDefault(); setProofDragOver(false);
                        handleUploadProof(e.dataTransfer.files);
                      }}
                      style={{
                        width: 80, height: 80, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '0.2rem',
                        border: `1.5px dashed ${proofDragOver ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 6, background: proofDragOver ? 'var(--primary-light)' : 'var(--bg-gray)',
                        cursor: uploadingProof ? 'wait' : 'pointer', color: 'var(--text-light)',
                        fontSize: '0.72rem', transition: 'all 0.12s', flexShrink: 0,
                      }}
                    >
                      {uploadingProof
                        ? <Loader size={16} className="spin"/>
                        : <><Upload size={16}/><span>Thêm ảnh<br/>({(confirm.returnImgs ?? []).length}/3)</span></>}
                    </div>
                  )}
                </div>
                {/* Input file ẩn, được trigger bởi click vào ô drag-drop phía trên. */}
                <input ref={proofImgRef} type="file" accept="image/*" hidden multiple disabled={uploadingProof}
                  onChange={async e => { await handleUploadProof(e.target.files); e.target.value = ''; }}/>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', background: 'var(--bg-gray)', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
                Chính sách hoàn trả trong vòng <strong>7 ngày</strong> kể từ khi nhận hàng. Sẽ được xét duyệt trong 1–2 ngày làm việc.
              </p>
            </div>
            {/* Thanh tổng tiền hoàn dính đáy — cập nhật realtime theo sản phẩm/số lượng đã chọn */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.7rem 1.5rem', background: 'var(--bg-gray)', borderTop: '1.5px solid var(--border)', fontSize: '0.88rem' }}>
              <span>Tổng tiền hoàn</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{fmt(refundTotal)}</strong>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setConfirm(null)}>Quay lại</button>
              <button className="admin-btn-warning"
                disabled={!confirm.reason?.trim() || uploadingProof || Object.keys(confirm.selected ?? {}).length === 0}
                onClick={() => {
                  const imgs   = confirm.returnImgs ?? [];
                  const reason = confirm.reason.trim();
                  const items  = Object.entries(confirm.selected ?? {}).map(([orderItemId, qty]) => ({ orderItemId: Number(orderItemId), qty }));
                  setConfirm(null);
                  doRequestReturn(reason, imgs, items);
                }}>
                <RotateCcw size={14}/> Gửi yêu cầu hoàn trả
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </main>
  );
};

export default OrderDetail;
