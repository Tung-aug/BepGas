// SkeletonCard là card giữ chỗ hiển thị khi đang tải danh sách sản phẩm.
// Dùng hiệu ứng shimmer thay vì spinner để trang trông có nội dung ngay từ đầu,
// giúp người dùng cảm giác ứng dụng phản hồi nhanh hơn thực tế.

const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="sk-img sk-shimmer" />
    <div className="sk-body">
      <div className="sk-shimmer" style={{ height: 14, width: '80%', borderRadius: 4, marginBottom: 8 }} />
      <div className="sk-shimmer" style={{ height: 12, width: '55%', borderRadius: 4, marginBottom: 16 }} />
      <div className="sk-shimmer" style={{ height: 22, width: '50%', borderRadius: 4, marginBottom: 8 }} />
      <div className="sk-shimmer" style={{ height: 12, width: '35%', borderRadius: 4, marginBottom: 20 }} />
      <div className="sk-shimmer" style={{ height: 40, width: '100%', borderRadius: 8 }} />
    </div>
  </div>
);

export default SkeletonCard;
