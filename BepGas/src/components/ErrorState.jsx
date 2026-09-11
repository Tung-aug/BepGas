// Component hiển thị màn hình lỗi với icon, tiêu đề và nút thử lại.
// Hỗ trợ 4 loại lỗi khác nhau, mỗi loại có icon và màu riêng để dễ phân biệt.

import { WifiOff, AlertTriangle, Clock, RefreshCw, ServerCrash } from 'lucide-react';

// CONFIGS ánh xạ type lỗi sang icon và màu sắc tương ứng.
// Fallback về 'error' nếu type không khớp bất kỳ key nào.
const CONFIGS = {
  error:   { Icon: AlertTriangle, title: 'Không tải được dữ liệu', color: '#ef4444' },
  offline: { Icon: WifiOff,       title: 'Mất kết nối mạng',        color: '#6b7280' },
  timeout: { Icon: Clock,         title: 'Kết nối quá chậm',        color: '#f59e0b' },
  server:  { Icon: ServerCrash,   title: 'Lỗi máy chủ',             color: '#8b5cf6' },
};

// Props:
//   message   — mô tả lỗi chi tiết, không bắt buộc
//   onRetry   — hàm gọi lại khi click "Thử lại", không có thì không hiện nút
//   type      — loại lỗi: 'error' | 'offline' | 'timeout' | 'server'
//   className — class CSS thêm vào nếu cần tuỳ chỉnh layout từ nơi dùng
const ErrorState = ({ message, onRetry, type = 'error', className = '' }) => {
  const { Icon, title, color } = CONFIGS[type] ?? CONFIGS.error;
  return (
    <div className={`error-state ${className}`} role="alert">
      <Icon size={52} color={color} strokeWidth={1.5} aria-hidden="true"/>
      <h3 className="error-state-title">{title}</h3>
      {message && <p className="error-state-msg">{message}</p>}
      {onRetry && (
        <button className="btn btn-outline error-state-retry" onClick={onRetry}>
          <RefreshCw size={15}/> Thử lại
        </button>
      )}
    </div>
  );
};

export default ErrorState;
