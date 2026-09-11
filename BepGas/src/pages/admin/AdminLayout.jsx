// AdminLayout là khung layout chung bao ngoài tất cả các trang trong khu vực quản trị.
// Gồm sidebar điều hướng bên trái và vùng nội dung bên phải nơi các trang con được render.
// Kiểm tra quyền ngay khi vào: chỉ ADMIN hoặc STAFF mới được phép, người khác bị redirect về login.

// NavLink giống Link nhưng tự thêm class active khi đường dẫn khớp, dùng để đánh dấu mục đang chọn.
// Outlet là vùng chứa nội dung của trang con, React Router sẽ render trang con tương ứng vào đây.
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';

// Các icon Lucide cho từng mục trong sidebar.
import { LayoutDashboard, Package, ShoppingBag, Users, LogOut, Flame, ChevronRight, LayoutGrid, Award, Megaphone, Tag, Star, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import LogoutDialog from '../../components/LogoutDialog';

// Danh sách mục điều hướng cho tài khoản ADMIN, có toàn quyền truy cập tất cả trang.
// end: true ở Dashboard nghĩa là chỉ active khi URL khớp chính xác /admin, không khớp /admin/products.
const adminNavItems = [
  { to: '/admin',            icon: LayoutDashboard, label: 'Dashboard',   end: true },
  { to: '/admin/products',   icon: Package,         label: 'Sản phẩm'    },
  { to: '/admin/categories', icon: LayoutGrid,      label: 'Danh mục'    },
  { to: '/admin/brands',     icon: Award,           label: 'Thương hiệu' },
  { to: '/admin/orders',     icon: ShoppingBag,     label: 'Đơn hàng'    },
  { to: '/admin/coupons',    icon: Tag,             label: 'Khuyến mãi'  },
  { to: '/admin/banners',    icon: Megaphone,       label: 'Quảng cáo'   },
  { to: '/admin/reviews',    icon: Star,            label: 'Đánh giá'    },
  { to: '/admin/users',      icon: Users,           label: 'Tài khoản'   },
];

// Danh sách mục điều hướng cho tài khoản STAFF, chỉ có quyền xem đơn hàng, tài khoản và đánh giá.
const staffNavItems = [
  { to: '/admin/orders',  icon: ShoppingBag, label: 'Đơn hàng'  },
  { to: '/admin/users',   icon: Users,       label: 'Tài khoản' },
  { to: '/admin/reviews', icon: Star,        label: 'Đánh giá'  },
];

const AdminLayout = () => {
  // Lấy thông tin người dùng và các flag quyền từ context xác thực.
  const { user, logout, isLoggedIn, isAdmin, isStaff, isManager } = useAuth();
  const navigate = useNavigate();

  // confirmLogout kiểm soát có hiện dialog xác nhận đăng xuất không.
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Nếu người dùng chưa đăng nhập hoặc không có quyền quản trị thì redirect về trang đăng nhập.
  // useEffect theo dõi isLoggedIn và isManager, khi thay đổi thì kiểm tra lại.
  useEffect(() => {
    if (!isLoggedIn || !isManager) {
      navigate('/admin/login');
    }
  }, [isLoggedIn, isManager, navigate]);

  // Trả về null trong lúc đang redirect để không render giao diện admin cho người không có quyền.
  if (!isLoggedIn || !isManager) return null;

  // Staff không được xem Dashboard tổng quan, tự động chuyển sang trang đơn hàng.
  if (isStaff && window.location.pathname === '/admin') {
    return <Navigate to="/admin/orders" replace />;
  }

  // Chọn danh sách menu phù hợp với role của người đang đăng nhập.
  const navItems = isAdmin ? adminNavItems : staffNavItems;

  return (
    <div className="admin-layout">
      {/* Sidebar bên trái chứa logo, menu điều hướng và thông tin người dùng. */}
      <aside className="admin-sidebar">
        {/* Logo thương hiệu ở đầu sidebar. */}
        <div className="admin-logo">
          <Flame size={24} color="#e85d04" />
          <span>BếpGas <strong>Admin</strong></span>
        </div>

        {/* Danh sách các mục điều hướng, NavLink tự động thêm class admin-nav-active
            khi người dùng đang ở trang tương ứng với đường dẫn đó. */}
        <nav className="admin-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'admin-nav-active' : ''}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              <ChevronRight size={15} className="admin-nav-arrow" />
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar hiện avatar, tên và role của người đang đăng nhập,
            cùng nút đăng xuất mở dialog xác nhận trước khi thực sự đăng xuất. */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-avatar">{user.avatar}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{isAdmin ? 'Quản trị viên' : 'Nhân viên'}</span>
            </div>
          </div>
          <button className="admin-logout" onClick={() => setConfirmLogout(true)}>
            <LogOut size={17} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Vùng nội dung chính bên phải, React Router render trang con tương ứng vào đây. */}
      <main className="admin-main">
        <Outlet />
      </main>

      {/* Dialog xác nhận đăng xuất, chỉ hiện khi confirmLogout là true.
          Nếu xác nhận thì gọi logout() rồi về trang chủ, nếu huỷ thì đóng dialog. */}
      <LogoutDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => { logout(); navigate('/'); }}
      />
    </div>
  );
};

export default AdminLayout;
