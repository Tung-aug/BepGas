// Section đánh giá sản phẩm — nhúng trong trang ProductDetail.
// Gọi onStatsLoad(avg, total) sau khi fetch xong để ProductDetail hiển thị sao và số lượng dưới tên sản phẩm.
// autoOpen=true được truyền vào khi URL có ?review=1 để tự động mở form viết đánh giá.
// Admin và staff thấy link "Xử lý" để mở trang quản trị review ngay từ trang sản phẩm.
import { useState, useEffect, useRef } from 'react';
import { Star, Send, Trash2, Loader, MessageSquare, X, ImagePlus } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { reviewAPI, uploadAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/toast';

/* ── Gợi ý tag đánh giá nhanh ── */
const REVIEW_TAGS = [
  'Sản phẩm tốt',
  'Đóng gói cẩn thận',
  'Giao hàng nhanh',
  'Phục vụ nhiệt tình',
  'Rất hài lòng',
];

const StarRow = ({ star, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rv-bar-row">
      <span className="rv-bar-label"><Star size={13} fill="#f59e0b" color="#f59e0b" /> {star}</span>
      <div className="rv-bar-track">
        <div className="rv-bar-fill" style={{ width: `${pct}%`, background: star >= 4 ? '#f59e0b' : star === 3 ? '#fb923c' : '#ef4444' }} />
      </div>
      <span className="rv-bar-count">{count}</span>
    </div>
  );
};

const ReviewSection = ({ productId, onStatsLoad, autoOpen = false }) => {
  const { isLoggedIn, user } = useAuth();

  const [reviews,    setReviews]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [comment,    setComment]    = useState('');
  const [rating,     setRating]     = useState(5);
  const [hoverStar,  setHoverStar]  = useState(0);
  const [filterStar, setFilterStar] = useState(0); // 0 = tất cả
  const [submitting, setSubmitting] = useState(false);
  const [deleting,      setDeleting]      = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // reviewId cần xóa
  const [error,         setError]         = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [reviewImgs, setReviewImgs] = useState([]); // tối đa 3 ảnh
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgDragOver, setImgDragOver] = useState(false);
  const imgInputRef = useRef(null);

  const fetchReviews = async () => {
    if (!productId) return;
    try {
      const res  = await reviewAPI.getByProduct(productId, 0, 100);
      const page = res?.data ?? res;
      const list = Array.isArray(page) ? page : (page?.content ?? []);
      setReviews(list);
      const totalCount = page?.totalElements ?? list.length;
      setTotal(totalCount);
      // Báo stats lên component cha để hiển thị sao dưới tên sản phẩm
      const avg = list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : 0;
      onStatsLoad?.({ avg, total: totalCount });
    } catch (err) {
      console.error('[ReviewSection] fetchReviews lỗi:', err.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { if (productId) fetchReviews(); }, [productId]);
  useEffect(() => { if (autoOpen && isLoggedIn) setShowForm(true); }, [autoOpen, isLoggedIn]);

  // Thống kê theo sao
  const countByStar = (s) => reviews.filter(r => r.rating === s).length;
  const avgRating   = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : 0;

  const displayed = filterStar === 0 ? reviews : reviews.filter(r => r.rating === filterStar);

  // Kiểm tra user hiện tại đã có review chưa để ẩn form và hiện badge "Đã đánh giá".
  // Mỗi khách hàng chỉ được gửi một đánh giá — backend cũng enforce điều này.
  const alreadyReviewed = isLoggedIn && !!user && reviews.some(r => {
    const rid = String(r.user?.id ?? r.user?.userId ?? '');
    const uid = String(user?.id ?? user?.userId ?? '');
    return rid && uid && rid === uid;
  });

  // Nhấn tag lần đầu thêm vào comment, nhấn lần nữa thì xóa khỏi comment.
  const toggleTag = (text) => {
    setComment(prev => {
      if (prev.includes(text)) {
        return prev.replace(text, '').replace(/\s{2,}/g, ' ').trim();
      }
      const sep = prev && !prev.endsWith(' ') ? '. ' : '';
      return `${prev}${sep}${text}`.slice(0, 3000);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      setSubmitting(true); setError('');
      await reviewAPI.create(productId, { rating, comment, imageUrl: reviewImgs.length ? reviewImgs.join(',') : undefined });
      setComment(''); setRating(5); setReviewImgs([]); setShowForm(false);
      await fetchReviews();
      toast.success('✓ Đã gửi đánh giá thành công!');
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const uploadReviewImg = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (reviewImgs.length >= 3) { toast.warn('Tối đa 3 ảnh mỗi đánh giá'); return; }
    setUploadingImg(true);
    try {
      const res = await uploadAPI.uploadImage(file);
      const url = res?.data ?? res;
      if (typeof url === 'string') setReviewImgs(prev => [...prev, url]);
    } catch (err) { toast.error('Lỗi upload ảnh: ' + err.message); } finally { setUploadingImg(false); }
  };

  const handleDelete = (id) => setConfirmDelete(id);

  const doDelete = async (id) => {
    try {
      setDeleting(id);
      await reviewAPI.delete(id);
      setReviews(prev => prev.filter(r => (r.reviewId ?? r.id) !== id));
      setTotal(t => t - 1);
      toast.success('Đã xóa đánh giá.');
    } catch (err) { toast.error('Lỗi xóa đánh giá: ' + err.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="rv-section">
      <h3 className="rv-title">Đánh giá và bình luận</h3>

      {/* Tóm tắt đánh giá */}
      <div className="rv-summary">
        {/* Cột trái */}
        <div className="rv-summary-left">
          <div className="rv-avg-big">{reviews.length > 0 ? avgRating.toFixed(1) : '0.0'}</div>
          <div className="rv-avg-label">{total} lượt đánh giá</div>
          <div className="rv-avg-stars">
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={20} fill={s <= Math.round(avgRating) ? '#f59e0b' : 'none'} color="#f59e0b"/>
            ))}
          </div>
          {isLoggedIn ? (
            alreadyReviewed ? (
              <span className="rv-write-btn" style={{ background:'#6b7280', cursor:'default' }}>
                ✓ Đã đánh giá
              </span>
            ) : (
              <button className="rv-write-btn" onClick={() => setShowForm(v => !v)}>
                {showForm ? 'Đóng form' : 'Đánh giá sản phẩm'}
              </button>
            )
          ) : (
            <a href="/login" className="rv-write-btn">Đăng nhập để đánh giá</a>
          )}
        </div>

        {/* Cột phải — thanh bar */}
        <div className="rv-summary-right">
          {[5,4,3,2,1].map(s => (
            <StarRow key={s} star={s} count={countByStar(s)} total={total} />
          ))}
        </div>
      </div>

      {/* Form viết đánh giá */}
      {showForm && isLoggedIn && (
        <form className="rv-form" onSubmit={handleSubmit}>
          {/* Cảnh báo đã đánh giá */}
          {alreadyReviewed && (
            <div style={{
              display:'flex', alignItems:'center', gap:'0.4rem',
              background:'#fef2f2', border:'1px solid #fecaca',
              borderRadius:6, padding:'0.45rem 0.75rem',
              fontSize:'0.84rem', color:'#b91c1c', fontWeight:500,
            }}>
              ⚠ Bạn đã đánh giá sản phẩm này rồi. Mỗi khách hàng chỉ được gửi một đánh giá.
            </div>
          )}
          {/* Chọn sao */}
          <div className="rv-form-stars">
            <span style={{ fontSize:'0.875rem', fontWeight:600 }}>Chọn số sao:</span>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} type="button"
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  onClick={() => setRating(s)}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}
                >
                  <Star size={28} fill={s <= (hoverStar || rating) ? '#f59e0b' : 'none'} color="#f59e0b"/>
                </button>
              ))}
              <span style={{
                fontSize:'0.8125rem', fontWeight:600,
                color:'#f97316', background:'#fff7ed',
                padding:'2px 8px', borderRadius:10, marginLeft:2,
              }}>
                {['','Rất tệ','Tệ','Bình thường','Tốt','Rất tốt'][hoverStar || rating]}
              </span>
            </div>
          </div>

          {/* Gợi ý tag nhanh */}
          <div className="rv-tag-row">
            {REVIEW_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                className={`rv-tag-btn ${comment.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="rv-textarea-wrap">
            <label className="rv-textarea-label">Nội dung đánh giá</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 3000))}
              placeholder="Nhập nội dung bình luận hoặc chọn tag gợi ý phía trên..."
              rows={3}
              maxLength={3000}
              className="rv-textarea"
            />
            <span className="rv-char-count">{comment.length}/3000</span>
          </div>

          {/* Ảnh đính kèm — tối đa 3 ảnh, kéo thả hoặc nhấn ô thêm */}
          <div className="rv-img-section">
            <div className="rv-img-list">
              {reviewImgs.map((url, i) => (
                <div key={i} className="rv-img-thumb">
                  <img src={url} alt={`ảnh ${i + 1}`}/>
                  <button type="button" className="rv-img-thumb-del"
                    onClick={() => setReviewImgs(prev => prev.filter((_, j) => j !== i))}>
                    <X size={10}/>
                  </button>
                </div>
              ))}
              {reviewImgs.length < 3 && (
                <div
                  className={`rv-img-add${imgDragOver ? ' drag-over' : ''}${uploadingImg ? ' uploading' : ''}`}
                  onClick={() => !uploadingImg && imgInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setImgDragOver(true); }}
                  onDragLeave={() => setImgDragOver(false)}
                  onDrop={e => { e.preventDefault(); setImgDragOver(false); uploadReviewImg(e.dataTransfer.files[0]); }}
                >
                  {uploadingImg
                    ? <Loader size={18} className="spin"/>
                    : <><ImagePlus size={18}/><span>Thêm ảnh</span></>}
                </div>
              )}
            </div>
            <span className="rv-img-hint">
              {reviewImgs.length > 0
                ? `Đã thêm ${reviewImgs.length}/3 ảnh${reviewImgs.length < 3 ? ' · Nhấn ô thêm để tiếp tục' : ' · Đã đủ giới hạn'}`
                : 'Tối đa 3 ảnh · Kéo thả hoặc nhấn ô vuông để chọn · JPG, PNG, WebP'}
            </span>
            <input ref={imgInputRef} type="file" accept="image/*" style={{ display:'none' }} disabled={uploadingImg}
              onChange={e => { uploadReviewImg(e.target.files?.[0]); e.target.value = ''; }}/>
          </div>

          <div style={{ display:'flex', gap:'0.6rem', justifyContent:'flex-end', alignItems:'center', marginTop:'0.1rem' }}>
            {error && (
              <span style={{
                flex: 1,
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.82rem', color: '#b91c1c',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 6, padding: '0.3rem 0.65rem',
              }}>
                ⚠ {error}
              </span>
            )}
            <button type="button" className="rv-cancel-btn" onClick={() => setShowForm(false)}>Huỷ</button>
            <button type="submit" className="rv-submit-btn" disabled={submitting || !comment.trim() || alreadyReviewed}>
              {submitting ? <Loader size={15} className="spin"/> : <Send size={15}/>} Gửi bình luận
            </button>
          </div>

        </form>
      )}

      {/* Bộ lọc + danh sách */}
      <div className="rv-list-section">
        <div className="rv-filter-bar">
          <strong>{total} Bình luận</strong>
          <div className="rv-filter-btns">
            {[0,5,4,3,2,1].map(s => (
              <button
                key={s}
                className={`rv-filter-btn ${filterStar === s ? 'active' : ''}`}
                onClick={() => setFilterStar(s)}
              >
                {s === 0 ? 'Tất cả' : <>{s} <Star size={12} fill={filterStar===s?'#e85d04':'currentColor'} color="currentColor"/></>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'2rem' }}><Loader size={24} className="spin"/></div>
        ) : displayed.length === 0 ? (
          <div className="rv-empty">
            <Star size={36} color="#d1d5db"/>
            <p>{filterStar > 0 ? `Không có đánh giá ${filterStar} sao` : 'Chưa có đánh giá nào'}</p>
          </div>
        ) : (
          <div className="rv-list">
            {displayed.map(r => {
              const rid  = r.reviewId ?? r.id;
              const name = r.user?.fullName ?? r.user?.name ?? 'Khách hàng';
              const isOwn = user && r.user && String(user.id) === String(r.user?.id ?? r.user?.userId);
              const isStaff = isLoggedIn && (user?.role === 'admin' || user?.role === 'staff');
              return (
                <div key={rid} className="rv-item">
                  <div className="rv-item-top">
                    <div className="rv-avatar">{name[0]?.toUpperCase()}</div>
                    <div className="rv-item-info">
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap' }}>
                        <strong>{name}</strong>
                        {r.verifiedPurchase && (
                          <span className="rv-verified-badge">✓ Đã mua hàng</span>
                        )}
                      </div>
                      <div className="rv-item-stars">
                        {[1,2,3,4,5].map(s => <Star key={s} size={14} fill={s<=r.rating?'#f59e0b':'none'} color="#f59e0b"/>)}
                        <span className="text-light" style={{ fontSize:'0.78rem', marginLeft:4 }}>
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginLeft:'auto' }}>
                      {/* Deep link — chỉ admin/staff thấy, khách hàng không thấy */}
                      {isStaff && (
                        <a
                          href={`/admin/reviews?highlight=${rid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rv-admin-link"
                          title="Mở trong trang quản trị"
                        >
                          ⚙ Xử lý
                        </a>
                      )}
                      {isOwn && (
                        <button className="rv-delete-btn" onClick={() => handleDelete(rid)} disabled={deleting===rid} title="Xóa đánh giá">
                          {deleting===rid ? <Loader size={13} className="spin"/> : <Trash2 size={13}/>}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="rv-comment">{r.comment}</p>
                  {/* imageUrl lưu nhiều URL cách nhau bằng dấu phẩy — split để hiển thị từng ảnh riêng. */}
                  {r.imageUrl && (
                    <div className="rv-img-display">
                      {r.imageUrl.split(',').filter(Boolean).map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt={`ảnh ${i + 1}`}/>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Phản hồi của shop */}
                  {r.adminReply && (
                    <div className="rv-seller-reply">
                      <div className="rv-seller-reply-header">
                        <MessageSquare size={13}/> <strong>Phản hồi từ BếpGasVN</strong>
                      </div>
                      <p className="rv-seller-reply-text">{r.adminReply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Xóa đánh giá của bạn?"
        message="Đánh giá sẽ bị xóa vĩnh viễn và không thể khôi phục.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa đánh giá"
        onConfirm={() => { const id = confirmDelete; setConfirmDelete(null); doDelete(id); }}
        onCancel={() => setConfirmDelete(null)}
        loading={!!deleting}
      />
    </div>
  );
};

export default ReviewSection;