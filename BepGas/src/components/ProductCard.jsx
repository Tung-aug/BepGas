// Thẻ sản phẩm dùng chung trên toàn bộ ứng dụng — trang chủ, danh sách, giỏ hàng, wishlist.
// Thêm vào giỏ là optimistic update (cập nhật context ngay lập tức, không đợi API).
// Nếu chưa đăng nhập mà bấm wishlist thì hiện modal yêu cầu đăng nhập.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Heart, Eye, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuthModal } from '../context/AuthModalContext';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n ?? 0);

// Tạo hiệu ứng sóng lan tỏa (ripple) từ đúng điểm click, xóa DOM element sau 600ms.
const spawnRipple = (e) => {
  const btn  = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(btn.clientWidth, btn.clientHeight);
  const el   = document.createElement('span');
  el.className = 'btn-ripple-el';
  el.style.cssText = `
    width:${size}px; height:${size}px;
    left:${e.clientX - rect.left - size / 2}px;
    top:${e.clientY  - rect.top  - size / 2}px;
  `;
  btn.appendChild(el);
  setTimeout(() => el.remove(), 600);
};

const ProductCard = ({ product, badge: badgeOverride }) => {
  const { addItem }              = useCart();
  const { isLoggedIn }           = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const { showAuthModal }        = useAuthModal();

  /* UI states */
  const [added,        setAdded]        = useState(false);   // "Đã thêm" state
  const [heartPopping, setHeartPopping] = useState(false);   // heart pop animation

  const currentPrice = product.salePrice != null ? Number(product.salePrice) : Number(product.price ?? 0);
  const origPrice    = Number(product.price ?? 0);
  const discount     = origPrice > 0 && origPrice > currentPrice
    ? Math.round(((origPrice - currentPrice) / origPrice) * 100) : 0;
  const imgUrl  = product.primaryImageUrl ?? product.imageUrls?.[0] ?? product.image;
  // Ưu tiên badge từ prop (để ghi đè từ ngoài vào), rồi đến product.badge, cuối cùng tự suy từ isFeatured.
  const badge   = badgeOverride !== undefined
    ? badgeOverride
    : (product.badge ?? (product.isFeatured ? 'Nổi bật' : null));
  const pid     = product.id ?? product.productId;
  const linkTo  = product.slug ? `/products/${product.slug}` : `/products/${pid}`;
  const wished  = isWishlisted(pid);
  // Chỉ xem là hết hàng khi stockQty được truyền vào và bằng 0 — undefined nghĩa là không theo dõi tồn kho.
  const isOOS   = product.stockQty !== undefined && product.stockQty === 0;

  /* ── Thêm vào giỏ với ripple + trạng thái "Đã thêm" ──── */
  const handleAddToCart = (e) => {
    if (isOOS) return;
    spawnRipple(e);
    addItem({
      ...product,
      id:            pid,
      productId:     pid,
      image:         imgUrl,
      price:         currentPrice,
      originalPrice: origPrice > currentPrice ? origPrice : null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  /* ── Wishlist toggle với heart pop ───────────────────────*/
  const handleWishlist = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) { showAuthModal(); return; }
    toggle(pid);
    setHeartPopping(true);
    setTimeout(() => setHeartPopping(false), 450);
  };

  return (
    <div className={`product-card${isOOS ? ' card-oos' : ''}`}>

      {/* ── Badge góc trên trái ── */}
      {isOOS
        ? <span className="product-badge badge-oos">Hết hàng</span>
        : (badge && <span className="product-badge">{badge}</span>)
      }

      {/* ── Nút trái tim yêu thích ── */}
      {!isOOS && (
        <button
          className={`wishlist-btn ${wished ? 'wishlisted' : ''} ${heartPopping ? 'heart-pop' : ''}`}
          onClick={handleWishlist}
          title={wished ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          aria-label={wished ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          aria-pressed={wished}
        >
          <Heart size={18} fill={wished ? '#e85d04' : 'none'} color={wished ? '#e85d04' : '#94a3b8'} />
        </button>
      )}

      {/* ── Ảnh sản phẩm + Quick View overlay ── */}
      <Link to={linkTo} tabIndex={-1} aria-hidden="true">
        <div className="product-img-wrap">
          {imgUrl
            ? <img src={imgUrl} alt={product.name} loading="lazy" />
            : <div className="product-img-placeholder" />}

          {/* Quick View — xuất hiện khi hover card */}
          {!isOOS && (
            <span className="product-quick-view">
              <span className="product-quick-view-pill">
                <Eye size={13} /> Xem nhanh
              </span>
            </span>
          )}
        </div>
      </Link>

      {/* ── Thông tin sản phẩm ── */}
      <div className="product-info">
        <Link to={linkTo}>
          <h3 className="product-name">{product.name}</h3>
        </Link>

        {/* Làm tròn rating về bội số 0.5 để hiển thị nửa sao khi cần. */}
        <div className="product-rating">
          {Array(5).fill(0).map((_, i) => {
            const r = Math.round((product.rating ?? 0) * 2) / 2;
            return (
              <Star key={i} size={13}
                fill={i < r ? '#f59e0b' : 'none'}
                color="#f59e0b"
                strokeWidth={i < r ? 0 : 1.5}
              />
            );
          })}
          {product.rating > 0 && (
            <span style={{ fontWeight: 600, fontSize: '0.8rem', marginLeft: 2 }}>
              {Number(product.rating).toFixed(1)}
            </span>
          )}
          {product.reviewCount > 0 && (
            <span className="review-count">({product.reviewCount} đánh giá)</span>
          )}
        </div>

        {/* Cảnh báo còn ít hàng */}
        {product.stockQty !== undefined && product.stockQty <= 5 && product.stockQty > 0 && (
          <span className="stock-low">Còn {product.stockQty} sản phẩm</span>
        )}

        {/* Giá */}
        <div className="product-price">
          <div className="price-row-1">
            <span className="price-current">{fmt(currentPrice)}</span>
            {discount > 0 && <span className="price-discount">-{discount}%</span>}
          </div>
          {discount > 0 && <span className="price-original">{fmt(origPrice)}</span>}
        </div>

        {/* Nút thêm vào giỏ với ripple + success state */}
        <button
          className={`add-to-cart-btn${added ? ' added' : ''}`}
          disabled={isOOS}
          onClick={isOOS ? undefined : handleAddToCart}
          aria-label={isOOS ? 'Hết hàng' : 'Thêm vào giỏ hàng'}
        >
          {isOOS ? (
            'Hết hàng'
          ) : added ? (
            <><Check size={16} /> Đã thêm!</>
          ) : (
            <><ShoppingCart size={16} /> Thêm vào giỏ</>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;