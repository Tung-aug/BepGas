// Trang danh sách yêu thích, chỉ dành cho người dùng đã đăng nhập.
// Fetch toàn bộ danh sách yêu thích từ API khi vào trang.
// Khi người dùng bỏ tim một sản phẩm trên ProductCard, sản phẩm đó tự ẩn khỏi danh sách
// nhờ WishlistContext đồng bộ trạng thái tim giữa trang này và các nơi khác trong app.
// Nút "Thêm tất cả vào giỏ" thêm lần lượt từng item với delay nhỏ để tránh spam API giỏ hàng.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Heart là icon trái tim cho tiêu đề và màn hình trống, ShoppingCart cho nút thêm vào giỏ.
import { Heart, ShoppingCart, ChevronRight } from 'lucide-react';
import { useAuth }     from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart }     from '../context/CartContext';
import { wishlistAPI } from '../services/api';
import ProductCard  from '../components/ProductCard';
import SkeletonCard from '../components/SkeletonCard';

const Wishlist = () => {
  const { isLoggedIn } = useAuth();

  // isWishlisted dùng để lọc visibleItems: chỉ hiện sản phẩm vẫn còn trong wishlist context.
  // Khi người dùng bỏ tim từ ProductCard, context cập nhật và sản phẩm tự ẩn.
  const { isWishlisted } = useWishlist();
  const { addItem } = useCart();

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false); // đang thêm tất cả vào giỏ

  // Lấy danh sách yêu thích từ API khi đăng nhập, bỏ qua nếu chưa đăng nhập.
  // Dependency là isLoggedIn để fetch lại khi trạng thái đăng nhập thay đổi.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isLoggedIn) { setLoading(false); return; }
    wishlistAPI.get()
      .then(res => {
        const list = res?.data ?? res ?? [];
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // visibleItems lọc qua isWishlisted để đồng bộ với context khi người dùng bỏ tim từ bất kỳ nơi nào.
  // items là snapshot từ API, còn context là nguồn sự thật của trạng thái tim hiện tại.
  const visibleItems = items.filter(w => isWishlisted(w.productId));

  // handleAddAll thêm tuần tự từng sản phẩm vào giỏ với delay 60ms mỗi item.
  // Dùng for...of thay vì Promise.all để tránh gọi API giỏ hàng cùng lúc quá nhiều.
  const handleAddAll = async () => {
    setAdding(true);
    for (const w of visibleItems) {
      addItem({
        id:            w.productId,
        productId:     w.productId,
        name:          w.productName,
        image:         w.primaryImageUrl,
        slug:          w.slug,
        price:         Number(w.salePrice ?? w.price ?? 0),
        originalPrice: Number(w.price ?? 0),
        quantity:      1,
      });
      await new Promise(r => setTimeout(r, 60));
    }
    setAdding(false);
  };

  // Nếu chưa đăng nhập thì hiện màn hình yêu cầu đăng nhập thay vì màn hình danh sách.
  if (!isLoggedIn) return (
    <main className="container wishlist-page">
      <div className="cart-empty">
        <Heart size={72} color="#d1d5db" />
        <h2>Vui lòng đăng nhập</h2>
        <p>Đăng nhập để xem và quản lý danh sách yêu thích của bạn</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="btn btn-primary">Đăng nhập</Link>
          <Link to="/register" className="btn btn-outline">Tạo tài khoản</Link>
        </div>
      </div>
    </main>
  );

  return (
    <main className="container wishlist-page">

      <nav className="cart-breadcrumb" style={{ marginBottom: '1.25rem' }}>
        <Link to="/">Trang chủ</Link>
        <ChevronRight size={14} />
        <span>Yêu thích</span>
      </nav>

      {/* Header hiện tiêu đề, số lượng sản phẩm và nút thêm tất cả vào giỏ.
          Nút "Thêm tất cả" chỉ hiện khi đã load xong và có ít nhất một sản phẩm. */}
      <div className="wishlist-header">
        <h1>
          <Heart size={24} color="#e85d04" fill="#e85d04" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Danh sách yêu thích
          {!loading && (
            <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-light)', marginLeft: 8 }}>
              ({visibleItems.length} sản phẩm)
            </span>
          )}
        </h1>

        {!loading && visibleItems.length > 0 && (
          <button
            className="btn btn-outline"
            onClick={handleAddAll}
            disabled={adding}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ShoppingCart size={16} />
            {adding ? 'Đang thêm...' : 'Thêm tất cả vào giỏ'}
          </button>
        )}
      </div>

      {/* Ba trạng thái hiển thị: đang tải, danh sách trống, hoặc lưới sản phẩm. */}
      {loading ? (
        // 8 skeleton card giữ chỗ trong khi chờ API trả về dữ liệu.
        <div className="product-grid">
          {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : visibleItems.length === 0 ? (
        // Màn hình trống khi chưa có sản phẩm yêu thích hoặc đã bỏ hết.
        <div className="cart-empty">
          <Heart size={72} color="#d1d5db" />
          <h2>Danh sách yêu thích trống</h2>
          <p>Hãy thêm sản phẩm bạn yêu thích để xem lại sau</p>
          <Link to="/products" className="btn btn-primary">Khám phá sản phẩm</Link>
        </div>
      ) : (
        // Lưới ProductCard: map dữ liệu wishlist sang format product mà ProductCard mong đợi.
        <div className="product-grid">
          {visibleItems.map(w => (
            <ProductCard
              key={w.id ?? w.productId}
              product={{
                id:              w.productId,
                productId:       w.productId,
                name:            w.productName,
                price:           w.price,
                salePrice:       w.salePrice,
                primaryImageUrl: w.primaryImageUrl,
                slug:            w.slug,
                isFeatured:      w.isFeatured,
                soldQty:         0,
                rating:          null,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
};

export default Wishlist;
