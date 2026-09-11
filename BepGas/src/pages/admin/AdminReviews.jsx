// Trang quản lý đánh giá sản phẩm cho Admin và Staff.
// Hỗ trợ phân trang, lọc theo sao và tìm kiếm theo tên sản phẩm hoặc người đánh giá.
// Admin và Staff có thể phản hồi đánh giá (adminReply) và xóa đánh giá vi phạm.
// URL có thể có ?highlight=<reviewId> từ deep link trong ReviewSection để scroll đến review đó.

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronUp,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
  Eye, EyeOff,
  Loader,
  MessageSquare,
  Pen,
  Search,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { reviewAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorState from '../../components/ErrorState';
import { toast } from '../../utils/toast';

const PAGE_SIZE = 20;

// parseImageUrls xử lý 3 định dạng imageUrl: JSON array, comma-separated string, hoặc URL đơn.
const parseImageUrls = (imageUrl) => {
  if (!imageUrl) return [];
  const v = imageUrl.trim();
  if (!v) return [];
  if (v.startsWith('[')) {
    try { return JSON.parse(v).filter(Boolean); } catch { return []; }
  }
  return v.includes(',') ? v.split(',').map((u) => u.trim()).filter(Boolean) : [v];
};

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '-';

const ratingBorder = (r) =>
  r <= 2 ? '#fca5a5' : r === 3 ? '#fcd34d' : 'var(--border)';

// ReplyPanel hiển thị phản hồi của shop (view mode) hoặc form soạn phản hồi (edit mode).
const ReplyPanel = ({ rid, existingReply, onSave, onDelete }) => {
  const hasReply = Boolean(existingReply?.trim());
  const [editing, setEditing]   = useState(!hasReply);
  const [text, setText]         = useState(existingReply ?? '');
  const [saving, setSaving]     = useState(false);

  /* Sync khi existingReply thay đổi (sau khi lưu) */
  useEffect(() => {
    setText(existingReply ?? '');
    setEditing(!existingReply?.trim());
  }, [existingReply]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      setSaving(true);
      await onSave(rid, text);
    } catch (err) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setText(existingReply ?? '');
    setEditing(false);
  };

  return (
    <div className="rv-reply-panel">
      {/* Tiêu đề + nút hành động (khi đang xem) */}
      <div className="rv-reply-panel-title">
        <span className="rv-reply-panel-label">
          <MessageSquare size={15} />
          Phản hồi của BếpGasVN
        </span>
        {hasReply && !editing && (
          <div className="rv-reply-panel-actions">
            <button type="button" className="rv-reply-edit-btn" onClick={() => setEditing(true)}>
              <Pen size={12} /> Sửa
            </button>
            <button type="button" className="rv-reply-del-btn" onClick={onDelete}>
              <Trash2 size={12} /> Xóa phản hồi
            </button>
          </div>
        )}
      </div>

      {/* View mode — hiển thị phản hồi hiện tại */}
      {hasReply && !editing ? (
        <p className="rv-reply-view-text">{existingReply}</p>
      ) : (
        /* Edit mode — textarea nhập phản hồi */
        <>
          <textarea
            className="rv-reply-textarea"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            placeholder="Nhập nội dung phản hồi đến khách hàng..."
            rows={4}
            autoFocus={hasReply}
          />
          <div className="rv-reply-footer">
            {hasReply && (
              <button type="button" className="rv-reply-cancel-btn" onClick={handleCancel}>
                Hủy
              </button>
            )}
            <span className="rv-reply-count">{text.length}/1000</span>
            <button
              type="button"
              className="rv-reply-submit"
              onClick={handleSend}
              disabled={saving || !text.trim()}
            >
              {saving ? <Loader size={13} className="spin" /> : <Send size={13} />}
              {hasReply ? 'Cập nhật' : 'Gửi phản hồi'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════ */
const AdminReviews = () => {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = Number(searchParams.get('highlight')) || null;
  const highlightRef = useRef(null);

  const [reviews, setReviews]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [activeTab, setActiveTab]       = useState(
    searchParams.get('replied') === 'false' ? 'unreplied' : 'all'
  );
  const [ratingFilter, setRating]       = useState(0);
  const [sortOrder, setSort]            = useState('newest');
  const [expandedId, setExpandedId]     = useState(null);
  const [toggling, setToggling]         = useState(null);
  const [deleting, setDeleting]         = useState(null);
  const [deleteId, setDeleteId]         = useState(null);       /* xóa đánh giá */
  const [deleteReplyId, setDeleteReplyId] = useState(null);     /* xóa phản hồi */
  const [deletingReply, setDeletingReply] = useState(null);
  const [page, setPage]                 = useState(1);

  /* ── Tải dữ liệu ── */
  const fetchReviews = () => {
    setError('');
    setLoading(true);
    reviewAPI.adminGetAll(0, 200)
      .then((res) => {
        const raw = res?.data?.content ?? res?.content ?? res?.data ?? [];
        setReviews(raw.map((r) => ({ ...r, isVisible: r.isVisible ?? r.visible ?? true })));
      })
      .catch((err) => { setError(err.message); toast.error('Không tải được danh sách đánh giá'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, []);

  useEffect(() => {
    if (!highlightId || loading) return;
    const exists = reviews.some((r) => (r.reviewId ?? r.id) === highlightId);
    if (!exists) { toast.warn(`Đánh giá #${highlightId} không tìm thấy`); return; }
    setExpandedId(highlightId);
    const t = setTimeout(
      () => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      150
    );
    return () => clearTimeout(t);
  }, [highlightId, loading, reviews]);

  /* ── Tab counts ── */
  const counts = {
    all:       reviews.length,
    unreplied: reviews.filter((r) => !r.adminReply?.trim()).length,
    low:       reviews.filter((r) => r.rating <= 3).length,
    hidden:    reviews.filter((r) => !r.isVisible).length,
  };

  /* ── Lọc ── */
  const filtered = reviews.filter((r) => {
    const keyword = search.trim().toLowerCase();
    const matchSearch = !keyword ||
      (r.user?.fullName ?? r.user?.name ?? '').toLowerCase().includes(keyword) ||
      (r.user?.email ?? '').toLowerCase().includes(keyword) ||
      (r.product?.productName ?? '').toLowerCase().includes(keyword) ||
      (r.comment ?? '').toLowerCase().includes(keyword);
    const matchTab =
      activeTab === 'unreplied' ? !r.adminReply?.trim()
      : activeTab === 'low'     ? r.rating <= 3
      : activeTab === 'hidden'  ? !r.isVisible
      : true;
    const matchRating = ratingFilter === 0 ? true : r.rating === ratingFilter;
    return matchSearch && matchTab && matchRating;
  });

  /* ── Sắp xếp ── */
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'oldest')      return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === 'rating_low')  return a.rating - b.rating;
    if (sortOrder === 'rating_high') return b.rating - a.rating;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const resetPage  = () => setPage(1);

  /* ── Handlers ── */
  const handleToggle = async (id) => {
    try {
      setToggling(id);
      const res = await reviewAPI.adminToggleVisible(id);
      const updated = res?.data ?? res;
      const nowVisible = updated.isVisible ?? updated.visible;
      setReviews((prev) =>
        prev.map((r) => (r.reviewId ?? r.id) === id ? { ...r, isVisible: nowVisible } : r)
      );
      toast.success(nowVisible ? 'Đã hiện đánh giá.' : 'Đã ẩn đánh giá.');
    } catch (err) { toast.error(`Lỗi: ${err.message}`); }
    finally { setToggling(null); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(deleteId);
      await reviewAPI.adminDelete(deleteId);
      setReviews((prev) => prev.filter((r) => (r.reviewId ?? r.id) !== deleteId));
      setDeleteId(null);
      toast.success('Đã xóa đánh giá.');
    } catch (err) { toast.error(`Lỗi xóa: ${err.message}`); }
    finally { setDeleting(null); }
  };

  const handleSaveReply = async (id, text) => {
    const clean = text.trim();
    const res = await reviewAPI.adminReply(id, clean);
    const updated = res?.data ?? res;
    setReviews((prev) =>
      prev.map((r) =>
        (r.reviewId ?? r.id) === id
          ? { ...r, adminReply: updated.adminReply ?? (clean || null) }
          : r
      )
    );
    toast.success(clean ? 'Đã lưu phản hồi.' : 'Đã xóa phản hồi.');
  };

  const handleDeleteReply = async () => {
    if (!deleteReplyId) return;
    try {
      setDeletingReply(deleteReplyId);
      const res = await reviewAPI.adminReply(deleteReplyId, '');
      const updated = res?.data ?? res;
      setReviews((prev) =>
        prev.map((r) =>
          (r.reviewId ?? r.id) === deleteReplyId
            ? { ...r, adminReply: updated.adminReply ?? null }
            : r
        )
      );
      setDeleteReplyId(null);
      toast.success('Đã xóa phản hồi.');
    } catch (err) { toast.error(`Lỗi: ${err.message}`); }
    finally { setDeletingReply(null); }
  };

  /* ── Tabs ── */
  const TABS = [
    { key: 'all',       label: 'Tất cả' },
    { key: 'unreplied', label: 'Chưa phản hồi' },
    { key: 'low',       label: 'Đánh giá thấp (≤ 3★)' },
    { key: 'hidden',    label: 'Đã ẩn' },
  ];

  const validRatings = (tab) => tab === 'low' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5];

  if (loading) return <div className="admin-page admin-center"><Loader size={32} className="spin" /></div>;
  if (error)   return <div className="admin-page admin-center"><ErrorState message={error} onRetry={fetchReviews} /></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Quản lý đánh giá</h1>
          <p className="ap-subtitle">Quản lý và phản hồi đánh giá sản phẩm từ khách hàng</p>
        </div>
      </div>

      {/* Search — chiếm toàn bộ chiều rộng */}
      <div className="admin-search rv-search-full">
        <Search size={17} />
        <input
          placeholder="Tìm kiếm: tên khách hàng, sản phẩm, nội dung..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
        />
        {search && (
          <button type="button"
            onClick={() => { setSearch(''); resetPage(); }}
            style={{ border: 0, background: 'transparent', color: 'var(--text-light)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs (trái) + bộ lọc thêm (phải) */}
      <div className="rv-tabs-bar">
        <div className="rv-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button"
              className={`rv-tab${activeTab === t.key ? ' rv-tab-active' : ''}`}
              onClick={() => {
                setActiveTab(t.key); resetPage();
                if (!validRatings(t.key).includes(ratingFilter)) setRating(0);
              }}>
              {t.label}
              <span className="rv-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="rv-sort-wrap">
          {filtered.length !== reviews.length && (
            <span className="rv-result-count">{filtered.length} kết quả</span>
          )}
          <select className="admin-select" value={ratingFilter}
            onChange={(e) => { setRating(Number(e.target.value)); resetPage(); }}>
            <option value={0}>Sao: Tất cả</option>
            {[5, 4, 3, 2, 1].map((s) => (
              <option key={s} value={s} disabled={!validRatings(activeTab).includes(s)}>
                {s} sao{!validRatings(activeTab).includes(s) ? ' (không khớp tab)' : ''}
              </option>
            ))}
          </select>
          <select className="admin-select" value={sortOrder}
            onChange={(e) => { setSort(e.target.value); resetPage(); }}>
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="rating_low">Sao thấp nhất</option>
            <option value="rating_high">Sao cao nhất</option>
          </select>
        </div>
      </div>

      {/* Danh sách card */}
      <div className="rv-list">
        {pageItems.length === 0 ? (
          <div className="rv-empty">Không tìm thấy đánh giá phù hợp</div>
        ) : pageItems.map((r) => {
          const rid        = r.reviewId ?? r.id;
          const name       = r.user?.fullName ?? r.user?.name ?? 'Ẩn danh';
          const initial    = name.trim()[0]?.toUpperCase() ?? '?';
          const images     = parseImageUrls(r.imageUrl);
          const hasReply   = Boolean(r.adminReply?.trim());
          const isExp      = expandedId === rid;
          const productImg = r.product?.imageUrl ?? r.product?.productImage ?? r.product?.thumbnailUrl ?? null;
          const toggleExpand = () => setExpandedId(isExp ? null : rid);

          return (
            <div
              key={rid}
              ref={highlightId === rid ? highlightRef : null}
              className={`rv-card${!r.isVisible ? ' rv-card-hidden' : ''}${highlightId === rid ? ' rv-deep-link-highlight' : ''}`}
              style={{ borderLeftColor: ratingBorder(r.rating) }}
            >
              {/* ── Header ── */}
              <div className="rv-card-header">
                <div className="rv-card-summary" onClick={toggleExpand}>

                  {/* Avatar + tên */}
                  <div className="rv-card-user">
                    <div className="rv-avatar">{initial}</div>
                    <div className="rv-user-info">
                      <span className="rv-user-name">{name}</span>
                      <span className="rv-user-email">{r.user?.email ?? ''}</span>
                      {r.verifiedPurchase && <span className="rv-verified">✓ Đã mua hàng</span>}
                    </div>
                  </div>

                  {/* Ảnh sản phẩm */}
                  {productImg && (
                    <div className="rv-product-thumb">
                      <img src={productImg} alt="" />
                    </div>
                  )}

                  {/* Tên sp + sao + comment preview */}
                  <div className="rv-card-main">
                    <span className="rv-product-name">{r.product?.productName ?? '—'}</span>
                    <div className="rv-stars">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={15} fill={s <= r.rating ? '#f59e0b' : 'none'} color="#f59e0b" />
                      ))}
                    </div>
                    {r.comment && <p className="rv-comment">{r.comment}</p>}
                    {hasReply && !isExp && (
                      <p className="rv-admin-reply-preview">↩ {r.adminReply}</p>
                    )}
                  </div>

                  {/* Badges + ngày */}
                  <div className="rv-card-meta">
                    {hasReply
                      ? <span className="rv-meta-badge rv-meta-replied">Đã phản hồi</span>
                      : <span className="rv-meta-badge rv-meta-unreplied">Chưa phản hồi</span>}
                    {r.isVisible
                      ? <span className="rv-meta-badge rv-meta-visible">Hiển thị</span>
                      : <span className="rv-meta-badge rv-meta-hidden">Đã ẩn</span>}
                    <span className="rv-date">{fmtDate(r.createdAt)}</span>
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="rv-card-btns" onClick={(e) => e.stopPropagation()}>
                  <button type="button"
                    className={`rv-btn-reply${isExp ? ' rv-btn-reply-active' : ''}`}
                    onClick={toggleExpand}>
                    <MessageSquare size={16} />
                    Phản hồi
                  </button>
                  <button type="button" className="rv-btn-visibility"
                    onClick={() => handleToggle(rid)} disabled={toggling === rid}>
                    {toggling === rid
                      ? <Loader size={15} className="spin" />
                      : r.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    {r.isVisible ? 'Ẩn' : 'Hiện'}
                  </button>
                  {isAdmin && (
                    <button type="button" className="rv-btn-delete"
                      onClick={() => setDeleteId(rid)} disabled={deleting === rid}
                      title="Xóa đánh giá">
                      {deleting === rid ? <Loader size={15} className="spin" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>

                <button type="button" className="rv-expand-btn" onClick={toggleExpand}>
                  {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* ── Body mở rộng ── */}
              {isExp && (
                <div className="rv-card-body">

                  {/* Bình luận đầy đủ */}
                  {r.comment && (
                    <div className="rv-body-comment">
                      <p className="rv-body-comment-label">Bình luận</p>
                      <p className="rv-body-comment-text">{r.comment}</p>
                    </div>
                  )}

                  {/* Grid: ảnh bên trái + phản hồi bên phải */}
                  <div className={`rv-body-grid${images.length === 0 ? ' rv-body-no-img' : ''}`}>
                    {images.length > 0 && (
                      <div className="rv-body-left">
                        <p className="rv-section-label">Hình ảnh đính kèm ({images.length})</p>
                        <div className="rv-imgs">
                          {images.map((url, i) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt={`Ảnh ${i + 1}`} className="rv-proof-img" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="rv-body-right">
                      <ReplyPanel
                        rid={rid}
                        existingReply={r.adminReply ?? ''}
                        onSave={handleSaveReply}
                        onDelete={() => setDeleteReplyId(rid)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="rv-pagination">
          <button disabled={safePage === 1} onClick={() => setPage(1)}><ChevronFirst size={15} /></button>
          <button disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={15} /></button>
          <span className="rv-page-info">Trang {safePage} / {totalPages}</span>
          <button disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={15} /></button>
          <button disabled={safePage === totalPages} onClick={() => setPage(totalPages)}><ChevronLast size={15} /></button>
        </div>
      )}

      {/* Modal xác nhận xóa đánh giá */}
      <ConfirmModal
        open={!!deleteId}
        title="Xóa đánh giá"
        message="Đánh giá và toàn bộ phản hồi sẽ bị xóa vĩnh viễn.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa đánh giá"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={!!deleting}
      />

      {/* Modal xác nhận xóa phản hồi */}
      <ConfirmModal
        open={!!deleteReplyId}
        title="Xóa phản hồi"
        message="Phản hồi của BếpGasVN đối với đánh giá này sẽ bị xóa.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa phản hồi"
        onConfirm={handleDeleteReply}
        onCancel={() => setDeleteReplyId(null)}
        loading={!!deletingReply}
      />
    </div>
  );
};

export default AdminReviews;
