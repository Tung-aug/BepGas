// Trang quản lý đơn hàng cho Admin và Staff.
// Lọc theo trạng thái đơn, trạng thái thanh toán, khoảng thời gian, và từ khoá tìm kiếm.
// Các hành động: cập nhật trạng thái, xác nhận thanh toán, duyệt/từ chối hoàn trả, upload biên lai, in hóa đơn.
// In hóa đơn mở /admin/orders/:id/invoice trong tab mới để tránh mất trạng thái trang hiện tại.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Loader, Trash2, X, Eye, CheckCircle, Package,
  MapPin, Phone, User, RotateCcw, AlertTriangle,
  Clock, Truck, XCircle, Lock, LayoutList, Upload, AlertCircle, Printer, Save, ImageIcon, ShieldCheck,
} from 'lucide-react';
import { getWarrantyInfo } from '../../utils/warranty';
import { adminAPI } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorState from '../../components/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../utils/toast';
import { fmt } from '../../utils/formatters';
import {
  ORDER_STATUS_CONFIG as statusConfig,
  NEXT_STATUS       as nextStatusOptions,
  PAY_METHOD_LABEL  as paymentLabels,
  PAY_STATUS_CONFIG as payStatusConfig,
} from '../../constants/adminConstants';

const STATUS_ICONS = {
  pending:         <Clock size={17}/>,
  confirmed:       <CheckCircle size={17}/>,
  shipping:        <Truck size={17}/>,
  delivered:       <Package size={17}/>,
  delivery_failed: <AlertCircle size={17}/>,
  cancelled:       <XCircle size={17}/>,
  return_pending:  <RotateCcw size={17}/>,
  returned:        <RotateCcw size={17}/>,
};
const STATUS_BADGE_ICONS = {
  pending:         <Clock size={13}/>,
  confirmed:       <CheckCircle size={13}/>,
  shipping:        <Truck size={13}/>,
  delivered:       <Package size={13}/>,
  delivery_failed: <AlertCircle size={13}/>,
  cancelled:       <XCircle size={13}/>,
  return_pending:  <RotateCcw size={13}/>,
  returned:        <RotateCcw size={13}/>,
};

/* ── Date helpers — sử dụng giờ địa phương, không phải UTC ── */
const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr      = () => toLocalDateStr(new Date());
const yesterdayStr  = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalDateStr(d); };
const nDaysAgoStr   = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toLocalDateStr(d); };
const monthStartStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

// parseReturnRequest/parseReturnDecision đọc JSON lưu trong statusHistory.note (hoàn trả từng sản phẩm).
// Trả null nếu không phải JSON đúng định dạng — dữ liệu cũ trước khi có tính năng này hiển thị fallback.
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

// hasApprovedUnrefundedReturn: true nếu có yêu cầu hoàn trả đã duyệt mà CHƯA hoàn tiền — dùng để
// cảnh báo trên danh sách vì order.status có thể đã quay về delivered/returned ngay sau khi duyệt
// (xem OrderService.applyOrderStatusFromReturnState ở backend), khiến đơn trông như bình thường.
// Quyết định MỚI NHẤT theo reqCode thắng (giống logic ReturnRequestHelper.decisionsByReqCode).
const hasApprovedUnrefundedReturn = (statusHistory) => {
  const latestByReqCode = {};
  for (const h of statusHistory ?? []) {
    const d = parseReturnDecision(h.note);
    if (d?.reqCode) latestByReqCode[d.reqCode] = d;
  }
  return Object.values(latestByReqCode).some(d => d.approved && !d.refunded);
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

const AdminOrders = () => {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  // Đọc filter từ URL query params (navigate từ Dashboard truyền fromDate/toDate/paymentMethod)
  const [statusFilter,        setStatus]        = useState(searchParams.get('status')        ?? 'all');
  const [paymentStatusFilter, setPaymentStatus] = useState(searchParams.get('paymentStatus') ?? 'all');


  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [updating,  setUpdating]  = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [fromDate,  setFromDate]  = useState(searchParams.get('fromDate')      ?? '');
  const [toDate,    setToDate]    = useState(searchParams.get('toDate')        ?? '');
  const [payFilter, setPayFilter] = useState(searchParams.get('paymentMethod') ?? 'all');

  /* ── Doanh thu thực thu hiện ở header — lấy từ CÙNG endpoint /admin/dashboard mà Dashboard
   * dùng (theo đúng khoảng fromDate/toDate đang lọc), không tự tính lại từ danh sách đơn đang
   * hiện trên trang. Trước đây trang này tự cộng tổng status='delivered'+paymentStatus='paid'
   * từ orders đã fetch (tối đa 500 đơn, theo bất kỳ filter đang chọn) — dễ lệch với Dashboard vì
   * khác hẳn quy tắc tính (Dashboard không yêu cầu status=delivered, có trừ hoàn tiền 1 phần). */
  const [revenueStats, setRevenueStats] = useState(null);

  /* ── Chi tiết đơn hàng ── */
  const [detailOrder,       setDetailOrder]       = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  /* ── Confirm modal: hủy đơn bởi admin (có lý do) ── */
  const [cancelConfirm, setCancelConfirm] = useState(null); // { orderId, reason, customReason }

  /* ── Xử lý hoàn trả trong modal chi tiết ── */
  const [refundAction,    setRefundAction]    = useState(null); // null | { reqCode, type: 'approve'|'reject' }
  const [rejectReason,    setRejectReason]    = useState('');
  const [restoreStock,    setRestoreStock]    = useState(false);
  const [markRefunded,    setMarkRefunded]    = useState(false);
  const [approvingReturn, setApprovingReturn] = useState(false);
  const [rejectingReturn, setRejectingReturn] = useState(false);

  /* ── Xác nhận hoàn tiền đơn bị hủy (VNPay) ── */
  const [confirmingCancelRefund, setConfirmingCancelRefund] = useState(false);

  /* ── Xác nhận hoàn tiền cho yêu cầu hoàn trả đã duyệt trước đó (chưa hoàn tiền lúc duyệt) ── */
  const [confirmingReturnRefund, setConfirmingReturnRefund] = useState(null); // reqCode đang xử lý, null nếu không

  /* ── Upload biên lai hoàn tiền ── */
  const [uploadingRefundReceipt, setUploadingRefundReceipt] = useState(false);
  const [deletingRefundReceipt,  setDeletingRefundReceipt]  = useState(false);
  const [refundReceiptPreview,   setRefundReceiptPreview]   = useState(null); // { file, url }
  const [refundDragging,         setRefundDragging]         = useState(false);

  

  const PAGE_SIZE = 500;

  // true sau lần fetch đầu tiên (thành công hay lỗi đều tính) — dùng để chỉ hiện spinner toàn
  // trang ở lần tải đầu, các lần fetch lại do đổi filter sau đó chỉ hiện spinner trong bảng,
  // không làm mất luôn cả thanh filter/quick-tab đang hiện trên trang.
  const hasFetchedOnce = useRef(false);

  const fetchOrders = useCallback(async (
    status = '', payStatus = '', payMethod = '', from = '', to = ''
  ) => {
    try {
      setLoading(true);
      setError('');
      const res  = await adminAPI.getOrders(0, PAGE_SIZE, status, from, to, payStatus, payMethod);
      const list = res?.data?.content ?? res?.content ?? res?.data ?? [];
      setOrders(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      hasFetchedOnce.current = true;
    }
  }, []);

  // Sync state từ URL params khi Dashboard navigate tới với params mới — chỉ đồng bộ state,
  // KHÔNG tự fetch ở đây. Việc fetch do effect riêng bên dưới đảm nhiệm, để mọi nguồn thay đổi
  // filter (từ URL hay từ các <select>/quick-tab ngay trên trang) đều đi qua đúng 1 đường fetch
  // backend duy nhất — tránh tình trạng trang tự lọc thêm lần 2 ở client lệch với điều kiện
  // dashboard đã gửi sang (VD: dashboard báo 2 đơn nhưng trang lại lọc dư ra còn 0).
  useEffect(() => {
    const s  = searchParams.get('status')        ?? '';
    const ps = searchParams.get('paymentStatus') ?? '';
    const pm = searchParams.get('paymentMethod') ?? '';
    const fd = searchParams.get('fromDate')      ?? '';
    const td = searchParams.get('toDate')        ?? '';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(s || 'all');
    setPaymentStatus(ps || 'all');
    setFromDate(fd);
    setToDate(td);
    setPayFilter(pm || 'all');
  }, [searchParams]);

  // Nguồn fetch DUY NHẤT — chạy lại mỗi khi bất kỳ điều kiện lọc nào đổi, bất kể đổi từ URL
  // (Dashboard điều hướng tới) hay từ các <select>/quick-tab/ngày trên chính trang này. Đảm bảo
  // danh sách hiển thị luôn khớp đúng với điều kiện đang chọn, không còn lọc thêm lần 2 ở client.
  useEffect(() => {
    fetchOrders(
      statusFilter        === 'all' ? '' : statusFilter,
      paymentStatusFilter === 'all' ? '' : paymentStatusFilter,
      payFilter            === 'all' ? '' : payFilter,
      fromDate, toDate,
    );
  }, [statusFilter, paymentStatusFilter, payFilter, fromDate, toDate, fetchOrders]);

  // Doanh thu thực thu header — chỉ phụ thuộc khoảng ngày (giống hệt Dashboard, không phụ thuộc
  // status/paymentMethod/paymentStatus đang lọc trên bảng), để luôn khớp con số Dashboard hiển thị
  // cho cùng khoảng thời gian. Staff không xem doanh thu nên bỏ qua, không cần gọi API.
  useEffect(() => {
    if (!isAdmin) return;
    adminAPI.getStats(fromDate, toDate)
      .then(res => setRevenueStats(res?.data ?? res))
      .catch(() => setRevenueStats(null));
  }, [isAdmin, fromDate, toDate]);

  /* ── Xem chi tiết ── */
  const handleViewDetail = async (id) => {
    setDetailOrder({ _loading: true, id });
    setRefundAction(null);
    setRestoreStock(false);
    setMarkRefunded(false);
    setRefundReceiptPreview(null);
    setRefundDragging(false);
    try {
      const res = await adminAPI.getOrderDetail(id);
      setDetailOrder(res?.data ?? res);
    } catch (err) {
      toast.error('Lỗi tải chi tiết: ' + err.message);
      setDetailOrder(null);
    }
  };

  // Mở chi tiết đơn khi navigate từ Dashboard với ?orderId=xxx
  // Đặt sau handleViewDetail để tránh "Cannot access before declaration"
  useEffect(() => {
    const targetId = searchParams.get('orderId');
    if (!targetId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleViewDetail(Number(targetId));
  }, [searchParams]);

  /* ── Xác nhận thu tiền COD ── */
  const handleConfirmPayment = async () => {
    if (!detailOrder) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    try {
      setConfirmingPayment(true);
      await adminAPI.confirmPayment(id);
      setOrders(prev => prev.map(o => (o.orderId ?? o.id) === id ? { ...o, paymentStatus: 'paid' } : o));
      setDetailOrder(prev => ({ ...prev, paymentStatus: 'paid' }));
      toast.success('Đã xác nhận thu tiền COD thành công!');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setConfirmingPayment(false);
    }
  };

  /* ── Chấp nhận 1 yêu cầu hoàn trả (theo reqCode) ── */
  const handleApproveReturn = async () => {
    if (!detailOrder || !refundAction) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    const { reqCode } = refundAction;
    try {
      setApprovingReturn(true);
      const res = await adminAPI.approveReturn(id, reqCode, restoreStock, markRefunded);
      const updated = res?.data ?? res;
      setOrders(prev => prev.map(o => (o.orderId ?? o.id) === id ? { ...o, ...updated } : o));
      setDetailOrder(prev => ({ ...prev, ...updated }));
      setRefundAction(null);
      toast.success('Đã chấp nhận hoàn trả'
        + (restoreStock ? ' và hoàn kho' : '')
        + (markRefunded ? ' và đánh dấu đã hoàn tiền' : '') + '!');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setApprovingReturn(false);
    }
  };

  /* ── Từ chối 1 yêu cầu hoàn trả (theo reqCode) ── */
  const handleRejectReturn = async () => {
    if (!detailOrder || !refundAction) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    const { reqCode } = refundAction;
    try {
      setRejectingReturn(true);
      const res = await adminAPI.rejectReturn(id, reqCode, rejectReason || undefined);
      const updated = res?.data ?? res;
      setOrders(prev => prev.map(o => (o.orderId ?? o.id) === id ? { ...o, ...updated } : o));
      setDetailOrder(prev => ({ ...prev, ...updated }));
      setRefundAction(null);
      setRejectReason('');
      toast.success('Đã từ chối yêu cầu hoàn trả.');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setRejectingReturn(false);
    }
  };

  /* ── Xác nhận đã chuyển khoản hoàn tiền cho đơn hủy VNPay ── */
  const handleConfirmCancelRefund = async () => {
    if (!detailOrder) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    try {
      setConfirmingCancelRefund(true);
      await adminAPI.confirmCancelRefund(id);
      setOrders(prev => prev.map(o =>
        (o.orderId ?? o.id) === id ? { ...o, paymentStatus: 'refunded' } : o
      ));
      setDetailOrder(prev => ({ ...prev, paymentStatus: 'refunded' }));
      toast.success('Đã xác nhận hoàn tiền thành công!');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setConfirmingCancelRefund(false);
    }
  };

  /* ── Xác nhận hoàn tiền cho yêu cầu hoàn trả đã duyệt trước đó (lúc duyệt chưa có biên lai) ── */
  const handleConfirmReturnRefund = async (reqCode) => {
    if (!detailOrder) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    try {
      setConfirmingReturnRefund(reqCode);
      const res = await adminAPI.confirmReturnRefund(id, reqCode);
      const updated = res?.data ?? res;
      setOrders(prev => prev.map(o => (o.orderId ?? o.id) === id ? { ...o, ...updated } : o));
      setDetailOrder(prev => ({ ...prev, ...updated }));
      toast.success('Đã xác nhận hoàn tiền thành công!');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setConfirmingReturnRefund(null);
    }
  };

  /* ── Upload biên lai chuyển khoản hoàn tiền ──
   * Giới hạn 8MB — khớp với spring.servlet.multipart.max-file-size=10MB ở backend, để chừa
   * khoảng an toàn cho phần multipart overhead. Ảnh chụp trực tiếp từ điện thoại thường 8-15MB,
   * nếu vượt giới hạn server sẽ bị từ chối ở tầng thấp (không trả message cụ thể) — chặn từ FE
   * để báo lỗi rõ ràng ngay, tránh hiện toast lỗi chung khó hiểu. */
  const REFUND_RECEIPT_MAX_SIZE = 8 * 1024 * 1024;
  const pickRefundFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.warn('Vui lòng chọn đúng định dạng ảnh.');
      return;
    }
    if (file.size > REFUND_RECEIPT_MAX_SIZE) {
      toast.warn('Ảnh quá lớn (tối đa 8MB). Vui lòng chọn ảnh nhỏ hơn hoặc chụp lại với độ phân giải thấp hơn.');
      return;
    }
    const url = URL.createObjectURL(file);
    setRefundReceiptPreview({ file, url });
  };

  const handleUploadRefundReceipt = async () => {
    if (!detailOrder || !refundReceiptPreview) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    try {
      setUploadingRefundReceipt(true);
      const res = await adminAPI.uploadRefundReceipt(id, refundReceiptPreview.file);
      const url = res?.data?.refundReceiptUrl ?? res?.refundReceiptUrl;
      URL.revokeObjectURL(refundReceiptPreview.url);
      setRefundReceiptPreview(null);
      setDetailOrder(prev => ({ ...prev, refundReceiptUrl: url }));
      setOrders(prev => prev.map(o => (o.orderId ?? o.id) === id ? { ...o, refundReceiptUrl: url } : o));
      toast.success('Đã lưu biên lai hoàn tiền!');
    } catch (err) {
      toast.error('Lỗi upload biên lai: ' + err.message);
    } finally {
      setUploadingRefundReceipt(false);
    }
  };

  const handleDeleteRefundReceipt = async () => {
    if (!detailOrder) return;
    const id = detailOrder.orderId ?? detailOrder.id;
    try {
      setDeletingRefundReceipt(true);
      await adminAPI.deleteRefundReceipt(id);
      setDetailOrder(prev => ({ ...prev, refundReceiptUrl: null }));
      setOrders(prev => prev.map(o => (o.orderId ?? o.id) === id ? { ...o, refundReceiptUrl: null } : o));
      toast.success('Đã xóa biên lai!');
    } catch (err) {
      toast.error('Lỗi xóa biên lai: ' + err.message);
    } finally {
      setDeletingRefundReceipt(false);
    }
  };

  /* ── Xóa đơn ── */
  const handleDelete = async () => {
    const id = deleteId; // capture trước khi async để tránh stale closure
    try {
      setDeleting(true);
      await adminAPI.deleteOrder(id);
      setDeleteId(null);
      setOrders(prev => prev.filter(o => (o.orderId ?? o.id) !== id));
    } catch (err) {
      toast.error('Lỗi xóa: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Cập nhật trạng thái — chặn confirm khi chọn "returned"/"cancelled" ── */
  const handleUpdateStatus = async (orderId, newStatus, reason) => {
    try {
      setUpdating(orderId);
      await adminAPI.updateOrderStatus(orderId, newStatus, reason);
      setOrders(prev =>
        prev.map(o => (o.orderId ?? o.id) === orderId
          ? { ...o, status: newStatus, ...(reason !== undefined ? { statusReason: reason } : {}) }
          : o
        )
      );
    } catch (err) {
      toast.error('Lỗi cập nhật: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusSelect = (orderId, newStatus) => {
    if (!newStatus) return;
    if (newStatus === 'cancelled') {
      setCancelConfirm({ orderId, reason: '', customReason: '' });
    } else {
      handleUpdateStatus(orderId, newStatus);
    }
  };

  /* ── Filter (memoized) ──
   * orders đã được backend lọc đúng theo status/paymentStatus/paymentMethod/fromDate-toDate (xem
   * effect fetch ở trên) — ở đây CHỈ lọc thêm "search" (text), vì đây là điều kiện duy nhất chưa
   * gửi lên backend. Không re-filter các điều kiện đã gửi backend để tránh lệch số liệu với
   * Dashboard (vốn cũng dùng chính các điều kiện đó để tính count). */
  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return orders;
    return orders.filter(o =>
      (o.orderCode ?? o.id ?? '').toString().toLowerCase().includes(searchLower)
      || (o.shippingName ?? '').toLowerCase().includes(searchLower)
      || (o.shippingPhone ?? '').toLowerCase().includes(searchLower)
    );
  }, [orders, search]);

  /* ── Thống kê (memoized — tránh O(n × numStatuses) trong stat cards).
   * Lưu ý: vì orders giờ luôn đã được backend lọc theo statusFilter hiện tại (không còn fetch
   * "tất cả rồi lọc tay"), khi statusFilter khác 'all' thì các trạng thái KHÁC sẽ hiện đếm 0 ở
   * đây — đây là hệ quả tất yếu của việc đồng bộ đúng 1 nguồn dữ liệu với backend/Dashboard,
   * không phải bug. Bấm quick-tab khác sẽ fetch lại và hiện đúng số của trạng thái đó. ── */
  const statusCounts = useMemo(() => {
    const counts = {};
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return counts;
  }, [orders]);

  /* ── Loading / Error ──
   * Chỉ thay toàn trang bằng spinner ở lần tải ĐẦU TIÊN (chưa từng fetch). Từ lần fetch lại do đổi
   * filter (quick-tab/select/ngày) trở đi, trang vẫn hiện nguyên — chỉ bảng bên dưới hiện spinner —
   * để đổi điều kiện lọc không bị giật mất luôn cả thanh filter mỗi lần bấm. */
  if (loading && !hasFetchedOnce.current) return (
    <div className="admin-page admin-center">
      <Loader size={32} className="spin" />
      <p>Đang tải đơn hàng...</p>
    </div>
  );

  if (error) return (
    <div className="admin-page admin-center">
      <ErrorState message={error} onRetry={() => fetchOrders(
        statusFilter        === 'all' ? '' : statusFilter,
        paymentStatusFilter === 'all' ? '' : paymentStatusFilter,
        payFilter            === 'all' ? '' : payFilter,
        fromDate, toDate,
      )} />
    </div>
  );

  /* ── Helper render dùng chung: ô upload/xem biên lai chuyển khoản hoàn tiền.
   * Dùng ở mọi luồng cần đến biên lai (card yêu cầu hoàn trả + khối VNPay) vì tất cả đều đọc/ghi
   * chung 1 cột refundReceiptUrl trên đơn — upload ở vị trí nào cũng cập nhật chung nhờ
   * handleUploadRefundReceipt/handleDeleteRefundReceipt đã tự setDetailOrder + setOrders.
   * compact=true: thu nhỏ ảnh/dropzone để vừa trong card, kèm chú thích "biên lai dùng chung cả đơn".
   * readOnly=true: chỉ hiện ảnh đã lưu (không nút xóa/không dropzone) — dùng khi đã chốt hoàn tiền
   * xong, tránh sửa nhầm biên lai đã dùng để xác nhận. */
  const renderRefundUploader = ({ compact = false, readOnly = false } = {}) => {
    const imgMaxWidth   = compact ? 140 : 200;
    const dropMinHeight = compact ? 70  : 90;
    const dropFontSize  = compact ? '0.74rem' : '0.8rem';
    const iconSize      = compact ? 18 : 22;

    if (readOnly) {
      return detailOrder.refundReceiptUrl ? (
        <a href={detailOrder.refundReceiptUrl} target="_blank" rel="noreferrer">
          <img src={detailOrder.refundReceiptUrl} alt="Biên lai hoàn tiền"
            style={{ maxWidth: imgMaxWidth, borderRadius: 8, border: '1.5px solid var(--border)', display: 'block' }}/>
        </a>
      ) : (
        <p style={{ fontSize: dropFontSize, color: 'var(--text-light)', margin: 0 }}>Không có biên lai.</p>
      );
    }

    return (
      <>
        {/* Ảnh đã lưu */}
        {detailOrder.refundReceiptUrl && !refundReceiptPreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
            <a href={detailOrder.refundReceiptUrl} target="_blank" rel="noreferrer">
              <img src={detailOrder.refundReceiptUrl} alt="Biên lai hoàn tiền"
                style={{ maxWidth: imgMaxWidth, borderRadius: 8, border: '1.5px solid var(--border)', display: 'block' }}/>
            </a>
            <button
              onClick={handleDeleteRefundReceipt}
              disabled={deletingRefundReceipt}
              title="Xóa biên lai"
              style={{
                position: 'absolute', top: -8, right: -8,
                width: 22, height: 22, borderRadius: '50%',
                background: '#ef4444', color: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, lineHeight: 1,
              }}>
              {deletingRefundReceipt ? <Loader size={10} className="spin"/> : <X size={11}/>}
            </button>
          </div>
        )}

        {/* Preview trước khi lưu */}
        {refundReceiptPreview && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.5rem' }}>
              <img src={refundReceiptPreview.url} alt="Preview"
                style={{ maxWidth: imgMaxWidth, borderRadius: 8, border: '1.5px solid var(--primary)', display: 'block' }}/>
              <button
                onClick={() => { URL.revokeObjectURL(refundReceiptPreview.url); setRefundReceiptPreview(null); }}
                title="Hủy"
                style={{
                  position: 'absolute', top: -8, right: -8,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#6b7280', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <X size={11}/>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="admin-btn-primary" onClick={handleUploadRefundReceipt} disabled={uploadingRefundReceipt}
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {uploadingRefundReceipt ? <><Loader size={12} className="spin"/> Đang lưu...</> : <><Save size={12}/> Lưu biên lai</>}
              </button>
            </div>
          </div>
        )}

        {/* Vùng kéo thả / nhấn để chọn ảnh */}
        {!refundReceiptPreview && (
          <label
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '0.4rem', padding: compact ? '0.6rem' : '1rem',
              border: `2px dashed ${refundDragging ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 10,
              background: refundDragging ? 'var(--primary-light)' : 'var(--bg-gray)',
              cursor: 'pointer', transition: 'all 0.15s',
              minHeight: dropMinHeight,
            }}
            onDragOver={e => { e.preventDefault(); setRefundDragging(true); }}
            onDragLeave={() => setRefundDragging(false)}
            onDrop={e => {
              e.preventDefault(); setRefundDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickRefundFile(f);
            }}
            onDoubleClick={e => e.currentTarget.querySelector('input').click()}
          >
            <ImageIcon size={iconSize} color={refundDragging ? 'var(--primary)' : 'var(--text-light)'}/>
            <span style={{ fontSize: dropFontSize, color: refundDragging ? 'var(--primary)' : 'var(--text-light)', textAlign: 'center', lineHeight: 1.4 }}>
              {detailOrder.refundReceiptUrl ? 'Kéo ảnh vào đây hoặc nhấn để thay minh chứng' : 'Kéo ảnh minh chứng chuyển khoản vào đây hoặc nhấn để chọn'}
            </span>
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) pickRefundFile(f); e.target.value = ''; }}/>
          </label>
        )}

        {/* Đơn chỉ có 1 cột refundReceiptUrl — nhiều yêu cầu hoàn trả trong cùng đơn sẽ cùng phản
            chiếu 1 ảnh, nên cần nói rõ để admin không hiểu nhầm là biên lai riêng theo từng yêu cầu. */}
        {compact && (
          <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontStyle: 'italic', margin: '0.4rem 0 0' }}>
            Biên lai dùng chung cho cả đơn — chuyển nhiều lần thì ghép thành 1 ảnh hoặc thay ảnh mới nhất.
          </p>
        )}
      </>
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Quản lý đơn hàng</h1>
        {isAdmin && (
          <span className="admin-revenue">
            Doanh thu thực thu{(fromDate || toDate) ? ` (${fromDate || '...'} → ${toDate || '...'})` : ''}:{' '}
            <strong>{revenueStats ? fmt(revenueStats.paidRevenue) : '—'}</strong>
          </span>
        )}
      </div>

      {/* Thẻ trạng thái nhanh */}
      <div className="admin-order-stats">
        {/* Ô "Tất cả" */}
        <button
          className={`order-stat-btn ${statusFilter === 'all' ? 'active' : ''}`}
          style={{ '--stat-color': '#1d4ed8', '--stat-bg': '#eff6ff' }}
          onClick={() => setStatus('all')}
        >
          <div className="osb-stat-icon"><LayoutList size={17}/></div>
          <div className="osb-stat-info">
            <strong>{orders.length}</strong>
            <span>Tất cả</span>
          </div>
        </button>

        {Object.entries(statusConfig).map(([key, cfg]) => (
          <button
            key={key}
            className={`order-stat-btn ${statusFilter === key ? 'active' : ''}`}
            style={{ '--stat-color': cfg.color, '--stat-bg': cfg.bg }}
            onClick={() => setStatus(statusFilter === key ? 'all' : key)}
          >
            <div className="osb-stat-icon">{STATUS_ICONS[key]}</div>
            <div className="osb-stat-info">
              <strong>{statusCounts[key] ?? 0}</strong>
              <span>{cfg.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Thanh tìm kiếm + bộ lọc */}
      <div className="admin-toolbar ao-toolbar-wrap">
        {/* Tìm kiếm */}
        <div className="admin-search">
          <Search size={17} />
          <input
            type="text"
            placeholder="Tìm mã đơn, tên khách hàng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Lọc trạng thái */}
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="admin-select">
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Lọc phương thức thanh toán */}
        <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className="admin-select">
          <option value="all">Tất cả phương thức</option>
          <option value="cod">COD</option>
          <option value="vnpay">VNPay</option>
        </select>

        {/* Lọc trạng thái thanh toán (paymentStatus) */}
        <select
          value={paymentStatusFilter}
          onChange={e => setPaymentStatus(e.target.value)}
          className={`admin-select ${paymentStatusFilter !== 'all' ? 'ao-select-active' : ''}`}
        >
          <option value="all">Tất cả thanh toán</option>
          <option value="paid">Đã thanh toán</option>
          <option value="unpaid">Chưa thanh toán</option>
          <option value="refund_pending">Chờ hoàn tiền</option>
          <option value="refunded">Đã hoàn tiền</option>
        </select>

        {/* Lọc theo khoảng ngày */}
        <div className="ao-date-filter">
          <input
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="admin-select ao-date-input" title="Từ ngày"
          />
          <span className="ao-date-sep">—</span>
          <input
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="admin-select ao-date-input" title="Đến ngày"
          />
          {(fromDate || toDate) && (
            <button className="ao-clear-date-btn" title="Xoá lọc ngày" onClick={() => { setFromDate(''); setToDate(''); }}>
              <X size={13}/>
            </button>
          )}
        </div>

        {/* Chọn nhanh ngày */}
        <div className="ao-date-presets">
          {[
            { label: 'Hôm nay',   action: () => { setFromDate(todayStr());     setToDate(todayStr()); } },
            { label: 'Hôm qua',   action: () => { setFromDate(yesterdayStr()); setToDate(yesterdayStr()); } },
            { label: '7 ngày',    action: () => { setFromDate(nDaysAgoStr(6)); setToDate(todayStr()); } },
            { label: 'Tháng này', action: () => { setFromDate(monthStartStr()); setToDate(todayStr()); } },
          ].map(({ label, action }) => (
            <button key={label} className="ao-date-preset-btn" onClick={action}>{label}</button>
          ))}
        </div>

        <span className="admin-count">{filtered.length} đơn hàng</span>
        {orders.length >= PAGE_SIZE && (
          <span className="ao-limit-warn" title={`Chỉ hiển thị ${PAGE_SIZE} đơn gần nhất`}>
            ⚠ Đang hiển thị {PAGE_SIZE} đơn
          </span>
        )}
      </div>

      {/* Bảng đơn hàng */}
      <div className="admin-card">
        <table className="admin-table ao-orders-table">
          <colgroup>
            <col style={{ width: '14%' }}/>
            <col style={{ width: '22%' }}/>
            <col style={{ width: '15%' }}/>
            <col style={{ width: '12%' }}/>
            <col style={{ width: '17%' }}/>
            <col style={{ width: '20%' }}/>
          </colgroup>
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Thanh toán</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center" style={{ padding: '2rem' }}><Loader size={22} className="spin"/></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-light text-center">Không có đơn hàng</td></tr>
            ) : filtered.map(o => {
              const id   = o.orderId ?? o.id;
              const s    = statusConfig[o.status] ?? statusConfig.pending;
              const next = nextStatusOptions[o.status] ?? [];
              const ps   = payStatusConfig[o.paymentStatus];
              const needsPayConfirm = o.status === 'delivered' && o.paymentStatus === 'unpaid' && o.paymentMethod === 'cod';
              const isReturnPending = o.status === 'return_pending';
              // Đơn đã duyệt 1 yêu cầu hoàn trả nhưng chưa hoàn tiền — status có thể đã quay về
              // delivered/returned, nên cần tính riêng từ statusHistory để không bị "biến mất"
              // khỏi các cảnh báo cần xử lý trên danh sách (payload đã có statusHistory sẵn).
              const needsRefundConfirm = !isReturnPending && hasApprovedUnrefundedReturn(o.statusHistory);
              // Số sản phẩm (dòng hàng) đã được hoàn trả — chỉ tính khi yêu cầu đã được xử lý xong,
              // còn return_pending thì đã có cảnh báo "Cần xử lý" riêng, chưa cần hiện số liệu này.
              const returnedCount = isReturnPending ? 0
                : (o.items ?? []).filter(it => (it.returnedQty ?? 0) > 0).length;
              const rowClass = isReturnPending ? 'ao-row-return-pending' : (needsPayConfirm || needsRefundConfirm) ? 'ao-row-needs-pay' : '';

              return (
                <tr key={id} className={rowClass}>
                  {/* Mã đơn + Ngày đặt */}
                  <td>
                    <button className="ao-order-code-btn" onClick={() => handleViewDetail(id)} title="Xem chi tiết">
                      <strong>{o.orderCode ?? id}</strong>
                    </button>
                    <div className="ao-date-text">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </div>
                  </td>

                  {/* Khách hàng + SĐT + Địa chỉ */}
                  <td>
                    <div className="ao-cust-name">{o.shippingName}</div>
                    <div className="ao-cust-phone"><Phone size={11}/> {o.shippingPhone}</div>
                    <div className="ao-cust-addr" title={o.shippingAddress}>{o.shippingAddress}</div>
                  </td>

                  {/* Phương thức + Trạng thái thanh toán */}
                  <td>
                    <span className="admin-pay-tag">{paymentLabels[o.paymentMethod] ?? o.paymentMethod}</span>
                    <div style={{ marginTop: '0.3rem' }}>
                      {ps
                        ? <span style={{ color: ps.color, fontWeight: 600, fontSize: '0.8rem' }}>{ps.label}</span>
                        : <span className="text-light">—</span>}
                    </div>
                    {needsPayConfirm && (
                      <div className="ao-needs-pay-chip">⚠ Chưa thu tiền</div>
                    )}
                  </td>

                  {/* Tổng tiền */}
                  <td className="text-primary ao-amount"><strong>{fmt(o.totalAmount)}</strong></td>

                  {/* Trạng thái đơn hàng */}
                  <td>
                    <span className="admin-badge ao-status-badge" style={{ color: s.color, background: s.bg }}>
                      {STATUS_BADGE_ICONS[o.status]}
                      {s.label}
                    </span>
                    {isReturnPending && (
                      <div><span className="ao-urgent-chip">Cần xử lý</span></div>
                    )}
                    {!isReturnPending && needsRefundConfirm && (
                      <div><span className="ao-urgent-chip" style={{ background: '#fef3c7', color: '#b45309' }}>Cần hoàn tiền</span></div>
                    )}
                    {!isReturnPending && returnedCount > 0 && (
                      <div><span className="ao-urgent-chip" style={{ background: '#ffedd5', color: '#c2410c' }}>Đã hoàn {returnedCount} sản phẩm</span></div>
                    )}
                    {o.status === 'delivery_failed' && (
                      <div><span className="ao-urgent-chip" style={{ background: '#fce7f3', color: '#be185d' }}>Giao thất bại</span></div>
                    )}
                  </td>

                  {/* Thao tác: cập nhật trạng thái + nút xem chi tiết riêng */}
                  <td>
                    <div className="ao-actions-cell">
                      {updating === id ? (
                        <Loader size={16} className="spin" />
                      ) : isReturnPending ? (
                        <button className="ao-view-return-btn" onClick={() => handleViewDetail(id)}>
                          <Eye size={13}/> Xử lý hoàn trả
                        </button>
                      ) : next.length > 0 ? (
                        // Nút bấm rõ ràng thay cho <select> — tránh bấm nhầm vì mỗi đơn chỉ có
                        // tối đa 2 lựa chọn rất gần nhau (VD: "Đã xác nhận" / "Đã hủy") trong dropdown nhỏ.
                        // Tách màu: hành động tiến tới (xanh/chính) khác hẳn hành động hủy/thất bại (đỏ nhạt).
                        <div className="ao-update-btns">
                          {next.map(ns => {
                            const risky = ns === 'cancelled' || ns === 'delivery_failed';
                            return (
                              <button
                                key={ns}
                                className={`ao-update-btn ${risky ? 'ao-update-btn-risky' : 'ao-update-btn-primary'}`}
                                title={risky ? `Chuyển sang "${statusConfig[ns]?.label}"` : `Chuyển tiếp sang "${statusConfig[ns]?.label}"`}
                                onClick={() => handleStatusSelect(id, ns)}
                              >
                                {STATUS_BADGE_ICONS[ns]} {statusConfig[ns]?.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : needsPayConfirm ? (
                        /* Đã giao nhưng chưa thu tiền COD — chưa thực sự kết thúc */
                        <button className="ao-collect-pay-btn" onClick={() => handleViewDetail(id)}>
                          <CheckCircle size={13}/> Thu tiền COD
                        </button>
                      ) : needsRefundConfirm ? (
                        /* Đã duyệt hoàn trả nhưng chưa hoàn tiền — chưa thực sự kết thúc */
                        <button className="ao-view-return-btn" onClick={() => handleViewDetail(id)}>
                          <Eye size={13}/> Cần hoàn tiền
                        </button>
                      ) : (
                        <span className="ao-status-locked"><Lock size={11}/> Đã kết thúc</span>
                      )}
                      <button className="ao-icon-btn ao-icon-view" title="Xem chi tiết / Xóa" onClick={() => handleViewDetail(id)}>
                        <Eye size={15}/>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ Modal chi tiết đơn hàng ══ */}
      {detailOrder && (
        <div className="admin-modal-overlay" onClick={() => setDetailOrder(null)}>
          <div className="admin-modal ao-detail-modal" onClick={e => e.stopPropagation()}>

            <div className="admin-modal-header">
              {detailOrder._loading ? (
                <h2><Loader size={16} className="spin"/> Đang tải...</h2>
              ) : (
                <h2>
                  Chi tiết đơn{' '}
                  {/* monospace để mã đơn trông như tracking code, dễ đọc từng ký tự khi đối chiếu */}
                  <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>
                    #{detailOrder.orderCode ?? detailOrder.id}
                  </span>
                  {(() => {
                    const sc = statusConfig[detailOrder.status];
                    return sc
                      // Badge trạng thái nhỏ kế bên tiêu đề, dùng màu từ statusConfig để nhất quán
                      ? <span className="admin-badge" style={{ color: sc.color, background: sc.bg, marginLeft: '0.6rem', fontSize: '0.78rem' }}>{sc.label}</span>
                      : null;
                  })()}
                </h2>
              )}
              <button onClick={() => setDetailOrder(null)}><X size={20}/></button>
            </div>

            {detailOrder._loading ? (
              // minHeight 200 để modal không bị xẹp lại khi đang loading, tránh nhảy layout
              <div className="admin-modal-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                <Loader size={32} className="spin"/>
              </div>
            ) : (
              <div className="admin-modal-body ao-detail-body">

                {/* ══ Khối Xử lý / Xem hoàn trả — mỗi yêu cầu (có thể nhiều lần, từng phần) 1 card ══ */}
                {(() => {
                  const hist = detailOrder.statusHistory ?? [];
                  const decisionsByCode = {};
                  hist.forEach(h => {
                    const d = parseReturnDecision(h.note);
                    if (d) decisionsByCode[d.reqCode] = { decision: d, createdAt: h.createdAt };
                  });
                  const returnRequests = hist.reduce((acc, h, idx) => {
                    if (h.status !== 'return_pending') return acc;
                    const data = parseReturnRequest(h.note);
                    if (data) {
                      acc.push({ kind: 'json', createdAt: h.createdAt, data, resolved: decisionsByCode[data.reqCode] ?? null });
                    } else {
                      // Dữ liệu cũ trước khi có hoàn trả từng sản phẩm — không có reqCode nên chỉ xem được, không xử lý qua đây
                      acc.push({ kind: 'legacy', createdAt: h.createdAt, note: h.note, imageUrl: h.imageUrl, legacyResolved: hist[idx + 1] ?? null });
                    }
                    return acc;
                  }, []).reverse();

                  if (returnRequests.length === 0) return null;

                  return (
                  <div className="ao-return-block">
                    <div className="ao-return-block-title">
                      {detailOrder.status === 'return_pending'
                        ? <><AlertTriangle size={15}/> Khách hàng yêu cầu hoàn trả — cần xử lý</>
                        : <><RotateCcw size={15}/> Thông tin yêu cầu hoàn trả</>}
                    </div>

                    {returnRequests.map((req, ri) => {
                      const reqCode   = req.kind === 'json' ? req.data.reqCode : null;
                      const isPending = req.kind === 'json' ? !req.resolved : !req.legacyResolved;
                      const isActing  = refundAction?.reqCode === reqCode;
                      return (
                        <div key={ri} className="ao-return-customer-reason"
                          style={ri < returnRequests.length - 1
                            ? { marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border)' }
                            : undefined}>

                          {/* Luôn hiện nút in, cả với yêu cầu cũ không có reqCode — trang in tự lấy
                              yêu cầu hoàn trả gần nhất của đơn khi URL không có ?reqCode=. */}
                          <div className="ao-return-info-row" style={{ justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-light)' }}>
                              {reqCode ? `#${reqCode}` : ''}
                            </span>
                            <button className="admin-btn-ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.76rem' }}
                              onClick={() => window.open(`/admin/orders/${detailOrder.orderId ?? detailOrder.id}/return-receipt${reqCode ? `?reqCode=${reqCode}` : ''}`, '_blank')}>
                              <Printer size={12}/> In phiếu này
                            </button>
                          </div>

                          <div className="ao-return-info-row">
                            <span className="ao-return-reason-label">Ngày yêu cầu:</span>
                            <span className="ao-return-reason-text" style={{ color: 'var(--text-light)' }}>
                              {new Date(req.createdAt).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          </div>

                          {req.kind === 'json' ? (
                            <>
                              <div className="ao-return-info-row" style={{ alignItems: 'flex-start' }}>
                                <span className="ao-return-reason-label" style={{ paddingTop: 2 }}>Sản phẩm:</span>
                                <div style={{ flex: 1 }}>
                                  {(req.data.items ?? []).map((line, li) => (
                                    <div key={li} className="ao-return-reason-text">{line.name} × {line.qty} — {fmt(line.lineRefund)}</div>
                                  ))}
                                  <div className="ao-return-reason-text" style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
                                    Tổng tiền hoàn: {fmt(req.data.refundAmount)}
                                  </div>
                                </div>
                              </div>
                              {req.data.reason && (
                                <div className="ao-return-info-row">
                                  <span className="ao-return-reason-label">Lý do khách:</span>
                                  <span className="ao-return-reason-text">{req.data.reason}</span>
                                </div>
                              )}
                              {(req.data.images ?? []).length > 0 && (
                                <div className="ao-return-info-row" style={{ alignItems: 'flex-start' }}>
                                  <span className="ao-return-reason-label" style={{ paddingTop: 2 }}>Ảnh minh chứng:</span>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {req.data.images.map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                                        <img src={url} alt={`Minh chứng ${i + 1}`}
                                          style={{ width: 90, height: 90, objectFit: 'cover',
                                            borderRadius: 6, border: '1px solid var(--border)', display: 'block' }}/>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {req.note && (
                                <div className="ao-return-info-row">
                                  <span className="ao-return-reason-label">Lý do khách:</span>
                                  <span className="ao-return-reason-text">{req.note}</span>
                                </div>
                              )}
                              {req.imageUrl && (
                                <div className="ao-return-info-row" style={{ alignItems: 'flex-start' }}>
                                  <span className="ao-return-reason-label" style={{ paddingTop: 2 }}>Ảnh minh chứng:</span>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {req.imageUrl.split(',').filter(Boolean).map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                                        <img src={url} alt={`Minh chứng ${i + 1}`}
                                          style={{ width: 90, height: 90, objectFit: 'cover',
                                            borderRadius: 6, border: '1px solid var(--border)', display: 'block' }}/>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          <div className="ao-return-info-row">
                            <span className="ao-return-reason-label">Trạng thái:</span>
                            <span className="ao-return-reason-text">
                              {isPending && <span style={{ color: '#f97316', fontWeight: 600 }}>⏳ Chờ xét duyệt</span>}
                              {req.kind === 'json' && req.resolved?.decision.approved && <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Đã chấp nhận</span>}
                              {req.kind === 'json' && req.resolved && !req.resolved.decision.approved && <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ Đã từ chối</span>}
                              {req.kind === 'legacy' && req.legacyResolved?.status === 'returned' && <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Đã chấp nhận</span>}
                              {req.kind === 'legacy' && req.legacyResolved && req.legacyResolved.status !== 'returned' && <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ Đã từ chối</span>}
                            </span>
                          </div>

                          {/* Phản hồi admin cho yêu cầu đã xử lý */}
                          {req.kind === 'json' && req.resolved && (
                            <div className="ao-return-info-row" style={{ alignItems: 'flex-start' }}>
                              <span className="ao-return-reason-label" style={{ paddingTop: 2 }}>
                                {req.resolved.decision.approved ? 'Phản hồi duyệt:' : 'Lý do từ chối:'}
                              </span>
                              <div style={{ flex: 1 }}>
                                {req.resolved.decision.approved ? (
                                  req.resolved.decision.refunded ? (
                                    <span className="ao-return-reason-text" style={{ color: '#10b981', fontWeight: 600 }}>
                                      ✓ Đã hoàn tiền cho yêu cầu này.
                                    </span>
                                  ) : (
                                    <>
                                      <span className="ao-return-reason-text" style={{ color: '#f97316', fontWeight: 600 }}>
                                        ⏳ Đã duyệt (chưa hoàn tiền).
                                      </span>
                                      {(detailOrder.paymentStatus === 'paid' || detailOrder.paymentStatus === 'partially_refunded') && (
                                        <div style={{ marginTop: '0.4rem' }}>
                                          <div style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.4rem' }}>📎 Biên lai chuyển khoản</div>
                                          {renderRefundUploader({ compact: true })}
                                          <button className="admin-btn-primary"
                                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', marginTop: '0.5rem' }}
                                            disabled={!detailOrder.refundReceiptUrl || confirmingReturnRefund === req.data.reqCode}
                                            onClick={() => handleConfirmReturnRefund(req.data.reqCode)}>
                                            {confirmingReturnRefund === req.data.reqCode
                                              ? <><Loader size={12} className="spin"/> Đang xử lý...</>
                                              : <><CheckCircle size={12}/> Xác nhận đã hoàn tiền</>}
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )
                                ) : (
                                  <span className="ao-return-reason-text">
                                    {req.resolved.decision.rejectReason || '(Không có lý do)'}
                                  </span>
                                )}
                                {req.resolved.createdAt && (
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 2 }}>
                                    {new Date(req.resolved.createdAt).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {req.kind === 'legacy' && req.legacyResolved && (
                            <div className="ao-return-info-row" style={{ alignItems: 'flex-start' }}>
                              <span className="ao-return-reason-label" style={{ paddingTop: 2 }}>
                                {req.legacyResolved.status === 'returned' ? 'Phản hồi duyệt:' : 'Lý do từ chối:'}
                              </span>
                              <span className="ao-return-reason-text">
                                {req.legacyResolved.note || (req.legacyResolved.status === 'returned' ? '(Không có ghi chú)' : '(Không có lý do)')}
                              </span>
                            </div>
                          )}

                          {/* Hành động duyệt/từ chối — chỉ áp dụng cho yêu cầu mới (có reqCode) đang chờ */}
                          {req.kind === 'json' && isPending && (
                            <>
                              {!isActing && (
                                <div className="ao-return-actions">
                                  <button className="ao-return-approve-btn"
                                    onClick={() => { setRefundAction({ reqCode, type: 'approve' }); setRestoreStock(false); setMarkRefunded(false); }}>
                                    <CheckCircle size={14}/> Chấp nhận hoàn trả
                                  </button>
                                  <button className="ao-return-reject-btn"
                                    onClick={() => { setRefundAction({ reqCode, type: 'reject' }); setRejectReason(''); }}>
                                    <X size={14}/> Từ chối
                                  </button>
                                </div>
                              )}

                              {isActing && refundAction.type === 'approve' && (
                                <div className="ao-return-confirm-box">
                                  <label className="ao-restore-stock-label">
                                    <input type="checkbox" checked={restoreStock} onChange={e => setRestoreStock(e.target.checked)}/>
                                    <span>Hoàn trả sản phẩm về kho hàng (hàng còn dùng được)</span>
                                  </label>
                                  {detailOrder.paymentStatus === 'paid' && (
                                    <>
                                      <label className="ao-restore-stock-label"
                                        title={!detailOrder.refundReceiptUrl ? 'Cần upload biên lai chuyển khoản trước' : undefined}>
                                        <input type="checkbox" checked={markRefunded} disabled={!detailOrder.refundReceiptUrl}
                                          onChange={e => setMarkRefunded(e.target.checked)}/>
                                        <span>Đã chuyển khoản hoàn tiền cho khách ({fmt(req.data.refundAmount)})</span>
                                      </label>
                                      {!detailOrder.refundReceiptUrl && (
                                        <p style={{ fontSize: '0.78rem', color: '#f97316', margin: '0.2rem 0 0' }}>
                                          ⚠ Vui lòng upload biên lai chuyển khoản ngay bên dưới trước khi đánh dấu đã hoàn tiền.
                                        </p>
                                      )}
                                      <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.4rem' }}>📎 Biên lai chuyển khoản</div>
                                        {renderRefundUploader({ compact: true })}
                                      </div>
                                    </>
                                  )}
                                  <p className="ao-return-hint">
                                    {restoreStock && 'Tồn kho được hoàn lại. '}
                                    {markRefunded ? 'Thanh toán đơn → Đã hoàn tiền (toàn bộ hoặc một phần).' : 'Chưa tick hoàn tiền — chỉ ghi nhận đã duyệt yêu cầu.'}
                                  </p>
                                  <div className="ao-return-confirm-btns">
                                    <button className="admin-btn-ghost" onClick={() => setRefundAction(null)} disabled={approvingReturn}>Hủy</button>
                                    <button className="ao-return-approve-btn" onClick={handleApproveReturn} disabled={approvingReturn}>
                                      {approvingReturn ? <><Loader size={13} className="spin"/> Đang xử lý...</> : <><CheckCircle size={13}/> Xác nhận chấp nhận</>}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isActing && refundAction.type === 'reject' && (
                                <div className="ao-return-confirm-box">
                                  <p style={{ fontSize: '0.88rem', color: '#374151', margin: '0 0 0.6rem' }}>
                                    Yêu cầu này sẽ bị từ chối — sản phẩm liên quan không được hoàn trả.
                                  </p>
                                  <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                                      Lý do từ chối <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={rejectReason}
                                      onChange={e => setRejectReason(e.target.value)}
                                      placeholder="VD: Quá 7 ngày, sản phẩm không còn nguyên vẹn..."
                                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 5,
                                        border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
                                    />
                                  </div>
                                  <div className="ao-return-confirm-btns">
                                    <button className="admin-btn-ghost" onClick={() => setRefundAction(null)} disabled={rejectingReturn}>Hủy</button>
                                    <button className="ao-return-reject-btn" onClick={handleRejectReturn} disabled={rejectingReturn || !rejectReason.trim()}>
                                      {rejectingReturn ? <><Loader size={13} className="spin"/> Đang xử lý...</> : <><X size={13}/> Xác nhận từ chối</>}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}

                {/* ══ Khối Hoàn tiền VNPay — đơn bị hủy sau khi đã thanh toán ══ */}
                {detailOrder.status === 'cancelled' &&
                 (detailOrder.paymentStatus === 'refund_pending' || detailOrder.paymentStatus === 'refunded') && (
                  <div className="ao-return-block">
                    <div className="ao-return-block-title">
                      {detailOrder.paymentStatus === 'refund_pending'
                        ? <><AlertTriangle size={15}/> Đơn đã hủy — cần hoàn tiền VNPay</>
                        : <><CheckCircle size={15}/> Đã hoàn tiền VNPay</>}
                    </div>
                    <div className="ao-return-customer-reason">
                      <div className="ao-return-info-row">
                        <span className="ao-return-reason-label">Tình huống:</span>
                        <span className="ao-return-reason-text">Khách đã thanh toán qua VNPay rồi hủy đơn. Cần chuyển khoản hoàn tiền thủ công.</span>
                      </div>
                      <div className="ao-return-info-row">
                        <span className="ao-return-reason-label">Số tiền hoàn:</span>
                        <strong style={{ color: 'var(--primary)' }}>{fmt(detailOrder.totalAmount)}</strong>
                      </div>
                      <div className="ao-return-info-row">
                        <span className="ao-return-reason-label">Trạng thái:</span>
                        <span>
                          {detailOrder.paymentStatus === 'refund_pending'
                            ? <span style={{ color: '#f97316', fontWeight: 600 }}>⏳ Chờ hoàn tiền</span>
                            : <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Đã hoàn tiền</span>}
                        </span>
                      </div>
                    </div>
                    {detailOrder.paymentStatus === 'refund_pending' && (
                      <div className="ao-return-actions" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', width: '100%' }}>
                        <div style={{ width: '100%' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.4rem' }}>📎 Biên lai chuyển khoản</div>
                          {renderRefundUploader({ compact: true })}
                        </div>
                        <button className="ao-return-approve-btn" onClick={handleConfirmCancelRefund}
                          disabled={confirmingCancelRefund || !detailOrder.refundReceiptUrl}
                          title={!detailOrder.refundReceiptUrl ? 'Cần upload biên lai chuyển khoản trước' : undefined}>
                          {confirmingCancelRefund
                            ? <><Loader size={13} className="spin"/> Đang xử lý...</>
                            : <><CheckCircle size={14}/> Xác nhận đã hoàn tiền</>}
                        </button>
                      </div>
                    )}
                    {detailOrder.paymentStatus === 'refunded' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.4rem' }}>📎 Biên lai chuyển khoản</div>
                        {renderRefundUploader({ compact: true, readOnly: true })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Khách hàng ── */}
                <div className="ao-detail-section">
                  <div className="ao-section-title"><User size={14}/> Thông tin khách hàng</div>
                  <div className="ao-detail-row"><User size={13} color="var(--text-light)"/><span>{detailOrder.shippingName ?? '—'}</span></div>
                  <div className="ao-detail-row"><Phone size={13} color="var(--text-light)"/><span>{detailOrder.shippingPhone ?? '—'}</span></div>
                  <div className="ao-detail-row"><MapPin size={13} color="var(--text-light)"/><span>{detailOrder.shippingAddress ?? '—'}</span></div>
                  {detailOrder.note && (
                    // alignItems: flex-start vì ghi chú có thể nhiều dòng, không muốn label bị kéo giữa
                    <div className="ao-detail-row" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-light)', fontSize: '0.8rem', minWidth: 50 }}>Ghi chú:</span>
                      {/* Nền vàng nhạt để ghi chú nổi bật khỏi thông tin khách hàng xung quanh */}
                      <span style={{ color: '#92400e', background: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.82rem' }}>{detailOrder.note}</span>
                    </div>
                  )}
                </div>

                {/* ── Sản phẩm ── */}
                <div className="ao-detail-section">
                  <div className="ao-section-title"><Package size={14}/> Danh sách sản phẩm</div>
                  {(detailOrder.items ?? []).length === 0 ? (
                    <p className="text-light" style={{ fontSize: '0.85rem' }}>Không có dữ liệu sản phẩm</p>
                  ) : (
                    <>
                      {(() => {
                        const totalQty = detailOrder.items.reduce((s, it) => s + (it.quantity ?? 0), 0);
                        const returnedQtyTotal = detailOrder.items.reduce((s, it) => s + (it.returnedQty ?? 0), 0);
                        if (returnedQtyTotal === 0) return null;

                        // Tiền hoàn: cộng refundAmount của các yêu cầu có quyết định MỚI NHẤT là approved
                        // (không phụ thuộc đã hoàn tiền hay chưa) — khớp ý nghĩa "đã chấp nhận hoàn trả"
                        // của returnedQtyTotal ở trên, không phải số tiền đã thực chuyển khoản.
                        const requestsByCode = {};
                        const latestDecisionByCode = {};
                        for (const h of detailOrder.statusHistory ?? []) {
                          const req = parseReturnRequest(h.note);
                          if (req?.reqCode) requestsByCode[req.reqCode] = req;
                          const dec = parseReturnDecision(h.note);
                          if (dec?.reqCode) latestDecisionByCode[dec.reqCode] = dec;
                        }
                        const refundTotal = Object.values(latestDecisionByCode)
                          .filter(dec => dec.approved)
                          .reduce((s, dec) => s + (requestsByCode[dec.reqCode]?.refundAmount ?? 0), 0);

                        return (
                          <p style={{ fontSize: '0.82rem', color: '#c2410c', background: '#fff7ed',
                            border: '1px solid #fed7aa', borderRadius: 6, padding: '0.45rem 0.7rem', margin: '0 0 0.6rem' }}>
                            ↩ Đã hoàn trả {returnedQtyTotal}/{totalQty} sản phẩm — tiền hoàn: <strong>{fmt(refundTotal)}</strong>
                          </p>
                        );
                      })()}
                      <div className="ao-items-list">
                        {detailOrder.items.map((item, i) => (
                          <div key={i} className="ao-item-row">
                            {item.productImage ? (
                              // flexShrink: 0 để ảnh không bị co lại khi tên sản phẩm quá dài
                              <img src={item.productImage} alt={item.productName}
                                style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}/>
                            ) : (
                              // Placeholder xám khi không có ảnh, cùng kích thước để layout không bị lệch
                              <div style={{ width: 40, height: 40, background: 'var(--bg-gray)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Package size={16} color="#9ca3af"/>
                              </div>
                            )}
                            {/* minWidth: 0 bắt buộc để text-overflow: ellipsis hoạt động trong flex container */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.productName}</div>
                              <div className="text-light" style={{ fontSize: '0.78rem' }}>x{item.quantity} × {fmt(item.unitPrice)}</div>
                              {(item.returnedQty ?? 0) > 0 && (
                                <div style={{ fontSize: '0.76rem', color: '#c2410c', fontWeight: 600 }}>
                                  ↩ Đã hoàn trả: {item.returnedQty}/{item.quantity}
                                </div>
                              )}
                            </div>
                            <strong className="text-primary" style={{ flexShrink: 0, fontSize: '0.88rem' }}>
                              {fmt((item.unitPrice ?? 0) * (item.quantity ?? 1))}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* ── Bảo hành ── */}
                {detailOrder.status === 'delivered' && (detailOrder.items ?? []).some(it => (it.warrantyMonths ?? 0) > 0) && (
                  <div className="ao-detail-section">
                    <div className="ao-section-title"><ShieldCheck size={14}/> Thông tin bảo hành</div>
                    {(detailOrder.items ?? []).map((item, i) => {
                      const w = getWarrantyInfo(item, detailOrder.deliveredAt, detailOrder.status);
                      if (!w.hasWarranty) return null;
                      return (
                        <div key={i} className="ao-warranty-row">
                          <span className="ao-warranty-name">{item.productName}</span>
                          <div className="ao-warranty-detail">
                            <span className="ao-warranty-months">{w.months} tháng</span>
                            {w.status !== 'not_started' ? (
                              <>
                                <span className="ao-warranty-dates">{w.startDateStr} – {w.endDateStr}</span>
                                <span className={`ao-warranty-badge ao-warranty-${w.status}`}>{w.statusLabel}</span>
                              </>
                            ) : (
                              <span className="ao-warranty-badge ao-warranty-not-started">{w.statusLabel}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Thanh toán ── */}
                <div className="ao-detail-section ao-payment-section">
                  <div className="ao-section-title" style={{ marginBottom: '0.75rem' }}>💳 Thông tin thanh toán</div>
                  <div className="ao-payment-grid">
                    <div className="ao-payment-row">
                      <span>Phương thức</span>
                      <span className="admin-pay-tag">{paymentLabels[detailOrder.paymentMethod] ?? detailOrder.paymentMethod ?? '—'}</span>
                    </div>
                    {detailOrder.discountAmount > 0 && (
                      <div className="ao-payment-row">
                        <span>Voucher{detailOrder.couponCode ? ` (${detailOrder.couponCode})` : ''}</span>
                        <span style={{ color: '#10b981' }}>−{fmt(detailOrder.discountAmount)}</span>
                      </div>
                    )}
                    {detailOrder.shippingFee > 0 && (
                      <div className="ao-payment-row">
                        <span>Phí vận chuyển</span><span>{fmt(detailOrder.shippingFee)}</span>
                      </div>
                    )}
                    {detailOrder.installationFee > 0 && (
                      <div className="ao-payment-row">
                        <span>Phí lắp đặt</span><span>{fmt(detailOrder.installationFee)}</span>
                      </div>
                    )}
                    <div className="ao-payment-row ao-payment-total">
                      <span>Tổng cộng</span>
                      <strong className="text-primary">{fmt(detailOrder.totalAmount)}</strong>
                    </div>
                    {/* Đường kẻ nét đứt phân tách tổng tiền và trạng thái thanh toán */}
                    <div className="ao-payment-row" style={{ borderTop: '1.5px dashed var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                      <span>Trạng thái thanh toán</span>
                      {/* gap: 0.75rem để nút "Xác nhận thu tiền" không dính vào label trạng thái */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {(() => {
                          const ps = payStatusConfig[detailOrder.paymentStatus];
                          return ps
                            // fontWeight 700 để trạng thái thanh toán nổi hơn các thông tin khác
                            ? <span style={{ color: ps.color, fontWeight: 700, fontSize: '0.88rem' }}>{ps.label}</span>
                            : <span className="text-light">—</span>;
                        })()}
                        {detailOrder.status === 'delivered' && detailOrder.paymentStatus === 'unpaid' && detailOrder.paymentMethod === 'cod' && (
                          <button className="ao-confirm-pay-btn" onClick={handleConfirmPayment} disabled={confirmingPayment}>
                            {confirmingPayment
                              ? <><Loader size={13} className="spin"/> Đang xử lý...</>
                              : <><CheckCircle size={14}/> Xác nhận đã thu tiền COD</>}
                          </button>
                        )}
                        {detailOrder.paymentStatus === 'paid' && (
                          // Icon tick xanh lá xác nhận đã thanh toán, dùng flex để icon và chữ thẳng hàng
                          <span style={{ color: '#10b981', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle size={13}/> Đã xác nhận
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Lịch sử trạng thái ── */}
                {(detailOrder.statusHistory ?? []).length > 0 && (
                  <div className="ao-detail-section">
                    <div className="ao-section-title" style={{ marginBottom: '0.6rem' }}>📋 Lịch sử trạng thái</div>
                    <div className="ao-history-list">
                      {[...(detailOrder.statusHistory)].reverse().map((h, i) => {
                        const sc = statusConfig[h.status] ?? { label: h.status, color: '#6b7280', bg: '#f3f4f6' };
                        return (
                          <div key={i} className="ao-history-item">
                            <span className="ao-history-badge" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                            <div className="ao-history-meta">
                              {h.note && <span className="ao-history-note">{formatHistoryNote(h)}</span>}
                              {h.imageUrl && <a href={h.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Xem ảnh</a>}
                              <span className="ao-history-by">{h.changedBy ? (h.changedBy.includes('@') ? 'Admin' : h.changedBy) : 'Khách'}</span>
                              <span className="ao-history-date">{h.createdAt ? (() => { const d = new Date(h.createdAt); const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const t = d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}); return `${dd}/${mm}/${d.getFullYear()} · ${t}`; })() : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

            <div className="admin-modal-footer ao-detail-footer">
              {!detailOrder._loading && isAdmin && (
                <button
                  className="admin-btn-danger-ghost"
                  onClick={() => { const oid = detailOrder.orderId ?? detailOrder.id; setDetailOrder(null); setDeleteId(oid); }}
                >
                  <Trash2 size={14}/> Xóa đơn hàng
                </button>
              )}
              {!detailOrder._loading && (
                <button className="admin-btn-ghost"
                  onClick={() => window.open(`/admin/orders/${detailOrder.orderId ?? detailOrder.id}/invoice`, '_blank')}>
                  <Printer size={14}/> In hoá đơn
                </button>
              )}
              {/* Nút chung "In biên lai hoàn tiền" — đang tạm ẩn cho trường hợp HOÀN TRẢ SẢN PHẨM
                  (đã có nút "In phiếu này" riêng từng yêu cầu ở khối phía trên), chỉ còn hiện cho
                  trường hợp HỦY ĐƠN + hoàn tiền VNPay. Bỏ comment 3 dòng dưới để hiện lại như cũ. */}
              {!detailOrder._loading && (
                // detailOrder.status === 'return_pending' || detailOrder.status === 'returned' ||
                (detailOrder.status === 'cancelled' &&
                  (detailOrder.paymentStatus === 'refund_pending' || detailOrder.paymentStatus === 'refunded'))
                // ||
                // Đơn đã quay về delivered sau khi 1 yêu cầu hoàn trả từng phần được xử lý — vẫn xem lại được
                // (detailOrder.statusHistory ?? []).some(h => h.status === 'return_pending')
              ) && (
                <button className="admin-btn-ghost"
                  style={{ color:'#f97316', borderColor:'#fed7aa' }}
                  onClick={() => window.open(`/admin/orders/${detailOrder.orderId ?? detailOrder.id}/return-receipt`, '_blank')}>
                  <Printer size={14}/> In biên lai hoàn tiền
                </button>
              )}
              <button className="admin-btn-ghost" onClick={() => setDetailOrder(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Confirm modal: Admin hủy đơn (có lý do) ══ */}
      {cancelConfirm && (
        <div className="admin-modal-overlay" onClick={() => setCancelConfirm(null)}>
          <div className="admin-modal admin-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2> Xác nhận hủy đơn hàng</h2>
              <button onClick={() => setCancelConfirm(null)}><X size={20}/></button>
            </div>
            <div className="admin-modal-body">
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', display: 'block' }}>
                  Lý do hủy <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {/* Viền đỏ nhạt (#fca5a5) khi chưa chọn lý do để nhắc nhở, chuyển về viền thường khi đã chọn */}
                <select
                  value={cancelConfirm.reason}
                  onChange={e => setCancelConfirm({ ...cancelConfirm, reason: e.target.value, customReason: '' })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6,
                    border: `1.5px solid ${cancelConfirm.reason ? 'var(--border)' : '#fca5a5'}`,
                    fontSize: '0.9rem', background: '#fff' }}
                >
                  <option value="">— Chọn lý do —</option>
                  <option value="Bom hàng (không nhận COD)">Bom hàng (không nhận COD)</option>
                  <option value="Liên hệ khách không được">Liên hệ khách không được</option>
                  <option value="Địa chỉ giao hàng không hợp lệ">Địa chỉ giao hàng không hợp lệ</option>
                  <option value="Khách yêu cầu hủy">Khách yêu cầu hủy</option>
                  <option value="Hết hàng">Hết hàng</option>
                  <option value="other">Lý do khác...</option>
                </select>
              </div>
              {cancelConfirm.reason === 'other' && (
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={cancelConfirm.customReason}
                    onChange={e => setCancelConfirm({ ...cancelConfirm, customReason: e.target.value })}
                    placeholder="Nhập lý do hủy..."
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6,
                      border: '1.5px solid var(--border)', fontSize: '0.88rem' }}
                  />
                </div>
              )}
              <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>
                Hành động này sẽ hoàn lại tồn kho và <strong>không thể hoàn tác</strong>.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setCancelConfirm(null)}>Huỷ bỏ</button>
              {(() => {
                const reasonOk = cancelConfirm.reason &&
                  (cancelConfirm.reason !== 'other' || cancelConfirm.customReason.trim() !== '');
                // opacity 0.45 và cursor not-allowed khi chưa điền lý do — disabled prop chặn click nhưng không thay đổi cursor trên button
                return (
                  <button
                    className="admin-btn-danger"
                    disabled={!reasonOk}
                    style={{ opacity: reasonOk ? 1 : 0.45, cursor: reasonOk ? 'pointer' : 'not-allowed' }}
                    onClick={() => {
                      const { orderId, reason, customReason } = cancelConfirm;
                      const finalReason = reason === 'other' ? customReason.trim() : reason;
                      setCancelConfirm(null);
                      handleUpdateStatus(orderId, 'cancelled', finalReason);
                    }}
                  >
                    <X size={14}/> Xác nhận hủy đơn
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Xóa đơn hàng"
        message="Đơn hàng sẽ bị xóa vĩnh viễn khỏi hệ thống.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa đơn hàng"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
};

export default AdminOrders;
