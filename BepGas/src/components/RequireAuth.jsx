import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Bảo vệ route yêu cầu đăng nhập — redirect về /login nếu chưa xác thực
export const RequireAuth = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

// Bảo vệ route khu quản trị — cho phép cả ADMIN lẫn STAFF (isManager = isAdmin || isStaff).
// Tên RequireAdmin giữ nguyên để không phá các import hiện có.
// Phân quyền chi tiết từng endpoint xử lý ở backend (SecurityConfig + @PreAuthorize).
export const RequireAdmin = ({ children }) => {
  const { isLoggedIn, isManager } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  if (!isManager) return <Navigate to="/" replace />;
  return children;
};