// Trang tài khoản khách hàng với 4 tab: Thông tin cá nhân, Địa chỉ, Đổi mật khẩu, Đơn hàng.
// Tab Đơn hàng hiển thị OrderCard mở rộng được — hỗ trợ hủy đơn, hoàn trả, thanh toán lại VNPay, mua lại.
// Tab Địa chỉ CRUD đầy đủ với ProvinceCombobox, hỗ trợ tên tỉnh mới sau sáp nhập (34 tỉnh từ 12/6/2025).
// LEGACY_PROVINCE map chuyển tên tỉnh cũ về tỉnh mới để địa chỉ đã lưu không bị lỗi validation.
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import {
  User, Phone, Mail, Lock, ShoppingBag, Eye, EyeOff, CheckCircle, Loader,
  Package, Clock, Truck, Star, XCircle, CreditCard, MapPin,
  Plus, Edit2, Home, Save, X, ChevronRight, RotateCcw,
  LogOut, Award, Shield, AlertCircle, Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userAPI, orderAPI, addressAPI, paymentAPI, cartAPI, uploadAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { provinces } from '../constants/provinces';
import ProvinceCombobox from '../components/ProvinceCombobox';
import WardCombobox from '../components/WardCombobox';

const fmt     = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n ?? 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';

/* Ánh xạ tên tỉnh cũ → tên tỉnh mới (34 tỉnh từ 12/6/2025) */
const LEGACY_PROVINCE = {
  'bình dương': 'Hồ Chí Minh', 'bà rịa': 'Hồ Chí Minh', 'vũng tàu': 'Hồ Chí Minh',
  'bà rịa - vũng tàu': 'Hồ Chí Minh', 'tp. hồ chí minh': 'Hồ Chí Minh', 'tp hcm': 'Hồ Chí Minh',
  'hải dương': 'Hải Phòng', 'bắc giang': 'Bắc Ninh', 'thái bình': 'Hưng Yên',
  'hà nam': 'Ninh Bình', 'nam định': 'Ninh Bình',
  'vĩnh phúc': 'Phú Thọ', 'hòa bình': 'Phú Thọ',
  'hà giang': 'Tuyên Quang', 'yên bái': 'Lào Cai', 'bắc kạn': 'Thái Nguyên',
  'quảng bình': 'Quảng Trị', 'quảng nam': 'Đà Nẵng',
  'bình định': 'Gia Lai', 'kon tum': 'Gia Lai',
  'phú yên': 'Đắk Lắk', 'đắk nông': 'Lâm Đồng', 'bình thuận': 'Lâm Đồng',
  'ninh thuận': 'Khánh Hòa', 'bình phước': 'Đồng Nai',
  'long an': 'Tây Ninh', 'hậu giang': 'Cần Thơ', 'sóc trăng': 'Cần Thơ',
  'kiên giang': 'An Giang', 'bến tre': 'Vĩnh Long', 'trà vinh': 'Vĩnh Long',
  'tiền giang': 'Đồng Tháp', 'bạc liêu': 'Cà Mau',
  'thừa thiên huế': 'Huế', 'thừa thiên - huế': 'Huế',
};
const matchProvince = (city = '') => {
  const c = city.trim().toLowerCase();
  if (!c) return '';
  const exact = provinces.find(p => p.toLowerCase() === c);
  if (exact) return exact;
  const partial = provinces.find(p => c.includes(p.toLowerCase()) || p.toLowerCase().includes(c));
  if (partial) return partial;
  return LEGACY_PROVINCE[c] ?? city; // trả về city gốc nếu không khớp gì
};

const STATUS_LABEL = {
  pending:        { label: 'Chờ xử lý',          color: '#f59e0b', bg: '#fef3c7', icon: <Clock size={13}/>,        textUpper: 'CHỜ XỬ LÝ' },
  confirmed:      { label: 'Đã xác nhận',         color: '#3b82f6', bg: '#dbeafe', icon: <CheckCircle size={13}/>,  textUpper: 'ĐÃ XÁC NHẬN' },
  shipping:       { label: 'Đang giao',            color: '#8b5cf6', bg: '#ede9fe', icon: <Truck size={13}/>,        textUpper: 'ĐANG GIAO' },
  delivered:      { label: 'Đã giao',              color: '#10b981', bg: '#d1fae5', icon: <CheckCircle size={13}/>,  textUpper: 'ĐÃ GIAO' },
  cancelled:      { label: 'Đã hủy',               color: '#ef4444', bg: '#fee2e2', icon: <XCircle size={13}/>,      textUpper: 'ĐÃ HỦY' },
  return_pending: { label: 'Chờ duyệt hoàn trả',  color: '#f97316', bg: '#fff7ed', icon: <RotateCcw size={13}/>,    textUpper: 'CHỜ DUYỆT HOÀN TRẢ' },
  returned:       { label: 'Đã hoàn trả',          color: '#6b7280', bg: '#f3f4f6', icon: <RotateCcw size={13}/>,    textUpper: 'ĐÃ HOÀN TRẢ' },
};

const PAY_STATUS = {
  unpaid:             { label: 'Chưa thanh toán',  color: '#f59e0b' },
  paid:               { label: 'Đã thanh toán',    color: '#10b981' },
  refund_pending:     { label: 'Chờ hoàn tiền',    color: '#f97316' },
  refunded:           { label: 'Đã hoàn tiền',     color: '#6b7280' },
  partially_refunded: { label: 'Đã hoàn 1 phần',  color: '#f59e0b' },
};

const RETURN_SUGGESTIONS = [
  'Sản phẩm bị lỗi hoặc hư hỏng',
  'Giao sai sản phẩm',
  'Thiếu phụ kiện',
  'Sản phẩm không đúng mô tả',
  'Muốn đổi/trả vì lý do cá nhân',
];
const RETURN_MAX_IMAGES = 3;
const RETURN_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const TABS = [
  { id: 'profile',   icon: <User size={18}/>,       label: 'Thông tin tài khoản' },
  { id: 'addresses', icon: <MapPin size={18}/>,      label: 'Địa chỉ của tôi'  },
  { id: 'password',  icon: <Lock size={18}/>,        label: 'Đổi mật khẩu'     },
  { id: 'orders',    icon: <ShoppingBag size={18}/>, label: 'Đơn hàng của tôi' },
];

const emptyAddr = { fullName:'', phone:'', addressLine:'', ward:'', district:'', city:'', isDefault:false };

/* ══ Helper: tiến trình đơn hàng ══════════════════════════ */
/* ORDER_STEPS, OrderProgress và OrderDetailModal đã được tách ra src/pages/OrderDetail.jsx */

/* ══ Tính deadline hoàn trả 7 ngày ════════════════════════ */
// Dùng deliveredAt (không phải updatedAt) để khớp cách backend tính deadline —
// updatedAt bị reset mỗi khi admin sửa đơn sau khi giao, gây lệch hạn hoàn trả giữa FE/BE.
const calcReturnDaysLeft = (deliveredAt) => {
  if (!deliveredAt) return 0;
  return Math.max(0, 7 - Math.floor((Date.now() - new Date(deliveredAt)) / 86_400_000));
};

// parseReturnRequest đọc JSON lưu trong statusHistory.note (hoàn trả từng sản phẩm) —
// trả null nếu không phải JSON đúng định dạng (dữ liệu cũ trước khi có tính năng này).
// Dùng để đếm số sản phẩm đang chờ duyệt hiển thị badge phụ trên thẻ đơn.
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
// pendingReturnItemCount đếm tổng số lượng sản phẩm trong các yêu cầu hoàn trả còn đang chờ duyệt.
const pendingReturnItemCount = (statusHistory) => {
  const history = statusHistory ?? [];
  const decidedCodes = new Set(history.map(h => parseReturnDecision(h.note)?.reqCode).filter(Boolean));
  return history
    .filter(h => h.status === 'return_pending')
    .map(h => parseReturnRequest(h.note))
    .filter(req => req && !decidedCodes.has(req.reqCode))
    .reduce((sum, req) => sum + (req.items ?? []).reduce((s, line) => s + line.qty, 0), 0);
};

/* ══ OrderCard — Gọn, chuyên nghiệp ════════════════════════ */
const ITEMS_PREVIEW = 2;

const OrderCard = ({
  order,
  onCancel, onRequestReturn, onRetryPayment, onBuyAgain, onViewDetail,
  cancelingId, requestingReturnId, retryingPaymentId,
}) => {
  const [showAllItems, setShowAllItems] = useState(false);
  const st  = STATUS_LABEL[order.status] ?? { label: order.status, color:'#6b7280', bg:'#f3f4f6', icon: null };
  const pst = PAY_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, color:'#6b7280' };
  const id  = order.orderId ?? order.id;
  const items = order.items ?? [];
  const visibleItems  = showAllItems ? items : items.slice(0, ITEMS_PREVIEW);
  const hiddenCount   = items.length - ITEMS_PREVIEW;
  const returnDaysLeft = order.status === 'delivered' ? calcReturnDaysLeft(order.deliveredAt) : 0;
  const returnExpired  = order.status === 'delivered' && returnDaysLeft === 0;
  const pendingReturnQty = order.status === 'return_pending' ? pendingReturnItemCount(order.statusHistory) : 0;

  return (
    <div className="shopee-order-card">
      {/* Header — mã đơn + 2 badge trạng thái */}
      <div className="soc-header">
        <div className="soc-header-left">
          <Package size={14} style={{color:'var(--text-light)'}}/>
          <button className="soc-code soc-code-btn" onClick={() => onViewDetail(order)} title="Xem chi tiết đơn hàng">
            #{order.orderCode ?? id}
          </button>
          <span className="soc-date">{fmtDate(order.createdAt)}</span>
        </div>
        <div className="soc-header-badges">
          <span className="soc-status-badge" style={{color:st.color, background:st.bg}}>
            {st.icon} {st.label}
          </span>
          {pendingReturnQty > 0 && (
            <span className="soc-status-badge" style={{color:'#f97316', background:'#fff7ed'}}>
              Đang hoàn trả {pendingReturnQty} SP
            </span>
          )}
          <span className="soc-pay-badge" style={{color:pst.color}}>{pst.label}</span>
        </div>
      </div>

      {/* Sản phẩm — hiện tối đa ITEMS_PREVIEW, còn lại thu gọn */}
      <div className="soc-items">
        {visibleItems.map((item, i) => (
          <div key={i} className="soc-item-row">
            <div className="soc-item-img-wrap">
              {item.productImage
                ? <img src={item.productImage} alt={item.productName ?? 'Sản phẩm'}/>
                : <div className="soc-item-img-placeholder"><Package size={18} color="#d1d5db"/></div>
              }
            </div>
            <div className="soc-item-info">
              <span className="soc-item-name">{item.productName}</span>
              <span className="soc-item-qty">x{item.quantity}</span>
              {/* Đánh giá per-item: chỉ hiện khi đơn đã giao, link thẳng đến trang sản phẩm.
                  ?review=1 để trang sản phẩm tự cuộn xuống + mở form viết đánh giá (xem ProductDetail.jsx). */}
              {order.status === 'delivered' && (item.productSlug || item.productName) && (
                <Link
                  to={item.productSlug
                    ? `/products/${item.productSlug}?review=1`
                    : `/products?keyword=${encodeURIComponent(item.productName ?? '')}`}
                  className="soc-item-review-link"
                  title={`Đánh giá ${item.productName}`}
                >
                  <Star size={11}/> Đánh giá
                </Link>
              )}
            </div>
            <span className="soc-item-price">{fmt((item.unitPrice ?? 0) * item.quantity)}</span>
          </div>
        ))}
        {!showAllItems && hiddenCount > 0 && (
          <button className="soc-show-more-btn" onClick={() => setShowAllItems(true)}>
            Xem thêm {hiddenCount} sản phẩm khác
          </button>
        )}
      </div>

      {/* Footer — tổng + hành động */}
      <div className="soc-footer">
        <div className="soc-total-wrap">
          <span className="soc-total-label">{items.reduce((s,i)=>s+i.quantity,0)} sp · Tổng:</span>
          <span className="soc-total-amount">{fmt(order.totalAmount)}</span>
        </div>

        <div className="soc-actions">
          {/* Chi tiết — luôn hiện */}
          <button className="soc-btn-detail" onClick={() => onViewDetail(order)}>
            <Eye size={13}/> Chi tiết
          </button>

          {/* Đơn đã giao: Mua lại → Đánh giá → Hoàn trả */}
          {order.status === 'delivered' && (
            <>
              <button className="soc-btn-secondary" onClick={() => onBuyAgain(items)}>
                <RotateCcw size={13}/> Mua lại
              </button>
              {!returnExpired && (
                <button className="soc-btn-return" disabled={requestingReturnId === id}
                  onClick={() => onRequestReturn(order)}>
                  {requestingReturnId === id
                    ? <><Loader size={13} className="spin"/> Đang gửi...</>
                    : <><RotateCcw size={13}/> Hoàn trả{returnDaysLeft <= 3 ? ` (${returnDaysLeft}n)` : ''}</>}
                </button>
              )}
            </>
          )}

          {/* Đơn chờ / xác nhận: Thanh toán + Hủy */}
          {(order.status === 'pending' || order.status === 'confirmed') && (
            <>
              {order.paymentMethod === 'vnpay' && order.paymentStatus === 'unpaid' && (
                <button className="soc-btn-primary" disabled={retryingPaymentId === id}
                  onClick={() => onRetryPayment(id)}>
                  {retryingPaymentId === id
                    ? <><Loader size={13} className="spin"/> Đang xử lý...</>
                    : <><CreditCard size={13}/> Thanh toán</>}
                </button>
              )}
              <button className="soc-btn-secondary" disabled={cancelingId === id}
                onClick={() => onCancel(id, order.orderCode, order.paymentStatus)}>
                {cancelingId === id
                  ? <><Loader size={13} className="spin"/> Đang hủy...</>
                  : <><XCircle size={13}/> Hủy đơn</>}
              </button>
            </>
          )}

          {/* Đơn hủy / đã hoàn trả: Mua lại */}
          {(order.status === 'cancelled' || order.status === 'returned') && (
            <button className="soc-btn-secondary" onClick={() => onBuyAgain(items)}>
              <RotateCcw size={13}/> Mua lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══ Main Account Component ════════════════════════════════ */
const Account = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const { fetchCart }                = useCart();
  const navigate  = useNavigate();
  const location  = useLocation();

  const validTabs = ['profile','addresses','password','orders'];
  const [tab, setTab] = useState(() => {
    const st = location.state?.tab;
    return validTabs.includes(st) ? st : 'profile';
  });

  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');
  const [confirm, setConfirm] = useState(null); // { type, id, ... } — dùng cho form hoàn trả
  const [cancelConfirm, setCancelConfirm] = useState(null); // { id, orderCode }
  const [returnFirstConfirm, setReturnFirstConfirm] = useState(null); // { id, orderCode }

  useEffect(() => {
    const st = location.state?.tab;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (st && validTabs.includes(st)) { setTab(st); setSuccess(''); setError(''); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  /* ── Profile ── */
  const [profile, setProfile] = useState({ fullName: user?.name || '', phone: user?.phone || '' });

  /* ── Password ── */
  const [showPwd, setShowPwd] = useState({ old:false, new:false, confirm:false });
  const [pwd, setPwd]         = useState({ old:'', new:'', confirm:'' });

  /* ── Orders ── */
  const [orders,           setOrders]           = useState([]);
  const [ordersLoading,    setOrdersLoading]    = useState(false);
  const [ordersError,      setOrdersError]      = useState('');
  const [ordersPage,       setOrdersPage]       = useState(0);
  const [ordersHasMore,    setOrdersHasMore]    = useState(false);
  const [ordersLoadingMore,setOrdersLoadingMore]= useState(false);
  const [cancelingId,         setCancelingId]         = useState(null);
  const [requestingReturnId,  setRequestingReturnId]  = useState(null);
  const [uploadingReturnImg,  setUploadingReturnImg]  = useState(false);
  const [returnImgDragOver,   setReturnImgDragOver]   = useState(false);
  const returnImgRef = useRef(null);
  const [deleteAddrConfirm,   setDeleteAddrConfirm]   = useState(null); // { id, isDefault }
  const [saveConfirm,         setSaveConfirm]         = useState(null); // { type: 'profile'|'password'|'addrSave', payload? }
  const [retryingPaymentId,   setRetryingPaymentId]   = useState(null);
  const [orderFilter,      setOrderFilter]      = useState('all');

  /* ── Addresses ── */
  const [addresses,       setAddresses]       = useState([]);
  const [addrLoading,     setAddrLoading]      = useState(false);
  const [showAddrForm,    setShowAddrForm]     = useState(false);
  const [editingAddr,     setEditingAddr]      = useState(null);
  const [addrForm,        setAddrForm]         = useState(emptyAddr);
  const [addrSaving,      setAddrSaving]       = useState(false);
  const [addrFormError,   setAddrFormError]   = useState('');

  useEffect(() => { if (!isLoggedIn) navigate('/login'); }, [isLoggedIn, navigate]);

  /* Fix #1: Tải đơn hàng có phân trang */
  const PAGE_SIZE = 10;

  const loadOrders = (page, append = false) => {
    if (page === 0) {
      setOrdersLoading(true); setOrdersError('');
    } else {
      setOrdersLoadingMore(true);
    }
    orderAPI.getMy(page, PAGE_SIZE)
      .then(res => {
        const pageData = res?.data ?? res;
        const content  = pageData?.content ?? (Array.isArray(pageData) ? pageData : []);
        const isLast   = pageData?.last ?? content.length < PAGE_SIZE;
        if (append) setOrders(prev => [...prev, ...content]);
        else        setOrders(content);
        setOrdersPage(page);
        setOrdersHasMore(!isLast);
      })
      .catch(err => { setOrdersError(err.message); if (!append) setOrders([]); })
      .finally(() => { setOrdersLoading(false); setOrdersLoadingMore(false); });
  };

  useEffect(() => {
    if (tab !== 'orders') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders(0);
  }, [tab]);

  /* Tải địa chỉ */
  const fetchAddresses = () => {
    setAddrLoading(true);
    addressAPI.getAll()
      .then(res => setAddresses(res?.data ?? res ?? []))
      .catch(() => setAddresses([]))
      .finally(() => setAddrLoading(false));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === 'addresses') fetchAddresses(); }, [tab]);

  const notify = (msg, isErr=false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setSuccess(''); setError(''); }, 3500);
  };

  /* Profile save */
  const handleProfileSave = (e) => {
    e.preventDefault();
    if (!profile.fullName.trim()) return notify('Vui lòng nhập họ tên.', true);
    const phoneCleanProfile = profile.phone.replace(/[\s.\-]/g, '');
    if (phoneCleanProfile && !/^0[3-9]\d{8}$/.test(phoneCleanProfile))
      return notify('Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số).', true);
    setSaveConfirm({ type: 'profile' });
  };
  const doProfileSave = async () => {
    setSaveConfirm(null);
    setSaving(true);
    try { await userAPI.updateMe({ fullName: profile.fullName, phone: profile.phone }); notify('Cập nhật thành công!'); }
    catch (err) { notify(err.message, true); }
    finally { setSaving(false); }
  };

  /* Password save */
  const handlePasswordSave = (e) => {
    e.preventDefault();
    if (!pwd.old || !pwd.new || !pwd.confirm) return notify('Vui lòng điền đầy đủ.', true);
    if (pwd.new !== pwd.confirm) return notify('Mật khẩu mới không khớp.', true);
    if (pwd.new.length < 6) return notify('Tối thiểu 6 ký tự.', true);
    setSaveConfirm({ type: 'password' });
  };
  const doPasswordSave = async () => {
    setSaveConfirm(null);
    setSaving(true);
    try { await userAPI.changePassword({ oldPassword: pwd.old, newPassword: pwd.new }); notify('Đổi mật khẩu thành công!'); setPwd({old:'',new:'',confirm:''}); }
    catch (err) { notify(err.message, true); }
    finally { setSaving(false); }
  };

  /* Hủy đơn hàng */
  const handleCancelOrder = (orderId, orderCode, paymentStatus) =>
    setCancelConfirm({ id: orderId, orderCode, paymentStatus });

  const doCancelOrder = async (orderId, reason) => {
    setCancelingId(orderId);
    const snapshot = orders; // snapshot để rollback nếu lỗi
    setOrders(prev => prev.map(o => (o.orderId??o.id) === orderId ? {...o, status:'cancelled'} : o));
    try {
      await orderAPI.cancel(orderId, reason || undefined);
      notify('Đã hủy đơn hàng.');
    } catch (err) {
      setOrders(snapshot); // rollback optimistic update
      notify(err.message, true);
    } finally { setCancelingId(null); }
  };

  /* Yêu cầu hoàn trả — hoàn theo từng sản phẩm + số lượng (không bắt buộc cả đơn)
   * Ảnh minh chứng upload lên ImgBB qua uploadAPI.uploadImage trước, rồi gửi mảng URL lên API */
  const handleRequestReturn = (order) =>
    setReturnFirstConfirm({ id: order.orderId ?? order.id, orderCode: order.orderCode, items: order.items ?? [] });

  const doRequestReturn = async (orderId, reason, images, items) => {
    setRequestingReturnId(orderId);
    const snapshot = orders;
    setOrders(prev => prev.map(o => (o.orderId??o.id) === orderId ? {...o, status:'return_pending'} : o));
    try {
      await orderAPI.requestReturn(orderId, { reason, images, items });
      notify('Đã gửi yêu cầu hoàn trả. Chúng tôi sẽ liên hệ xử lý sớm nhất!');
    } catch (err) {
      setOrders(snapshot);
      notify(err.message, true);
    } finally { setRequestingReturnId(null); }
  };

  const uploadReturnImages = async (files) => {
    const candidates = Array.from(files ?? []).filter(Boolean);
    if (!candidates.length) return;

    const currentCount = confirm?.returnImgs?.length ?? 0;
    const remaining = RETURN_MAX_IMAGES - currentCount;
    if (remaining <= 0) return notify(`Chỉ được tải tối đa ${RETURN_MAX_IMAGES} ảnh.`, true);

    const validFiles = [];
    for (const file of candidates.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        notify('Vui lòng chọn đúng định dạng ảnh.', true);
        continue;
      }
      if (file.size > RETURN_MAX_IMAGE_SIZE) {
        notify('Mỗi ảnh minh chứng không được vượt quá 5MB.', true);
        continue;
      }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    setUploadingReturnImg(true);
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
      notify('Lỗi upload ảnh: ' + (err.message || 'Thử lại sau'), true);
    } finally {
      setUploadingReturnImg(false);
    }
  };

  /* Fix #2: Mua lại — thêm tất cả items vào giỏ */
  const handleBuyAgain = async (items) => {
    if (!items?.length) return;
    let added = 0;
    for (const item of items) {
      if (!item.productId) continue;
      try {
        await cartAPI.add(item.productId, item.quantity ?? 1);
        added++;
      } catch { /* bỏ qua nếu hết hàng hoặc lỗi */ }
    }
    if (added > 0) {
      await fetchCart().catch(() => {}); // đồng bộ lại số lượng giỏ trên header
      notify(`Đã thêm ${added} sản phẩm vào giỏ hàng!`);
    } else {
      notify('Không thể thêm sản phẩm (có thể đã hết hàng).', true);
    }
  };

  /* Retry thanh toán VNPay cho đơn pending */
  const handleRetryVNPay = async (orderId) => {
    setRetryingPaymentId(orderId);
    try {
      const payRes = await paymentAPI.createVNPay(orderId);
      const payUrl = typeof payRes === 'string' ? payRes
        : payRes?.data ?? payRes?.url ?? payRes?.paymentUrl ?? null;
      if (!payUrl || typeof payUrl !== 'string') throw new Error('Không lấy được URL thanh toán.');
      window.location.href = payUrl;
    } catch (err) {
      notify(err.message || 'Không thể thực hiện thanh toán. Vui lòng thử lại.', true);
      setRetryingPaymentId(null);
    }
  };

  /* Địa chỉ CRUD */
  const closeAddrForm = () => {
    setShowAddrForm(false);
    setEditingAddr(null);
    setAddrFormError('');
  };

  const openAddrAdd = () => {
    setEditingAddr(null);
    setAddrFormError('');
    setAddrForm({ ...emptyAddr, isDefault: addresses.length === 0 });
    setShowAddrForm(true);
  };
  const openAddrEdit = (a) => {
    setEditingAddr(a.addressId ?? a.id);
    setAddrFormError('');
    setAddrForm({
      fullName:    a.fullName    ?? '',
      phone:       a.phone       ?? '',
      addressLine: a.addressLine ?? '',
      ward:        a.ward        ?? '',
      district:    a.district    ?? '',
      city:        matchProvince(a.city ?? ''),
      isDefault:   a.isDefault   ?? false,
    });
    setShowAddrForm(true);
  };
  const handleAddrSave = (e) => {
    e.preventDefault();
    setAddrFormError('');

    const phoneClean = addrForm.phone.replace(/[\s.\-]/g, '');

    if (!addrForm.fullName.trim())              return setAddrFormError('Vui lòng nhập họ và tên.');
    if (!phoneClean)                            return setAddrFormError('Vui lòng nhập số điện thoại.');
    if (!/^0[3-9]\d{8}$/.test(phoneClean))     return setAddrFormError('Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số).');
    if (!addrForm.city)                    return setAddrFormError('Vui lòng chọn tỉnh / thành phố.');
    if (!addrForm.addressLine.trim())      return setAddrFormError('Vui lòng nhập số nhà, tên đường.');

    setSaveConfirm({ type: 'addrSave', payload: { ...addrForm, phone: phoneClean } });
  };
  const doAddrSave = async (saveData) => {
    setSaveConfirm(null);
    setAddrSaving(true);
    try {
      if (editingAddr) {
        await addressAPI.update(editingAddr, saveData);
        notify('Đã cập nhật địa chỉ thành công!');
      } else {
        await addressAPI.create(saveData);
        notify('Đã thêm địa chỉ mới!');
      }
      closeAddrForm();
      fetchAddresses();
    } catch (err) {
      setAddrFormError(err.message || 'Lưu địa chỉ thất bại. Vui lòng thử lại.');
    } finally {
      setAddrSaving(false);
    }
  };
  const handleAddrDelete = (id) => {
    const isDefault = addresses.find(a => (a.addressId ?? a.id) === id)?.isDefault ?? false;
    setDeleteAddrConfirm({ id, isDefault });
  };
  const doAddrDelete = async (id) => {
    try {
      await addressAPI.delete(id);
      notify('Đã xóa địa chỉ.');
      fetchAddresses();
    } catch (err) { notify(err.message || 'Xóa địa chỉ thất bại.', true); }
  };

  if (!isLoggedIn) return null;

  return (
    <main className="container account-page">
      <div className="account-layout">
        {/* ── Sidebar ── */}
        <aside className="account-sidebar">
          {/* Avatar box — gradient tối */}
          <div className="account-avatar-box">
            <div className="account-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
            <span className="account-member-badge">⭐ Thành viên</span>
          </div>
          {/* Nav tabs */}
          <nav className="account-nav">
            {TABS.map(t => (
              <button key={t.id}
                className={`account-nav-item ${tab === t.id ? 'active' : ''}`}
                onClick={() => { setTab(t.id); setSuccess(''); setError(''); }}>
                <span className="anav-icon">{t.icon}</span>
                <span className="anav-label">{t.label}</span>
                <ChevronRight size={14} className="anav-arrow" />
              </button>
            ))}
          </nav>
          <div className="account-sidebar-footer">
            <button className="account-logout-btn" onClick={() => { logout(); navigate('/'); }}>
              <LogOut size={16}/> Đăng xuất
            </button>
          </div>
        </aside>

        {/* ── Nội dung ── */}
        <div className="account-content">
          {(success || error) && (
            <div className={`account-alert ${error ? 'alert-error' : 'alert-success'}`}>
              {error ? error : <><CheckCircle size={16} /> {success}</>}
            </div>
          )}

          {/* ── Tab: Thông tin tài khoản ── */}
          {tab === 'profile' && (
            <div className="account-card account-tab-panel">
              <h2>Thông tin tài khoản</h2>

              {/* Profile summary banner */}
              <div className="profile-summary">
                <div className="ps-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
                <div className="ps-info">
                  <div className="ps-name">{user?.name || 'Người dùng'}</div>
                  <div className="ps-email"><Mail size={12}/> {user?.email}</div>
                  <div className="ps-chips">
                    <span className="ps-chip ps-chip-member"><Award size={11}/> Thành viên BếpGas</span>
                    {(user?.emailVerified ?? user?.verified ?? user?.enabled) && (
                      <span className="ps-chip ps-chip-verify"><Shield size={11}/> Tài khoản đã xác minh</span>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="account-form profile-form">
                <div className="profile-form-grid">
                  <div className="form-group">
                    <label>Họ và tên</label>
                    <div className="input-wrap"><User size={17} className="input-icon"/>
                      <input type="text" value={profile.fullName} onChange={e=>setProfile({...profile,fullName:e.target.value})} placeholder="Nguyễn Văn A"/>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <div className="input-wrap"><Phone size={17} className="input-icon"/>
                      <input type="tel" value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})} placeholder="0912 345 678"/>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <div className="input-wrap"><Mail size={17} className="input-icon"/>
                    <input type="email" value={user?.email||''} disabled className="input-disabled"/>
                  </div>
                  <span className="field-hint">Email dùng để đăng nhập, không thể thay đổi</span>
                </div>
                <div className="profile-form-footer">
                  <button type="submit" className="btn btn-primary profile-save-btn" disabled={saving}>
                    {saving
                      ? <><Loader size={16} className="spin"/> Đang lưu...</>
                      : <><Save size={16}/> Lưu thay đổi</>}
                  </button>
                  {success && <span className="profile-save-ok"><CheckCircle size={15}/> {success}</span>}
                  {error && !saveConfirm && <span className="profile-save-err"><AlertCircle size={15}/> {error}</span>}
                </div>
              </form>
            </div>
          )}

          {/* ── Tab: Địa chỉ ── */}
          {tab === 'addresses' && (
            <div className="account-card account-tab-panel">
              <div className="addr-tab-header">
                <h2>Địa chỉ của tôi</h2>
                {!showAddrForm && (
                  <button className="btn btn-primary addr-add-btn" onClick={openAddrAdd}>
                    <Plus size={15}/> Thêm địa chỉ
                  </button>
                )}
              </div>
              {/* Hint đồng bộ checkout */}
              <div className="addr-sync-hint">
                <Truck size={13}/> Địa chỉ <strong>mặc định</strong> sẽ tự động điền khi bạn đặt hàng tại trang Thanh toán
              </div>

              {showAddrForm && (
                <form onSubmit={handleAddrSave} className="addr-form-box">
                  <div className="addr-form-title">
                    {editingAddr ? <><Edit2 size={15}/> Sửa địa chỉ</> : <><Plus size={15}/> Địa chỉ mới</>}
                  </div>

                  {/* ── Section 1: Thông tin người nhận ── */}
                  <div className="addr-form-section">
                    <div className="addr-form-section-hd"><User size={13}/> Thông tin người nhận</div>
                    <div className="form-group">
                      <label>Họ và tên <span className="required">*</span></label>
                      <input
                        value={addrForm.fullName}
                        onChange={e => setAddrForm({...addrForm, fullName: e.target.value})}
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                    <div className="form-group">
                      <label>Số điện thoại <span className="required">*</span></label>
                      <input
                        type="tel"
                        value={addrForm.phone}
                        onChange={e => setAddrForm({...addrForm, phone: e.target.value})}
                        placeholder="0912 345 678"
                        maxLength={11}
                      />
                    </div>
                  </div>

                  {/* ── Section 2: Địa chỉ nhận hàng ── */}
                  <div className="addr-form-section">
                    <div className="addr-form-section-hd"><MapPin size={13}/> Địa chỉ nhận hàng</div>
                    <div className="form-group">
                      <label>Tỉnh / Thành phố <span className="required">*</span></label>
                      <ProvinceCombobox
                        value={addrForm.city}
                        onChange={p => setAddrForm({...addrForm, city: p})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Phường / Xã / Thị trấn</label>
                      <WardCombobox
                        province={addrForm.city}
                        value={addrForm.ward}
                        onChange={v => setAddrForm({...addrForm, ward: v, district: ''})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Số nhà, tên đường <span className="required">*</span></label>
                      <input
                        value={addrForm.addressLine}
                        onChange={e => setAddrForm({...addrForm, addressLine: e.target.value})}
                        placeholder="VD: 123 Đường Nguyễn Huệ"
                      />
                    </div>
                  </div>

                  {/* ── Toggle mặc định ── */}
                  {/* Khoá toggle chỉ khi thêm địa chỉ ĐẦU TIÊN (bắt buộc là mặc định).
                      Các trường hợp khác đều cho phép tắt/bật tự do. */}
                  {(() => {
                    const isAddingFirst = !editingAddr && addresses.length === 0;
                    return (
                      <div className={`addr-form-default-row${isAddingFirst ? ' afdr-locked' : ''}`}>
                        <div className="afdr-info">
                          <span className="afdr-title">Địa chỉ mặc định</span>
                          <span className="afdr-sub">
                            {isAddingFirst
                              ? 'Bắt buộc với địa chỉ đầu tiên'
                              : 'Tự động điền khi đặt hàng'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`addr-toggle${addrForm.isDefault ? ' addr-toggle-on' : ''}`}
                          onClick={() => {
                            if (isAddingFirst) return;
                            setAddrForm({...addrForm, isDefault: !addrForm.isDefault});
                          }}
                          disabled={isAddingFirst}
                          aria-label="Đặt làm địa chỉ mặc định"
                        >
                          <span className="addr-toggle-thumb"/>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Lỗi inline — hiện ngay trong form */}
                  {addrFormError && (
                    <div className="addr-form-error">
                      <AlertCircle size={14} style={{flexShrink:0}}/>
                      <span>{addrFormError}</span>
                    </div>
                  )}

                  <div className="addr-form-actions">
                    <button type="button" className="btn btn-outline" onClick={closeAddrForm}>Hủy</button>
                    <button type="submit" className="btn btn-primary" disabled={addrSaving}>
                      {addrSaving ? <Loader size={15} className="spin"/> : <Save size={15}/>}
                      {' '}{editingAddr ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
                    </button>
                  </div>
                </form>
              )}

              {addrLoading ? (
                <div className="account-loading"><Loader size={28} className="spin"/></div>
              ) : addresses.length === 0 && !showAddrForm ? (
                <div className="account-empty addr-empty">
                  <div className="addr-empty-icon"><MapPin size={36} color="var(--primary)"/></div>
                  <p className="addr-empty-title">Chưa có địa chỉ nào</p>
                  <p className="addr-empty-sub">Thêm địa chỉ để đặt hàng nhanh hơn</p>
                  <button className="btn btn-primary" onClick={openAddrAdd}>
                    <Plus size={15}/> Thêm địa chỉ đầu tiên
                  </button>
                </div>
              ) : (
                <div className="addr-list">
                  {addresses.map(a => {
                    const aid = a.addressId ?? a.id;
                    const fullAddr = [a.addressLine, a.ward, a.district, a.city].filter(Boolean).join(', ');
                    return (
                      <div key={aid} className={`addr-card${a.isDefault ? ' addr-card-default' : ''}`}>
                        <div className="addr-card-icon">
                          {a.isDefault
                            ? <Home size={18} color="#16a34a"/>
                            : <MapPin size={18} color="#9ca3af"/>}
                        </div>
                        <div className="addr-card-body">
                          {/* Dòng 1: Tên | SĐT [Mặc định] — tất cả inline */}
                          <div className="addr-card-info-row">
                            <span className="addr-card-name">{a.fullName}</span>
                            <span className="addr-card-sep">|</span>
                            <span className="addr-card-phone">{a.phone}</span>
                            {a.isDefault && (
                              <span className="addr-default-badge">Mặc định</span>
                            )}
                          </div>
                          {/* Dòng 2: Địa chỉ đầy đủ */}
                          <div className="addr-card-address">{fullAddr}</div>
                        </div>
                        <div className="addr-card-actions">
                          <button className="addr-action-link" onClick={() => openAddrEdit(a)}>
                            Sửa
                          </button>
                          <button className="addr-action-link addr-action-del" onClick={() => handleAddrDelete(aid)}>
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Đổi mật khẩu ── */}
          {tab === 'password' && (
            <div className="account-card account-tab-panel">
              <h2>Đổi mật khẩu</h2>
              <form onSubmit={handlePasswordSave} className="account-form">
                {[{key:'old',label:'Mật khẩu hiện tại'},{key:'new',label:'Mật khẩu mới'},{key:'confirm',label:'Xác nhận mật khẩu mới'}].map(f=>(
                  <div className="form-group" key={f.key}>
                    <label>{f.label}</label>
                    <div className="input-wrap">
                      <Lock size={17} className="input-icon"/>
                      <input type={showPwd[f.key]?'text':'password'} value={pwd[f.key]} onChange={e=>setPwd({...pwd,[f.key]:e.target.value})} placeholder="••••••••"/>
                      <button type="button" className="pwd-toggle" onClick={()=>setShowPwd(p=>({...p,[f.key]:!p[f.key]}))}>
                        {showPwd[f.key]?<EyeOff size={17}/>:<Eye size={17}/>}
                      </button>
                    </div>
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?<Loader size={16} className="spin"/>:null} {saving?'Đang lưu...':'Đổi mật khẩu'}
                </button>
              </form>
            </div>
          )}

          {/* ── Tab: Đơn hàng (Shopee-style) ── */}
          {tab === 'orders' && (
            <div className="account-card account-tab-panel">
              <h2>Đơn hàng của tôi</h2>

              {/* Filter pills */}
              {orders.length > 0 && !ordersLoading && (
                <div className="order-filter-pills">
                  {[
                    { id: 'all',       label: 'Tất cả',      count: orders.length },
                    { id: 'pending',   label: 'Chờ xử lý',   count: orders.filter(o => o.status==='pending'||o.status==='confirmed').length },
                    { id: 'shipping',  label: 'Đang giao',   count: orders.filter(o => o.status==='shipping').length },
                    { id: 'delivered', label: 'Đã giao',     count: orders.filter(o => o.status==='delivered').length },
                    { id: 'return',    label: 'Hoàn trả',    count: orders.filter(o => o.status==='return_pending'||o.status==='returned').length },
                    { id: 'cancelled', label: 'Đã hủy',      count: orders.filter(o => o.status==='cancelled').length },
                  ].map(f => f.count > 0 || f.id === 'all' ? (
                    <button key={f.id}
                      className={`ofp-btn ${orderFilter === f.id ? 'ofp-active' : ''}`}
                      onClick={() => setOrderFilter(f.id)}>
                      {f.label}
                      {f.id !== 'all' && f.count > 0 && <span className="ofp-count">{f.count}</span>}
                    </button>
                  ) : null)}
                </div>
              )}

              {ordersLoading ? (
                <div className="account-loading"><Loader size={32} className="spin"/></div>
              ) : ordersError ? (
                <div className="account-alert alert-error">{ordersError}</div>
              ) : orders.length === 0 ? (
                <div className="account-empty">
                  <Package size={56} color="#d1d5db"/>
                  <p>Bạn chưa có đơn hàng nào</p>
                  <Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>
                </div>
              ) : (() => {
                const filtered = orders.filter(o =>
                  orderFilter === 'all' ||
                  (orderFilter === 'pending'   && (o.status==='pending'||o.status==='confirmed')) ||
                  (orderFilter === 'return'    && (o.status==='return_pending'||o.status==='returned')) ||
                  (orderFilter === 'cancelled' && o.status==='cancelled') ||
                  o.status === orderFilter
                );
                const EMPTY_MSG = {
                  pending:   { icon: <Clock size={40} color="#d1d5db"/>,   text: 'Không có đơn nào đang chờ xử lý' },
                  shipping:  { icon: <Truck size={40} color="#d1d5db"/>,   text: 'Không có đơn nào đang được giao' },
                  delivered: { icon: <CheckCircle size={40} color="#d1d5db"/>, text: 'Bạn chưa có đơn nào đã giao' },
                  return:    { icon: <RotateCcw size={40} color="#d1d5db"/>, text: 'Không có yêu cầu hoàn trả nào' },
                  cancelled: { icon: <XCircle size={40} color="#d1d5db"/>, text: 'Không có đơn nào đã hủy' },
                };
                const emptyInfo = EMPTY_MSG[orderFilter] ?? { icon: <Package size={40} color="#d1d5db"/>, text: 'Không có đơn hàng nào trong mục này' };
                return filtered.length === 0 ? (
                  <div className="account-empty" style={{padding:'2rem 0'}}>
                    {emptyInfo.icon}
                    <p>{emptyInfo.text}</p>
                    <Link to="/products" className="btn btn-outline" style={{marginTop:'0.25rem'}}>Mua sắm ngay</Link>
                  </div>
                ) : (
                  <>
                    <div className="order-list">
                      {filtered.map(order => (
                        <OrderCard
                          key={order.orderId??order.id}
                          order={order}
                          onCancel={handleCancelOrder}
                          onRequestReturn={handleRequestReturn}
                          onRetryPayment={handleRetryVNPay}
                          onBuyAgain={handleBuyAgain}
                          onViewDetail={(order) => navigate('/account/orders/' + (order.orderId ?? order.id))}
                          cancelingId={cancelingId}
                          requestingReturnId={requestingReturnId}
                          retryingPaymentId={retryingPaymentId}
                        />
                      ))}
                    </div>
                    {/* Fix #1: nút Xem thêm đơn hàng */}
                    {ordersHasMore && (
                      <div style={{ textAlign:'center', marginTop:'1rem' }}>
                        <button
                          className="btn btn-outline"
                          disabled={ordersLoadingMore}
                          onClick={() => loadOrders(ordersPage + 1, true)}
                        >
                          {ordersLoadingMore
                            ? <><Loader size={14} className="spin"/> Đang tải...</>
                            : 'Xem thêm đơn hàng'}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Form hoàn trả ── */}
      {confirm?.type === 'requestReturn' && (() => {
        // Tổng tiền hoàn realtime — tính lại mỗi khi tick/đổi số lượng sản phẩm.
        const refundTotal = Object.entries(confirm.selected ?? {}).reduce((sum, [iid, qty]) => {
          const item = (confirm.items ?? []).find(i => i.orderItemId === Number(iid));
          return sum + (item ? item.unitPrice * qty : 0);
        }, 0);
        return (
        <div className="admin-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="admin-modal admin-modal-sm return-request-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Yêu cầu hoàn trả đơn hàng #{confirm.orderCode ?? confirm.id}</h2>
              <button onClick={() => setConfirm(null)}><X size={20}/></button>
            </div>
            <div className="admin-modal-body">
              <div>
                {/* Chọn sản phẩm cần hoàn trả + số lượng */}
                <div className="rm-field">
                  <label className="rm-label">
                    Chọn sản phẩm hoàn trả <span className="rm-required">*</span>
                  </label>
                  <div className="rm-return-items">
                    {(confirm.items ?? []).map(item => {
                      const iid = item.orderItemId;
                      const maxQty = item.quantity - (item.returnedQty ?? 0);
                      const sel = confirm.selected?.[iid];
                      const checked = sel != null;
                      if (maxQty <= 0) {
                        return (
                          <div key={iid} className="rm-return-item rm-return-item-disabled">
                            <div className="rm-return-item-main">
                              {item.productImage
                                ? <img src={item.productImage} alt={item.productName} className="rm-return-item-thumb"/>
                                : <div className="rm-return-item-thumb rm-return-item-thumb-empty"/>}
                              <span className="rm-return-item-name">{item.productName}</span>
                            </div>
                            <span className="rm-return-item-note">Đã yêu cầu hoàn trả hết</span>
                          </div>
                        );
                      }
                      return (
                        <div key={iid} className="rm-return-item">
                          <label className="rm-return-item-checkbox">
                            <input type="checkbox" checked={checked}
                              onChange={e => setConfirm(prev => {
                                const next = { ...(prev.selected ?? {}) };
                                if (e.target.checked) next[iid] = 1; else delete next[iid];
                                return { ...prev, selected: next };
                              })}/>
                            {item.productImage
                              ? <img src={item.productImage} alt={item.productName} className="rm-return-item-thumb"/>
                              : <div className="rm-return-item-thumb rm-return-item-thumb-empty"/>}
                            <span className="rm-return-item-info">
                              <span className="rm-return-item-name">{item.productName}</span>
                              <span className="rm-return-item-sub">{fmt(item.unitPrice)} · đã mua {item.quantity} / còn được trả {maxQty}</span>
                            </span>
                          </label>
                          {checked && (
                            <div className="rm-return-item-qty">
                              <button type="button" disabled={sel <= 1}
                                onClick={() => setConfirm(prev => ({ ...prev, selected: { ...prev.selected, [iid]: Math.max(1, sel - 1) } }))}>−</button>
                              <span>{sel}</span>
                              <button type="button" disabled={sel >= maxQty}
                                onClick={() => setConfirm(prev => ({ ...prev, selected: { ...prev.selected, [iid]: Math.min(maxQty, sel + 1) } }))}>+</button>
                              <span className="rm-return-item-max">/ tối đa {maxQty}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lý do hoàn trả */}
                <div className="rm-field">
                  <label className="rm-label">
                    Lý do hoàn trả <span className="rm-required">*</span>
                  </label>
                  <textarea
                    className={`rm-textarea${confirm.returnReasonTouched && !confirm.reason?.trim() ? ' is-error' : ''}`}
                    value={confirm.reason ?? ''}
                    onChange={e => setConfirm({ ...confirm, reason: e.target.value, returnReasonTouched: true })}
                    onBlur={() => setConfirm({ ...confirm, returnReasonTouched: true })}
                    placeholder="Mô tả lý do hoàn trả của bạn..."
                    rows={4}
                  />
                  <div className="rm-chips-wrap">
                    <span className="rm-chip-hint">Gợi ý:</span>
                    {RETURN_SUGGESTIONS.map(s => (
                      <button key={s} type="button"
                        className={`rm-chip${confirm.reason === s ? ' rm-chip-active' : ''}`}
                        onClick={() => setConfirm({ ...confirm, reason: s, returnReasonTouched: true })}
                      >{s}</button>
                    ))}
                  </div>
                </div>

                {/* Ảnh minh chứng */}
                <div className="rm-field">
                  <label className="rm-label">
                    Ảnh minh chứng
                    <span className="rm-label-sub">(tuỳ chọn, tối đa 3 ảnh)</span>
                  </label>
                  <div className="rm-img-row">
                    {(confirm.returnImgs ?? []).map((url, idx) => (
                      <div key={url} className="rm-img-thumb">
                        <img src={url} alt={`ảnh ${idx + 1}`}/>
                        <button className="rm-img-del"
                          onClick={() => setConfirm(prev => ({
                            ...prev, returnImgs: (prev.returnImgs ?? []).filter((_, i) => i !== idx)
                          }))}>
                          <X size={11}/>
                        </button>
                      </div>
                    ))}
                    {(confirm.returnImgs ?? []).length < 3 && (
                      <div
                        className={`rm-img-add${returnImgDragOver ? ' rm-img-add-drag' : ''}`}
                        style={{ cursor: uploadingReturnImg ? 'wait' : 'pointer' }}
                        onClick={() => !uploadingReturnImg && returnImgRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setReturnImgDragOver(true); }}
                        onDragLeave={() => setReturnImgDragOver(false)}
                        onDrop={async e => { e.preventDefault(); setReturnImgDragOver(false); uploadReturnImages(e.dataTransfer.files); }}
                      >
                        {uploadingReturnImg
                          ? <Loader size={20} className="spin"/>
                          : <><Upload size={20}/><span>Thêm ảnh<br/>({(confirm.returnImgs ?? []).length}/3)</span></>}
                      </div>
                    )}
                  </div>
                  <input ref={returnImgRef} type="file" accept="image/*" hidden multiple disabled={uploadingReturnImg}
                    onChange={async e => { await uploadReturnImages(e.target.files); e.target.value = ''; }}/>
                </div>

                <div className="rm-policy">
                  <AlertCircle size={15} className="rm-policy-icon"/>
                  <span>
                    <strong>Chính sách đổi trả:</strong> Áp dụng trong vòng <strong>7 ngày</strong> kể từ khi nhận hàng.
                    {' '}Yêu cầu sẽ được xét duyệt và liên hệ lại trong <strong>1–2 ngày làm việc</strong>.
                  </span>
                </div>
              </div>
            </div>
            {/* Thanh tổng tiền hoàn dính đáy — cập nhật realtime theo sản phẩm/số lượng đã chọn */}
            <div className="rm-refund-total-bar">
              <span>Tổng tiền hoàn</span>
              <strong>{fmt(refundTotal)}</strong>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setConfirm(null)}>Huỷ bỏ</button>
              {(() => {
                const { reason, selected } = confirm;
                const hasSelection = Object.keys(selected ?? {}).length > 0;
                const isOk = !!(reason?.trim()) && hasSelection && !uploadingReturnImg;
                return (
                  <button
                    className="admin-btn-warning"
                    disabled={!isOk}
                    style={{ opacity: isOk ? 1 : 0.45, cursor: isOk ? 'pointer' : 'not-allowed' }}
                    onClick={() => {
                      const { id, reason: r, returnImgs: imgs = [], selected: sel = {} } = confirm;
                      const items = Object.entries(sel).map(([orderItemId, qty]) => ({ orderItemId: Number(orderItemId), qty }));
                      setConfirm(null);
                      doRequestReturn(id, r?.trim() || '', imgs, items);
                    }}
                  >
                    <RotateCcw size={14}/> Gửi yêu cầu hoàn trả
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Xác nhận hủy đơn ── */}
      <ConfirmModal
        open={!!cancelConfirm}
        danger={true}
        title="Hủy đơn hàng?"
        message={cancelConfirm?.paymentStatus === 'paid'
          ? `Bạn có chắc muốn hủy đơn hàng <strong>#${cancelConfirm?.orderCode ?? cancelConfirm?.id}</strong>? Đơn đã thanh toán qua VNPay — <strong>shop sẽ hoàn tiền lại cho bạn trong 3–5 ngày làm việc</strong>. Hành động này <strong>không thể hoàn tác</strong>.`
          : `Bạn có chắc muốn hủy đơn hàng <strong>#${cancelConfirm?.orderCode ?? cancelConfirm?.id}</strong>? Hành động này <strong>không thể hoàn tác</strong>.`}
        confirmLabel="Hủy đơn"
        onConfirm={() => { const { id } = cancelConfirm; setCancelConfirm(null); doCancelOrder(id, ''); }}
        onCancel={() => setCancelConfirm(null)}
        loading={cancelingId === cancelConfirm?.id}
      />

      {/* ── Xác nhận hoàn trả (bước 1) → mở form ── */}
      <ConfirmModal
        open={!!returnFirstConfirm}
        danger={false}
        icon={RotateCcw}
        title="Yêu cầu hoàn trả?"
        message={`Bạn có chắc muốn yêu cầu hoàn trả đơn hàng <strong>#${returnFirstConfirm?.orderCode ?? returnFirstConfirm?.id}</strong>? Bước tiếp theo bạn sẽ chọn sản phẩm, lý do và ảnh minh chứng.`}
        confirmLabel="Tiếp tục"
        onConfirm={() => {
          const { id, orderCode, items } = returnFirstConfirm;
          setReturnFirstConfirm(null);
          setConfirm({ type: 'requestReturn', id, orderCode, items, selected: {}, reason: '', returnImgs: [], returnReasonTouched: false });
        }}
        onCancel={() => setReturnFirstConfirm(null)}
      />

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={
          saveConfirm?.type === 'profile'   ? 'Lưu thay đổi thông tin?' :
          saveConfirm?.type === 'password'  ? 'Xác nhận đổi mật khẩu?' :
          editingAddr                        ? 'Cập nhật địa chỉ?'      : 'Thêm địa chỉ mới?'
        }
        message={
          saveConfirm?.type === 'profile'   ? 'Thông tin tài khoản sẽ được cập nhật.' :
          saveConfirm?.type === 'password'  ? 'Mật khẩu của bạn sẽ được thay đổi ngay lập tức.' :
          editingAddr                        ? 'Thông tin địa chỉ sẽ được cập nhật.'  : 'Địa chỉ mới sẽ được lưu vào tài khoản của bạn.'
        }
        confirmLabel={
          saveConfirm?.type === 'profile'   ? 'Lưu thay đổi'  :
          saveConfirm?.type === 'password'  ? 'Đổi mật khẩu'  :
          editingAddr                        ? 'Cập nhật'       : 'Thêm địa chỉ'
        }
        onConfirm={() => {
          if (saveConfirm.type === 'profile')  doProfileSave();
          else if (saveConfirm.type === 'password') doPasswordSave();
          else if (saveConfirm.type === 'addrSave') doAddrSave(saveConfirm.payload);
        }}
        onCancel={() => setSaveConfirm(null)}
        loading={saving || addrSaving}
      />

      <ConfirmModal
        open={!!deleteAddrConfirm}
        title="Xóa địa chỉ này?"
        message={
          deleteAddrConfirm?.isDefault && addresses.length > 1
            ? 'Địa chỉ này sẽ bị xóa vĩnh viễn.<br/><span style="display:inline-block;margin-top:0.4rem;padding:0.4rem 0.65rem;background:#fef3c7;border-radius:6px;font-size:0.83rem;color:#92400e;border:1px solid #fde68a"> Đây là địa chỉ mặc định. Sau khi xóa, địa chỉ tiếp theo sẽ được tự động đặt làm mặc định.</span>'
            : 'Địa chỉ này sẽ bị xóa vĩnh viễn và <strong>không thể hoàn tác</strong>.'
        }
        confirmLabel="Xóa địa chỉ"
        onConfirm={() => { const { id } = deleteAddrConfirm; setDeleteAddrConfirm(null); doAddrDelete(id); }}
        onCancel={() => setDeleteAddrConfirm(null)}
      />

      {/* Chi tiết đơn hàng → điều hướng sang /account/orders/:id */}
    </main>
  );
};

export default Account;
