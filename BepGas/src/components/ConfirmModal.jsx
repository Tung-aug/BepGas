// Modal xác nhận đa dụng — dùng cho mọi hành động cần người dùng xác nhận trước khi thực hiện.
// Hỗ trợ chế độ nguy hiểm (danger=true, nút đỏ, icon Trash2) và chế độ thông thường (nút xanh).
// Truyền icon riêng qua prop nếu muốn thay icon mặc định.

import { Loader, Trash2, AlertTriangle } from 'lucide-react';

// Props:
//   open         — kiểm soát hiện/ẩn modal từ component cha
//   title        — tiêu đề in đậm phía trên nội dung
//   message      — chuỗi HTML (dùng dangerouslySetInnerHTML) hoặc ReactNode tuỳ ý
//   confirmLabel — nhãn nút xác nhận, mặc định 'Xác nhận'
//   onConfirm    — gọi khi nhấn xác nhận
//   onCancel     — gọi khi nhấn hủy hoặc click overlay
//   danger       — true dùng màu đỏ (xóa, hủy đơn), false dùng màu xanh (cập nhật, duyệt)
//   loading      — true khi đang gọi API, disable cả hai nút và hiện spinner
//   icon         — icon tuỳ chỉnh thay thế icon mặc định (Trash2 hoặc AlertTriangle)
const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  onConfirm,
  onCancel,
  danger   = true,
  loading  = false,
  icon: IconProp,
}) => {
  if (!open) return null;

  // Ưu tiên icon được truyền vào, nếu không có thì chọn theo chế độ danger hay không.
  const Icon = IconProp || (danger ? Trash2 : AlertTriangle);
  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={`cm-icon-wrap ${danger ? 'cm-icon-danger' : 'cm-icon-primary'}`}>
          <Icon size={28} strokeWidth={2} />
        </div>
        <h3 className="cm-title">{title}</h3>
        <div className="cm-message">
          {/* message có thể là chuỗi HTML (ví dụ in đậm tên sản phẩm) hoặc JSX element tuỳ ý. */}
          {typeof message === 'string'
            ? <p dangerouslySetInnerHTML={{ __html: message }} />
            : message}
        </div>
        <div className="cm-actions">
          <button className="cm-btn-cancel" onClick={onCancel} disabled={loading}>Huỷ bỏ</button>
          {/* autoFocus giúp người dùng có thể nhấn Enter ngay để xác nhận mà không cần click. */}
          <button
            className={danger ? 'cm-btn-danger' : 'cm-btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading && <Loader size={14} className="spin" style={{ marginRight: 5 }}/>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
