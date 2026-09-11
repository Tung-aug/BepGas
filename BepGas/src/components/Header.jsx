// Header sticky ở đầu trang dành cho cả desktop lẫn mobile.
// Desktop dùng mega menu hai cột (danh mục trái, danh mục con + thương hiệu phải).
// Mobile dùng drawer trượt từ trái với accordion cho danh mục con.
// Ô tìm kiếm debounce 280ms trước khi gọi API để tránh spam request.
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Search, X, Flame, LogOut, ChevronDown, LayoutGrid,
  ChevronRight, User, UserPlus, LogIn, Heart, Package,
  Truck, ShieldCheck, RefreshCw, Phone,
} from 'lucide-react';
import LogoutDialog from './LogoutDialog';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useCart }       from '../context/CartContext';
import { useAuth }       from '../context/AuthContext';
import { useCategories } from '../context/CategoryContext';
import { getCategoryEmoji }    from '../constants/emojis';
import { renderCategoryIcon }  from '../constants/categoryIcons';
import { brandAPI, productAPI } from '../services/api';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n ?? 0);

const SEARCH_HINTS = [
  'Tìm kiếm sản phẩm bếp, nồi cơm...',
  'Tìm bếp gas Rinnai, Paloma...',
  'Tìm nồi cơm điện, chảo chống dính...',
  'Tìm máy hút mùi, lò vi sóng...',
  'Tìm bếp từ Sunhouse, Electrolux...',
  'Tìm bình nước nóng, thiết bị nhà bếp...',
];

const Header = () => {
  const { totalItems }               = useCart();
  const { user, logout, isLoggedIn } = useAuth();
  const { categories: allCats, getChildren, refreshCategories } = useCategories();

  const [searchQuery,        setSearchQuery]        = useState('');
  const [suggestions,        setSuggestions]        = useState([]);
  const [suggestOpen,        setSuggestOpen]        = useState(false);
  const [suggestLoading,     setSuggestLoading]     = useState(false);
  const [activeIdx,          setActiveIdx]          = useState(-1);
  const [userDropdown,       setUserDropdown]       = useState(false);
  const [megaOpen,           setMegaOpen]           = useState(false);
  const [activecat,          setActivecat]          = useState(null);
  const [badgePop,           setBadgePop]           = useState(false);
  const [hintIdx,            setHintIdx]            = useState(0);
  const [hintVisible,        setHintVisible]        = useState(true);
  const [megaBrands,         setMegaBrands]         = useState([]);
  const [annClosed,          setAnnClosed]          = useState(false);
  const [mobileDrawerOpen,   setMobileDrawerOpen]   = useState(false);
  const [mobileExpandedCat,  setMobileExpandedCat]  = useState(null);

  const headerRef   = useRef(null);
  const userRef     = useRef(null);
  const megaRef     = useRef(null);
  const searchBarRef = useRef(null);
  const debounceRef  = useRef(null);

  /* Fetch thương hiệu */
  useEffect(() => {
    brandAPI.getAll(0, 100)
      .then(res => {
        const list = res?.data?.content ?? res?.content ?? res?.data ?? [];
        setMegaBrands(Array.isArray(list) ? list.filter(b => b.isActive !== false) : []);
      })
      .catch(() => {});
  }, []);

  /* Placeholder xoay vòng */
  useEffect(() => {
    const t = setInterval(() => {
      setHintVisible(false);
      setTimeout(() => { setHintIdx(i => (i + 1) % SEARCH_HINTS.length); setHintVisible(true); }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  /* Khóa scroll body khi mega menu / mobile drawer mở */
  useEffect(() => {
    document.body.style.overflow = (megaOpen || mobileDrawerOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [megaOpen, mobileDrawerOpen]);

  // Cập nhật CSS variable --mega-top mỗi khi mega menu mở để mega menu luôn khớp vị trí đáy header.
  // Dùng CSS variable thay vì inline style để các component CSS khác cũng có thể tham chiếu.
  useEffect(() => {
    if (megaOpen && headerRef.current) {
      const bottom = headerRef.current.getBoundingClientRect().bottom;
      document.documentElement.style.setProperty('--mega-top', `${bottom}px`);
    }
  }, [megaOpen]);

  // Chỉ refresh danh mục một lần duy nhất trong suốt phiên làm việc khi người dùng mở menu lần đầu.
  // hasMegaRefreshed ref ngăn gọi API lại mỗi khi mở/đóng menu.
  const hasMegaRefreshed = useRef(false);
  useEffect(() => {
    if ((megaOpen || mobileDrawerOpen) && !hasMegaRefreshed.current) {
      hasMegaRefreshed.current = true;
      refreshCategories();
    }
  }, [megaOpen, mobileDrawerOpen, refreshCategories]);

  // badgePop thêm class CSS badge-pop trong 400ms mỗi khi số lượng giỏ hàng thay đổi.
  // Tạo hiệu ứng nảy nhẹ trên badge để người dùng chú ý khi vừa thêm sản phẩm.
  const prevTotalRef = useRef(totalItems);
  useEffect(() => {
    if (totalItems !== prevTotalRef.current) {
      prevTotalRef.current = totalItems;
      setBadgePop(true);
      const t = setTimeout(() => setBadgePop(false), 400);
      return () => clearTimeout(t);
    }
  }, [totalItems]);

  /* Danh mục gốc */
  const categories = useMemo(
    () => allCats.filter(c => c.isActive !== false && !c.parentCategoryId).slice(0, 10),
    [allCats]
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (categories.length > 0 && !activecat) setActivecat(categories[0]);
  }, [categories]);

  const navigate = useNavigate();

  /* Đóng dropdown khi click ngoài */
  useEffect(() => {
    const handler = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserDropdown(false);
      if (megaRef.current && !megaRef.current.contains(e.target)) setMegaOpen(false);
      if (searchBarRef.current && !searchBarRef.current.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeMega = () => setMegaOpen(false);
  const closeMobileDrawer = () => { setMobileDrawerOpen(false); setMobileExpandedCat(null); };

  const closeSuggest = () => { setSuggestOpen(false); setActiveIdx(-1); };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); setSuggestOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res  = await productAPI.search(q.trim(), 0, 6);
        const list = res?.data?.content ?? res?.content ?? res?.data ?? [];
        setSuggestions(Array.isArray(list) ? list : []);
        setSuggestOpen(true);
      } catch { setSuggestions([]); }
      finally { setSuggestLoading(false); }
    }, 280);
  };

  const handleSearchKeyDown = (e) => {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { closeSuggest(); }
    else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      const p = suggestions[activeIdx];
      navigate(`/products/${p.slug ?? p.id ?? p.productId}`);
      setSearchQuery(''); closeSuggest();
    }
  };

  const handleSelectSuggestion = (p) => {
    navigate(`/products/${p.slug ?? p.id ?? p.productId}`);
    setSearchQuery(''); closeSuggest();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      closeSuggest();
      closeMobileDrawer();
    }
  };

  const [confirmLogout, setConfirmLogout] = useState(false);
  const handleLogout = () => { setUserDropdown(false); setConfirmLogout(true); };
  const doLogout     = () => { setConfirmLogout(false); logout(); navigate('/'); };

  const getCatIcon = (c) => {
    const svg = renderCategoryIcon(c, { size: 18, color: 'currentColor' });
    return svg !== null ? svg : getCategoryEmoji(c);
  };

  const getSubcatDisplay = (c) => {
    const imgUrl = c.imageUrl ?? c.image_url ?? '';
    if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('/'))) {
      return <img src={imgUrl} alt={c.categoryName ?? ''} className="msc-img"
        onError={e => { e.currentTarget.style.display = 'none'; }} />;
    }
    const svg = renderCategoryIcon(c, { size: 38, color: 'var(--primary)' });
    return svg !== null ? svg : <span className="msc-emoji">{getCategoryEmoji(c)}</span>;
  };

  const ANN_ITEMS = [
    { icon: <Truck size={13}/>,        text: 'Miễn phí vận chuyển đơn từ 500K' },
    { icon: <ShieldCheck size={13}/>,  text: 'Hàng chính hãng 100%' },
    { icon: <RefreshCw size={13}/>,    text: 'Đổi trả trong 30 ngày' },
    { icon: <Phone size={13}/>,        text: 'Hỗ trợ 1800 1234 — 8:00–22:00' },
  ];

  return (
    <>
      {/* Announcement bar cuộn ngang tự động, ẩn trên mobile vì không đủ chỗ. */}
      {!annClosed && (
        <div className="ann-bar">
          <div className="ann-bar-track">
            {/* Nhân đôi ANN_ITEMS để tạo vòng lặp liền mạch khi CSS animation cuộn hết một lượt. */}
            {[...ANN_ITEMS, ...ANN_ITEMS].map((item, i) => (
              <span key={i} className="ann-bar-item">
                {item.icon} {item.text}
                {i < ANN_ITEMS.length * 2 - 1 && <span className="ann-bar-sep">·</span>}
              </span>
            ))}
          </div>
          <button className="ann-bar-close" onClick={() => setAnnClosed(true)} aria-label="Đóng">
            <X size={14}/>
          </button>
        </div>
      )}

      <header className="header" ref={headerRef}>
        <div className="header-main container">

          {/* Logo */}
          <Link to="/" className="logo">
            <Flame size={30} color="#e85d04" />
            <span>BếpGas<strong>VN</strong></span>
          </Link>

          {/* ── DESKTOP: Nút Danh mục + Mega menu ── */}
          <div className="mega-wrap header-desktop" ref={megaRef}>
            <button
              className={`cat-toggle ${megaOpen ? 'active' : ''}`}
              onClick={() => setMegaOpen(!megaOpen)}
              aria-expanded={megaOpen}
              aria-label="Danh mục sản phẩm"
            >
              <LayoutGrid size={20} />
              <span className="cat-toggle-label">Danh mục</span>
              <ChevronDown size={13} className={megaOpen ? 'chevron-up' : ''} />
            </button>

            {megaOpen && (
              <div className="mega-menu">
                <div className="mega-left">
                  {categories.map(cat => {
                    const cid    = cat.categoryId ?? cat.id;
                    const active = activecat?.categoryId === cid || activecat?.id === cid;
                    return (
                      <button key={cid}
                        className={`mega-cat-item ${active ? 'mega-cat-active' : ''}`}
                        onMouseEnter={() => setActivecat(cat)}
                        onClick={() => { navigate(`/products?category=${cat.slug ?? cid}`); closeMega(); }}
                      >
                        <span className="mega-cat-name">{cat.categoryName ?? cat.name}</span>
                        <ChevronRight size={14} className="mega-cat-arrow" />
                      </button>
                    );
                  })}
                  <Link to="/products" className="mega-view-all" onClick={closeMega}>Tất cả sản phẩm →</Link>
                </div>

                <div className="mega-right">
                  {(() => {
                    const acId    = activecat?.categoryId ?? activecat?.id;
                    const subCats = acId ? getChildren(acId) : [];
                    const catSlug = activecat?.slug ?? acId ?? '';
                    const brands  = megaBrands.slice(0, 8);
                    return (
                      <>
                        <div className="mega-right-head">
                          <span className="mega-right-title">{activecat?.categoryName ?? activecat?.name ?? ''}</span>
                          <Link to={`/products?category=${catSlug}`} className="mega-right-more" onClick={closeMega}>
                            Xem tất cả <ChevronRight size={13}/>
                          </Link>
                        </div>
                        {subCats.length > 0 && (
                          <div className="mega-subcat-grid">
                            {subCats.map(child => {
                              const cid  = child.categoryId ?? child.id;
                              const name = child.categoryName ?? child.name ?? '';
                              return (
                                <Link key={cid} to={`/products?category=${child.slug ?? cid}`}
                                  className="mega-subcat-card" onClick={closeMega}>
                                  <div className="mega-subcat-icon">{getSubcatDisplay(child)}</div>
                                  <span className="mega-subcat-name">{name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                        {brands.length > 0 && (
                          <div className="mega-brands-section">
                            <div className="mega-brands-head">
                              <span>Thương hiệu nổi bật</span>
                              <Link to="/brands" className="mega-right-more" onClick={closeMega}>Tất cả →</Link>
                            </div>
                            <div className="mfpt-brands-chips">
                              {brands.map((b, i) => {
                                const key  = b.id ?? b.brandId ?? b.name ?? i;
                                const name = b.name ?? b.brandName ?? '';
                                const slug = b.slug ?? String(b.id ?? b.brandId ?? '');
                                if (!slug) return null;
                                return (
                                  <Link key={key} to={`/products?brand=${slug}`}
                                    className="mfpt-brand-chip" onClick={closeMega}>
                                    <div className="mfpt-brand-logo-box">
                                      {b.logoUrl ? (
                                        <>
                                          <img src={b.logoUrl} alt={name}
                                            onError={e => {
                                              e.currentTarget.style.display = 'none';
                                              e.currentTarget.nextSibling.style.display = 'block';
                                            }} />
                                          <span className="mfpt-brand-initial" style={{ display:'none' }}>{name}</span>
                                        </>
                                      ) : (
                                        <span className="mfpt-brand-initial">{name}</span>
                                      )}
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {subCats.length === 0 && brands.length === 0 && (
                          <div className="mega-empty">
                            <span>{getCatIcon(activecat ?? {})}</span>
                            <p>Chưa có nội dung</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Search bar — desktop: inline | mobile: wraps xuống hàng 2 */}
          <div className="search-bar-wrap" ref={searchBarRef}>
            <form className="search-bar" onSubmit={handleSearch}>
              <div className="search-hint-wrap">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                  placeholder=""
                  autoComplete="off"
                />
                {!searchQuery && (
                  <span className={`sh-hint ${hintVisible ? 'sh-on' : ''}`}>
                    {SEARCH_HINTS[hintIdx]}
                  </span>
                )}
              </div>
              <button type="submit" aria-label="Tìm kiếm">
                {suggestLoading ? <span className="ss-spin"/> : <Search size={20}/>}
              </button>
            </form>

            {/* Dropdown gợi ý */}
            {suggestOpen && suggestions.length > 0 && (
              <div className="search-suggest-dropdown">
                {suggestions.map((p, i) => {
                  const img = p.primaryImageUrl ?? p.imageUrls?.[0] ?? p.imageUrl ?? '';
                  return (
                    <div key={p.productId ?? p.id ?? i}
                      className={`ssi-item ${i === activeIdx ? 'ssi-active' : ''}`}
                      onMouseDown={() => handleSelectSuggestion(p)}>
                      <div className="ssi-img">
                        {img
                          ? <img src={img} alt={p.name} onError={e => { e.currentTarget.style.display='none'; }}/>
                          : <Search size={15} color="#d1d5db"/>}
                      </div>
                      <div className="ssi-info">
                        <span className="ssi-name">{p.name}</span>
                        <span className="ssi-price">{fmt(p.salePrice ?? p.price)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="ssi-footer"
                  onMouseDown={() => { navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`); setSearchQuery(''); closeSuggest(); }}>
                  <Search size={13}/> Xem tất cả kết quả cho &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </div>
              </div>
            )}
          </div>

          {/* ── DESKTOP: Tài khoản + Giỏ hàng ── */}
          <div className="header-actions header-desktop">
            <div className="user-menu" ref={userRef}>
              <button className="user-btn"
                onClick={() => setUserDropdown(!userDropdown)}
                aria-label={isLoggedIn ? user.name : 'Tài khoản'}
                aria-expanded={userDropdown}>
                {isLoggedIn ? <div className="user-avatar">{user.avatar}</div> : <User size={22} />}
                <span className="user-name">{isLoggedIn ? user.name : 'Tài khoản'}</span>
                <ChevronDown size={15} className={userDropdown ? 'chevron-up' : ''} />
              </button>
              {userDropdown && (
                <div className="user-dropdown">
                  {isLoggedIn ? (
                    <>
                      <div className="dd-user-header">
                        <div className="dd-avatar-v2">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
                        <div className="dd-user-info">
                          <div className="dd-user-name">{user.name}</div>
                          <div className="dd-user-email">{user.email}</div>
                          <div className="dd-member-badge">⭐ Thành viên</div>
                        </div>
                      </div>
                      <div className="dd-menu">
                        <Link to="/account" className="dd-item" onClick={() => setUserDropdown(false)} state={{ tab: 'profile' }}>
                          <span className="dd-item-icon"><User size={15}/></span>
                          <span className="dd-item-label">Thông tin tài khoản</span>
                        </Link>
                        <Link to="/account" className="dd-item" onClick={() => setUserDropdown(false)} state={{ tab:'orders' }}>
                          <span className="dd-item-icon"><Package size={15}/></span>
                          <span className="dd-item-label">Đơn hàng của tôi</span>
                        </Link>
                        <Link to="/wishlist" className="dd-item" onClick={() => setUserDropdown(false)}>
                          <span className="dd-item-icon"><Heart size={15}/></span>
                          <span className="dd-item-label">Yêu thích</span>
                        </Link>
                        <Link to="/cart" className="dd-item" onClick={() => setUserDropdown(false)}>
                          <span className="dd-item-icon"><ShoppingCart size={15}/></span>
                          <span className="dd-item-label">Giỏ hàng</span>
                          {totalItems > 0 && <span className="dd-item-badge">{totalItems}</span>}
                        </Link>
                        <div className="dd-divider" />
                        <button className="dd-item dd-logout" onClick={handleLogout}>
                          <span className="dd-item-icon"><LogOut size={15}/></span>
                          <span className="dd-item-label">Đăng xuất</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="dd-guest-header">
                        <div className="dd-guest-icon"><User size={22}/></div>
                        <div className="dd-guest-title">Chào mừng bạn!</div>
                        <div className="dd-guest-sub">Đăng nhập để mua sắm dễ dàng hơn</div>
                      </div>
                      <div className="dd-guest-actions">
                        <Link to="/login" className="dd-btn-login" onClick={() => setUserDropdown(false)}>
                          <LogIn size={16}/> Đăng nhập
                        </Link>
                        <Link to="/register" className="dd-btn-register" onClick={() => setUserDropdown(false)}>
                          <UserPlus size={15}/> Tạo tài khoản mới
                        </Link>
                      </div>
                      <div className="dd-guest-perks">
                         Đăng ký nhận ưu đãi độc quyền & theo dõi đơn hàng dễ dàng
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <Link to="/cart" className="cart-btn" aria-label="Giỏ hàng">
              <ShoppingCart size={24}/>
              {totalItems > 0 && <span className={`cart-badge${badgePop ? ' badge-pop' : ''}`}>{totalItems}</span>}
              <span className="cart-label">Giỏ hàng</span>
            </Link>
          </div>

          {/* ── MOBILE: icon Danh mục + Giỏ hàng ── */}
          <div className="header-mobile-icons">
            <button
              className="hmi-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Danh mục sản phẩm"
            >
              <LayoutGrid size={22}/>
            </button>
            <Link to="/cart" className="hmi-btn hmi-cart" aria-label="Giỏ hàng">
              <ShoppingCart size={22}/>
              {totalItems > 0 && (
                <span className={`cart-badge${badgePop ? ' badge-pop' : ''}`}>{totalItems}</span>
              )}
            </Link>
          </div>

        </div>{/* end header-main */}
      </header>

      {/* ══ MOBILE: Category Drawer — accordion riêng, không tái dùng mega menu desktop ══ */}
      {mobileDrawerOpen && (
        <div className="mobile-drawer-overlay" onClick={closeMobileDrawer}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>

            {/* Header drawer */}
            <div className="mobile-drawer-head">
              <span className="mobile-drawer-title"><LayoutGrid size={16}/> Danh mục</span>
              <button className="mobile-drawer-close" onClick={closeMobileDrawer} aria-label="Đóng">
                <X size={20}/>
              </button>
            </div>

            {/* Accordion danh mục */}
            <div className="mobile-drawer-body">
              {categories.map(cat => {
                const cid      = cat.categoryId ?? cat.id;
                const children = getChildren(cid);
                const expanded = mobileExpandedCat === cid;
                return (
                  <div key={cid} className="mdc-group">
                    <div className="mdc-row">
                      {/* Click tên → navigate */}
                      <Link
                        to={`/products?category=${cat.slug ?? cid}`}
                        className="mdc-name"
                        onClick={closeMobileDrawer}
                      >
                        {cat.categoryName ?? cat.name}
                      </Link>
                      {/* Nếu có danh mục con → nút expand */}
                      {children.length > 0 && (
                        <button
                          className={`mdc-expand ${expanded ? 'mdc-expanded' : ''}`}
                          onClick={() => setMobileExpandedCat(expanded ? null : cid)}
                          aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
                        >
                          <ChevronDown size={16}/>
                        </button>
                      )}
                    </div>
                    {/* Danh mục con */}
                    {expanded && children.length > 0 && (
                      <div className="mdc-children">
                        {children.map(child => {
                          const childId = child.categoryId ?? child.id;
                          return (
                            <Link
                              key={childId}
                              to={`/products?category=${child.slug ?? childId}`}
                              className="mdc-child"
                              onClick={closeMobileDrawer}
                            >
                              <ChevronRight size={13} style={{flexShrink:0}}/>
                              {child.categoryName ?? child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Link xem tất cả sản phẩm */}
              <Link to="/products" className="mdc-view-all" onClick={closeMobileDrawer}>
                Tất cả sản phẩm →
              </Link>

              {/* Thương hiệu */}
              {megaBrands.length > 0 && (
                <div className="mdc-brands">
                  <div className="mdc-brands-title">Thương hiệu</div>
                  <div className="mdc-brands-chips">
                    {megaBrands.slice(0, 12).map((b, i) => {
                      const key  = b.id ?? b.brandId ?? i;
                      const slug = b.slug ?? String(b.id ?? b.brandId ?? '');
                      const name = b.name ?? b.brandName ?? '';
                      if (!slug) return null;
                      return (
                        <Link key={key} to={`/products?brand=${slug}`}
                          className="mdc-brand-chip" onClick={closeMobileDrawer}>
                          {name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
      <LogoutDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={doLogout}
      />
    </>
  );
};

export default Header;
