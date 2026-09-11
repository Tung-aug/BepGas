// ToastContainer hiển thị toast notification toàn cục cho toàn bộ ứng dụng.
// Lắng nghe singleton toast emitter (_subscribe) thay vì nhận props, nên chỉ cần đặt 1 lần trong App.jsx.
// Mỗi toast có progress bar thu dần để người dùng biết thông báo sẽ tự đóng sau bao lâu.

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { _subscribe } from '../utils/toast';

// Icon tương ứng với từng loại toast để người dùng nhận biết ngay mức độ thông báo.
const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warn:    AlertTriangle,
  info:    Info,
};

// Màu sắc đồng bộ với icon để tạo visual cue nhất quán cho mỗi loại toast.
const COLORS = {
  success: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  error:   { color: '#dc2626', bg: '#fff1f2', border: '#fecdd3' },
  warn:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  info:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
};

const Toast = ({ toast, onClose }) => {
  const Icon   = ICONS[toast.type] ?? Info;
  const colors = COLORS[toast.type] ?? COLORS.info;

  // Thanh progress bar chạy trong khoảng duration trừ đi 350ms để nhường chỗ cho animation exit.
  const barDuration = Math.max(toast.duration - 350, 500);

  return (
    <div
      className={`toast-item ${toast.exiting ? 'toast-exit' : 'toast-enter'}`}
      style={{ borderLeft: `4px solid ${colors.color}`, background: colors.bg }}
      role="alert"
    >
      <Icon size={18} color={colors.color} style={{ flexShrink: 0 }} />
      <span className="toast-msg">{toast.msg}</span>
      <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="Đóng">
        <X size={15} />
      </button>

      {/* Thanh tiến trình thu dần — trực quan hoá thời gian tồn tại */}
      {!toast.exiting && (
        <div
          className="toast-progress"
          style={{
            background: colors.color,
            animationDuration: `${barDuration}ms`,
          }}
        />
      )}
    </div>
  );
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // dismiss đánh dấu toast đang thoát (exiting=true) trước, đợi 350ms animation rồi mới xóa khỏi mảng.
  // Dùng useCallback để tránh tạo lại hàm mỗi render, giúp Toast không bị re-render không cần thiết.
  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  useEffect(() => {
    // _subscribe đăng ký callback nhận toast mới từ singleton emitter trong utils/toast.ts.
    // Trả về hàm unsub để cleanup khi component unmount — tránh memory leak.
    const unsub = _subscribe((t) => {
      setToasts(prev => [...prev, { ...t, exiting: false }]);

      // Bắt đầu exit animation 350ms trước khi hết duration để animation chạy xong đúng lúc.
      const exitTimer   = setTimeout(() => {
        setToasts(prev => prev.map(x => x.id === t.id ? { ...x, exiting: true } : x));
      }, t.duration - 350);

      // Xóa khỏi DOM sau khi animation exit kết thúc hoàn toàn.
      const removeTimer = setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration);

      return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
    });
    return unsub;
  }, [dismiss]);

  if (!toasts.length) return null;

  return (
    <div className="toast-wrapper" aria-live="polite">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onClose={dismiss} />
      ))}
    </div>
  );
};