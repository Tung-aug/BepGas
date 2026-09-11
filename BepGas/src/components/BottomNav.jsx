// Thanh điều hướng cố định ở đáy màn hình dành cho người dùng mobile.
// Chỉ hiển thị trên màn hình nhỏ — desktop dùng Header thay thế.
// Gồm 5 nút: Trang chủ, Sản phẩm, Tìm kiếm (popup riêng), Giỏ hàng, Tài khoản.

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Search, ShoppingCart, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const BottomNav = () => {
  const { totalItems }   = useCart();
  const { isLoggedIn }   = useAuth();
  const navigate         = useNavigate();
  // searchOpen kiểm soát việc hiện/ẩn ô tìm kiếm nổi lên từ đáy.
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ]        = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (q.trim()) {
      // Điều hướng sang trang sản phẩm với query tìm kiếm rồi reset trạng thái ô tìm kiếm.
      navigate(`/products?search=${encodeURIComponent(q.trim())}`);
      setQ('');
      setSearchOpen(false);
    }
  };

  return (
    <>
      {/* Overlay tìm kiếm nổi lên từ đáy */}
      {searchOpen && (
        <div className="bn-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="bn-search-box" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSearch} style={{ display: 'flex', flex: 1, gap: 8 }}>
              <Search size={18} style={{ color: 'var(--text-light)', flexShrink: 0, marginTop: 2 }} />
              <input
                autoFocus
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Tìm kiếm sản phẩm bếp, nồi cơm..."
              />
            </form>
            <button className="bn-search-close" onClick={() => setSearchOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
          <Home size={21} />
          <span>Trang chủ</span>
        </NavLink>

        <NavLink to="/products" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
          <LayoutGrid size={21} />
          <span>Sản phẩm</span>
        </NavLink>

        <button className="bn-item bn-search-btn" onClick={() => setSearchOpen(true)}>
          <Search size={21} />
          <span>Tìm kiếm</span>
        </button>

        <NavLink to="/cart" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
          <div className="bn-cart-wrap">
            <ShoppingCart size={21} />
            {/* Badge số lượng chỉ hiện khi đã đăng nhập và có sản phẩm trong giỏ, giới hạn hiển thị 9+. */}
            {isLoggedIn && totalItems > 0 && (
              <span className="bn-badge">{totalItems > 9 ? '9+' : totalItems}</span>
            )}
          </div>
          <span>Giỏ hàng</span>
        </NavLink>

        {/* Nút tài khoản chuyển về /account nếu đã đăng nhập, còn không thì về /login. */}
        <NavLink
          to={isLoggedIn ? '/account' : '/login'}
          className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}
        >
          <User size={21} />
          <span>{isLoggedIn ? 'Tài khoản' : 'Đăng nhập'}</span>
        </NavLink>
      </nav>
    </>
  );
};

export default BottomNav;
