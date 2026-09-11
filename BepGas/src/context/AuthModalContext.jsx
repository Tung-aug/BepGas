import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogIn, UserPlus } from 'lucide-react';

const AuthModalContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used inside AuthModalProvider');
  return ctx;
};

// Modal nhắc đăng nhập — hiển thị khi người dùng chưa đăng nhập mà thực hiện hành động yêu cầu xác thực.
const AuthModal = ({ open, onClose }) => {
  const navigate = useNavigate();

  // Đóng bằng phím Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Khoá cuộn body khi modal mở
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const goLogin    = () => { onClose(); navigate('/login'); };
  const goRegister = () => { onClose(); navigate('/register'); };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title"
           onClick={e => e.stopPropagation()}>

        {/* Nút đóng */}
        <button className="auth-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>

        {/* Icon + tiêu đề */}
        <div className="auth-modal-icon">🔐</div>
        <h2 id="auth-modal-title" className="auth-modal-title">Vui lòng đăng nhập</h2>
        <p className="auth-modal-desc">
          Bạn cần đăng nhập để sử dụng tính năng này.
          <br />Chưa có tài khoản? Đăng ký miễn phí ngay!
        </p>

        {/* CTA buttons */}
        <div className="auth-modal-btns">
          <button className="auth-modal-btn auth-modal-btn-register" onClick={goRegister}>
            <UserPlus size={17} />
            Đăng ký
          </button>
          <button className="auth-modal-btn auth-modal-btn-login" onClick={goLogin}>
            <LogIn size={17} />
            Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
};

// Provider bọc toàn bộ ứng dụng để bất kỳ component nào cũng có thể gọi showAuthModal().
export const AuthModalProvider = ({ children }) => {
  const [open, setOpen] = useState(false);

  const showAuthModal = useCallback(() => setOpen(true),  []);
  const hideAuthModal = useCallback(() => setOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ showAuthModal, hideAuthModal }}>
      {children}
      <AuthModal open={open} onClose={hideAuthModal} />
    </AuthModalContext.Provider>
  );
};