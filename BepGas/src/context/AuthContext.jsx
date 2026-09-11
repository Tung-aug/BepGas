// Context quản lý trạng thái xác thực toàn cục của ứng dụng.
// rememberMe=true lưu vào localStorage (giữ qua lần đóng tab), false lưu vào sessionStorage (mất khi đóng tab).
// Admin và Staff luôn dùng localStorage bất kể rememberMe để giữ phiên làm việc nhiều tab.

import { createContext, useContext, useState } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Khôi phục user: ưu tiên localStorage (remember me) rồi sessionStorage
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bepgas_user') || sessionStorage.getItem('bepgas_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── ĐĂNG NHẬP — gọi POST /api/auth/login ──────────────
  // rememberMe=true → localStorage (giữ qua lần đóng browser)
  // rememberMe=false → sessionStorage (mất khi đóng tab/browser)
  const login = async (email, password, rememberMe = false) => {
    setLoading(true);
    setError('');
    try {
      const res  = await authAPI.login(email, password);
      const data = res.data;

      const displayName = data.fullName || data.username;
      const userData = {
        id:       data.userId,
        name:     displayName,
        username: data.username,
        email:    data.email,
        phone:    data.phone || '',
        role:     data.role,
        avatar:   displayName?.[0]?.toUpperCase() || 'U',
      };

      // Admin/staff luôn dùng localStorage (cần truy cập nhiều tab)
      const isPrivileged = ['admin', 'staff'].includes((data.role || '').toLowerCase());
      const store      = (rememberMe || isPrivileged) ? localStorage : sessionStorage;
      const otherStore = (rememberMe || isPrivileged) ? sessionStorage : localStorage;
      // Xóa storage còn lại để tránh dữ liệu cũ bị đọc nhầm sau khi đóng trình duyệt
      ['bepgas_token', 'bepgas_user'].forEach(k => otherStore.removeItem(k));
      store.setItem('bepgas_token', data.token);
      setUser(userData);
      store.setItem('bepgas_user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.message || 'Tên đăng nhập hoặc mật khẩu không đúng.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // ── ĐĂNG NHẬP ADMIN — kiểm tra role trước khi lưu state ──
  // Dùng riêng cho /admin/login: không lưu vào storage nếu không phải admin/staff,
  // tránh flash trạng thái đăng nhập rồi logout ngay cho customer.
  const loginAdmin = async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const res  = await authAPI.login(email, password);
      const data = res.data;

      const role = (data.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'staff') {
        return { success: false, message: 'Tài khoản không có quyền truy cập khu vực quản trị.' };
      }

      const displayName = data.fullName || data.username;
      const userData = {
        id:       data.userId,
        name:     displayName,
        username: data.username,
        email:    data.email,
        phone:    data.phone || '',
        role:     data.role,
        avatar:   displayName?.[0]?.toUpperCase() || 'U',
      };
      localStorage.setItem('bepgas_token', data.token);
      setUser(userData);
      localStorage.setItem('bepgas_user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.message || 'Tên đăng nhập hoặc mật khẩu không đúng.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // ── ĐĂNG KÝ — gọi POST /api/auth/register ─────────────
  const register = async (name, phone, email, password) => {
    setLoading(true);
    setError('');
    try {
      const res  = await authAPI.register(name, phone, email, password);
      const data = res.data;

      localStorage.setItem('bepgas_token', data.token);
      const displayName = data.fullName || data.username;
      const userData = {
        id:       data.userId,
        name:     displayName,
        username: data.username,
        email:    data.email,
        phone:    data.phone || '',
        role:     data.role,
        avatar:   displayName?.[0]?.toUpperCase() || 'U',
      };
      setUser(userData);
      localStorage.setItem('bepgas_user', JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Đăng ký thất bại.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // ── ĐĂNG XUẤT — xoá cả hai storage ────────────────────
  const logout = () => {
    setUser(null);
    ['bepgas_user', 'bepgas_token', 'bepgas_cart'].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  };

  // Chuẩn hóa role về chữ hoa để so sánh nhất quán
  // Backend có thể trả về: 'ADMIN', 'ROLE_ADMIN', 'admin', 'CUSTOMER', 'STAFF'...
  const role = user?.role?.replace('ROLE_', '').toUpperCase(); // VD: 'ROLE_ADMIN' → 'ADMIN'

  const isAdmin    = role === 'ADMIN';
  const isStaff    = role === 'STAFF';
  const isCustomer = role === 'CUSTOMER';
  // Admin và Staff đều có quyền vào trang quản lý
  const isManager  = isAdmin || isStaff;

  return (
    <AuthContext.Provider value={{
      user, loading, error, role,
      login, loginAdmin, register, logout,
      isLoggedIn:  !!user,
      isAdmin,
      isStaff,
      isCustomer,
      isManager,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
