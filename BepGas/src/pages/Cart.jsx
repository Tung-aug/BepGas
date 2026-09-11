// Trang giỏ hàng cho phép người dùng chọn từng sản phẩm muốn thanh toán.
// Hỗ trợ: chọn/bỏ chọn từng item, áp mã giảm giá, tính phí ship (miễn phí khi ≥ 500k),
// xoá từng item, xoá đã chọn, xoá tất cả (đều có modal xác nhận).
// Gợi ý sản phẩm cùng danh mục ở cuối trang.
// Khách chưa đăng nhập vẫn dùng được giỏ hàng nhưng cần đăng nhập khi bấm "Thanh toán".

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Trash2 cho nút xoá, Plus/Minus cho điều chỉnh số lượng, Tag cho voucher,
// Loader là spinner khi đang kiểm tra mã giảm giá, X để bỏ mã đã áp.
import { Trash2, ShoppingBag, Plus, Minus, Tag, Loader, X, ChevronRight } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { couponAPI, productAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import { useAuthModal } from '../context/AuthModalContext';

// fmt định dạng số tiền sang VNĐ nhanh gọn mà không cần import từ nơi khác.
const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n ?? 0) + 'đ';

const Cart = () => {
  const { items, removeItem, updateQuantity, clearCart } = useCart();
  const { isLoggedIn }  = useAuth();
  const { showAuthModal } = useAuthModal();
  const navigate = useNavigate();

  // selected là Set chứa id các item đang được đánh dấu để thanh toán.
  // Khởi tạo bằng lazy initializer để chọn hết mặc định khi component mount lần đầu.
  const [selected, setSelected] = useState(() => new Set(items.map(i => i.id)));

  // knownItemIdsRef ghi nhớ các id đã thấy, để phân biệt "item mới thêm vào" với "item đã bỏ chọn thủ công".
  // Item mới thêm → tự chọn; item người dùng bỏ chọn thủ công → không tự chọn lại.
  const knownItemIdsRef = useRef(new Set(items.map(i => i.id)));

  // Đồng bộ selected mỗi khi items thay đổi (ví dụ khi cart load từ server lần đầu).
  // Logic: thêm item mới vào selected, bỏ item hết hàng ra khỏi selected, xoá id không còn trong giỏ.
  useEffect(() => {
    const knownIds = knownItemIdsRef.current;
    setSelected(prev => {
      const next  = new Set(prev);
      let changed = false;
      items.forEach(i => {
        if (!knownIds.has(i.id)) {
          if ((i.stockQty ?? 1) > 0) next.add(i.id); // item mới → tự chọn nếu còn hàng
          changed = true;
        }
        if ((i.stockQty ?? 1) === 0 && next.has(i.id)) {
          next.delete(i.id); changed = true; // bỏ check item hết hàng
        }
      });
      const currentIds = new Set(items.map(i => i.id));
      prev.forEach(id => {
        if (!currentIds.has(id)) { next.delete(id); changed = true; } // dọn id không còn trong giỏ
      });
      knownItemIdsRef.current = currentIds;
      return changed ? next : prev; // trả prev nếu không thay đổi để tránh re-render thừa
    });
  }, [items]);

  // confirm lưu thông tin xác nhận đang hiện, null khi đóng modal.
  // type phân biệt ba loại: xoá một item, xoá đã chọn, hoặc xoá tất cả.
  const [confirm, setConfirm] = useState(null);

  const handleConfirmOk = () => {
    if (confirm?.type === 'clear')          clearCart();
    if (confirm?.type === 'remove')         removeItem(confirm.id);
    if (confirm?.type === 'removeSelected') [...selected].forEach(id => removeItem(id));
    setConfirm(null);
  };

  // Gợi ý sản phẩm lấy từ cùng danh mục với sản phẩm đầu tiên trong giỏ.
  // Lọc bỏ sản phẩm đã có trong giỏ để không gợi ý trùng, lấy tối đa 8 sản phẩm.
  const [recommended, setRecommended] = useState([]);
  useEffect(() => {
    const firstCatId = items[0]?.categoryId ?? items[0]?.product?.categoryId;
    const fetchFn = firstCatId
      ? productAPI.getByCategory(firstCatId, 0, 10)
      : productAPI.getAll(0, 10);
    fetchFn.then(res => {
        const list    = res?.data?.content ?? res?.content ?? res?.data ?? [];
        const cartIds = new Set(items.map(i => i.productId ?? i.id));
        setRecommended(list.filter(p => !cartIds.has(p.id ?? p.productId)).slice(0, 8));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]); // chỉ fetch lại khi số lượng item thay đổi, không phải mỗi lần update quantity

  // Các state quản lý luồng nhập và áp mã giảm giá.
  const [couponInput,    setCouponInput]    = useState('');
  const [couponApplied,  setCouponApplied]  = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading,  setCouponLoading]  = useState(false);
  const [couponError,    setCouponError]    = useState('');

  // Khi giỏ hàng trống thì hiện màn hình trống và nút tiếp tục mua sắm.
  if (items.length === 0) return (
    <main className="container cart-empty">
      <ShoppingBag size={72} color="#d1d5db" />
      <h2>Giỏ hàng trống</h2>
      <p>Hãy thêm sản phẩm vào giỏ hàng của bạn</p>
      <Link to="/products" className="btn btn-primary">Tiếp tục mua sắm</Link>
    </main>
  );

  // selectedItems là mảng item đang được check, dùng để tính giá và truyền sang Checkout.
  const selectedItems = items.filter(i => selected.has(i.id));
  const allSelected   = items.length > 0 && items.every(i => selected.has(i.id));

  // Toggle chọn/bỏ chọn tất cả.
  const toggleAll  = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };

  // Toggle chọn/bỏ chọn một item cụ thể.
  const toggleItem = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Tính các mốc giá: tổng theo giá sale, tổng theo giá gốc (để tính % giảm sản phẩm),
  // phí ship (miễn phí nếu tổng sale ≥ 500k), giảm giá voucher (không vượt tổng sale),
  // và tổng cuối cùng cần thanh toán.
  const saleTotal               = selectedItems.reduce((s, i) => s + Number(i.price ?? 0) * i.quantity, 0);
  const originalTotal           = selectedItems.reduce((s, i) => s + Number(i.originalPrice ?? i.price ?? 0) * i.quantity, 0);
  const productDiscount         = Math.max(0, originalTotal - saleTotal);
  const shipping                = saleTotal >= 500000 ? 0 : (saleTotal > 0 ? 30000 : 0);
  const effectiveCouponDiscount = Math.min(couponDiscount, saleTotal);
  const finalTotal              = saleTotal - effectiveCouponDiscount + shipping;

  // handleApplyCoupon gọi API validate mã, lưu số tiền giảm nếu hợp lệ.
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res      = await couponAPI.validate(couponInput.trim(), saleTotal);
      const discount = Number(res?.data ?? 0);
      setCouponDiscount(discount);
      setCouponApplied(couponInput.trim());
    } catch (err) {
      setCouponError(err.message || 'Mã giảm giá không hợp lệ');
      setCouponDiscount(0);
      setCouponApplied('');
    } finally {
      setCouponLoading(false);
    }
  };

  // handleRemoveCoupon xoá mã đã áp và reset toàn bộ state liên quan đến coupon.
  const handleRemoveCoupon = () => {
    setCouponInput('');
    setCouponApplied('');
    setCouponDiscount(0);
    setCouponError('');
  };

  // handleCheckout kiểm tra đăng nhập trước khi chuyển sang trang thanh toán.
  // Lưu selectedItems vào sessionStorage để khôi phục nếu người dùng reload trang thanh toán.
  // Truyền couponCode và couponDiscount qua navigate state để Checkout không cần gọi API lại.
  const handleCheckout = () => {
    if (!isLoggedIn) { showAuthModal(); return; }
    sessionStorage.setItem('checkout_items', JSON.stringify(selectedItems));
    navigate('/checkout', {
      state: {
        couponCode:     couponApplied,
        couponDiscount: effectiveCouponDiscount,
        checkoutItems:  selectedItems,
      },
    });
  };

  return (
    <main className="cart-v2-page">
      <div className="container">

        <nav className="cart-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <ChevronRight size={14} />
          <span>Giỏ hàng</span>
        </nav>

        {/* Banner nhắc đăng nhập cho khách chưa có tài khoản. */}
        {!isLoggedIn && (
          <div className="cart-guest-banner">
            <span>👤 Bạn đang mua với tư cách khách. <Link to="/login" state={{ from: '/cart' }}>Đăng nhập</Link> để lưu giỏ hàng và thanh toán.</span>
          </div>
        )}

        <div className="cart-v2-layout">

          {/* Cột trái: danh sách sản phẩm trong giỏ với checkbox và điều chỉnh số lượng. */}
          <div className="cart-v2-left">

            {/* Header có checkbox chọn tất cả và nút xoá hàng loạt. */}
            <div className="cart-v2-header">
              <label className="cart-check-label">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>Chọn tất cả ({items.length})</span>
              </label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                {selected.size > 0 && !allSelected && (
                  <button className="cart-clear-btn cart-clear-selected"
                    onClick={() => setConfirm({ type: 'removeSelected' })}>
                    <Trash2 size={15} /> Xóa đã chọn ({selected.size})
                  </button>
                )}
                <button className="cart-clear-btn" onClick={() => setConfirm({ type: 'clear' })}>
                  <Trash2 size={15} /> Xóa tất cả
                </button>
              </div>
            </div>

            {/* Danh sách item: item bị bỏ chọn có class cart-item-dimmed để mờ đi. */}
            <div className="cart-v2-items">
              {items.map(item => {
                const unitPrice  = Number(item.price ?? 0);
                const origPrice  = Number(item.originalPrice ?? item.price ?? 0);
                const discount   = origPrice > unitPrice && origPrice > 0
                  ? Math.round(((origPrice - unitPrice) / origPrice) * 100) : 0;
                const isSelected = selected.has(item.id);

                return (
                  <div key={`${item.id}-${item.variantId ?? ''}`}
                    className={`cart-v2-item ${!isSelected ? 'cart-item-dimmed' : ''}`}>

                    <label className="cart-check-label cart-item-check">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)} />
                    </label>

                    {/* Ảnh sản phẩm: hiện placeholder nếu không có ảnh. */}
                    <Link to={`/products/${item.slug ?? item.id}`} className="cart-item-img-wrap">
                      {item.image
                        ? <img src={item.image} alt={item.name} />
                        : <div className="product-img-placeholder" />}
                    </Link>

                    <div className="cart-v2-item-info">
                      <Link to={`/products/${item.slug ?? item.id}`}>
                        <h3 className="cart-item-name">{item.name}</h3>
                      </Link>
                      {item.variantName && (
                        <span className="cart-item-variant">{item.variantName}</span>
                      )}
                      <div className="cart-item-price-col">
                        <div className="cart-price-row-1">
                          <span className="cart-sale-price">{fmt(unitPrice)}</span>
                          {discount > 0 && <span className="price-discount">-{discount}%</span>}
                        </div>
                        {discount > 0 && (
                          <span className="cart-orig-price">{fmt(origPrice)}</span>
                        )}
                      </div>
                    </div>

                    <div className="cart-v2-item-right">
                      {/* Bộ điều chỉnh số lượng: nút trừ disable khi quantity = 1, nút cộng disable khi đạt tồn kho tối đa. */}
                      <div className="qty-control">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        ><Minus size={14}/></button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.stockQty != null && item.quantity >= item.stockQty}
                          title={item.stockQty != null && item.quantity >= item.stockQty ? `Tối đa ${item.stockQty} sản phẩm` : undefined}
                        ><Plus size={14}/></button>
                      </div>
                      {/* Cảnh báo hàng sắp hết khi còn ≤ 5 sản phẩm. */}
                      {item.stockQty != null && item.stockQty <= 5 && item.stockQty > 0 && (
                        <span className="cart-low-stock">Còn {item.stockQty}</span>
                      )}
                      <strong className="cart-item-total">{fmt(unitPrice * item.quantity)}</strong>
                      <button className="cart-remove-btn"
                        onClick={() => setConfirm({ type: 'remove', id: item.id, name: item.name })}>
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cột phải: tóm tắt đơn hàng, voucher và nút thanh toán. */}
          <div className="cart-v2-right">

            {/* Ô nhập mã giảm giá: khi đã áp mã hiện badge với nút xoá; khi chưa có thì hiện ô nhập. */}
            <div className="cart-v2-block">
              <div className="cart-block-title"><Tag size={16} color="var(--primary)"/> Mã giảm giá / Voucher</div>
              {couponApplied ? (
                <div className="coupon-applied">
                  <span><Tag size={13}/> <strong>{couponApplied}</strong> — Giảm {fmt(effectiveCouponDiscount)}</span>
                  <button onClick={handleRemoveCoupon}><X size={14}/></button>
                </div>
              ) : (
                <>
                  <div className="coupon-input-row">
                    <input
                      type="text"
                      placeholder="Nhập mã giảm giá"
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                    />
                    <button onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}>
                      {couponLoading ? <Loader size={14} className="spin"/> : 'Áp dụng'}
                    </button>
                  </div>
                  {couponError && <p className="coupon-error">{couponError}</p>}
                </>
              )}
            </div>

            {/* Bảng tóm tắt giá: tổng gốc, tổng khuyến mãi (tách giảm giá sản phẩm và voucher riêng), phí ship và tổng cuối. */}
            <div className="cart-v2-block">
              <div className="cart-block-title">Thông tin đơn hàng</div>

              {/* Giá gốc */}
              <div className="cart-price-row">
                <span>Tổng tiền hàng</span>
                <span>{fmt(originalTotal)}</span>
              </div>

              {/* Giảm giá sản phẩm (nếu có) */}
              {productDiscount > 0 && (
                <div className="cart-price-row" style={{ color: '#10b981' }}>
                  <span>Giảm giá sản phẩm</span>
                  <span>-{fmt(productDiscount)}</span>
                </div>
              )}

              {/* Tiền hàng sau giảm SP — base để tính voucher */}
              {productDiscount > 0 && (
                <>
                  <div className="cart-price-mini-divider"/>
                  <div className="cart-price-row cart-price-after-discount">
                    <span>Tiền hàng sau giảm</span>
                    <span>{fmt(saleTotal)}</span>
                  </div>
                </>
              )}

              {/* Voucher: tên trên 1 dòng, số tiền + chú thích trên dòng kế */}
              {effectiveCouponDiscount > 0 && (
                <>
                  <div className="cart-price-row cart-voucher-name-row">
                    <span><Tag size={12}/> <strong>{couponApplied}</strong></span>
                  </div>
                  <div className="cart-price-row cart-price-sub" style={{ color: '#10b981' }}>
                    <span>Voucher {productDiscount > 0 ? ' shop' : ''}</span>
                    <span>-{fmt(effectiveCouponDiscount)}</span>
                  </div>
                  <div className="cart-price-mini-divider"/>
                </>
              )}

              {/* Phí vận chuyển */}
              <div className="cart-price-row">
                <span>Phí vận chuyển</span>
                <span className={shipping === 0 && saleTotal > 0 ? 'free-shipping' : ''}>
                  {saleTotal === 0 ? '—' : shipping === 0 ? 'Miễn phí' : fmt(shipping)}
                </span>
              </div>
              {shipping > 0 && saleTotal > 0 && (
                <p className="shipping-note">Mua thêm {fmt(500000 - saleTotal)} để được miễn phí vận chuyển</p>
              )}

              <div className="cart-price-divider"/>
              <div className="cart-price-row cart-price-final">
                <span>Thành tiền</span>
                <span>{fmt(finalTotal)}</span>
              </div>
            </div>

            {/* Cảnh báo chưa chọn sản phẩm nào. */}
            {selectedItems.length === 0 && (
              <p className="cart-no-selection-msg">
                 Bạn chưa chọn sản phẩm nào để thanh toán
              </p>
            )}
            {/* Nhắc đăng nhập cho khách chưa có tài khoản khi đã chọn sản phẩm. */}
            {!isLoggedIn && selectedItems.length > 0 && (
              <p className="cart-login-hint">
                Bạn cần <button className="cart-login-link" onClick={showAuthModal}>đăng nhập</button> để thanh toán
              </p>
            )}
            <button
              className="cart-checkout-btn btn btn-primary"
              onClick={handleCheckout}
              disabled={selectedItems.length === 0}
            >
              Tiến hành thanh toán ({selectedItems.length})
            </button>

            <Link to="/products" className="cart-continue-link">← Tiếp tục mua sắm</Link>
          </div>
        </div>

        {/* Gợi ý sản phẩm liên quan ở cuối trang, chỉ hiện khi có sản phẩm gợi ý. */}
        {recommended.length > 0 && (
          <section className="cart-recommend-section">
            <div className="cart-recommend-header">
              <h2>Có thể bạn cũng thích</h2>
              <Link to="/products" className="cart-recommend-more">Xem tất cả <ChevronRight size={15}/></Link>
            </div>
            <div className="cart-recommend-grid">
              {recommended.map(p => (
                <ProductCard key={p.id ?? p.productId} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal xác nhận xoá, tiêu đề và message thay đổi tuỳ loại xoá (một item / đã chọn / tất cả). */}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.type === 'clear' ? 'Xóa toàn bộ giỏ hàng?' : 'Xóa sản phẩm?'}
        message={confirm?.type === 'clear'
          ? 'Tất cả sản phẩm trong giỏ hàng sẽ bị xóa.<br/>Hành động này <strong>không thể hoàn tác</strong>.'
          : `Xóa <strong>${confirm?.name ?? ''}</strong> khỏi giỏ hàng?<br/>Hành động này <strong>không thể hoàn tác</strong>.`}
        confirmLabel={confirm?.type === 'clear' ? 'Xóa tất cả' : 'Xóa'}
        onConfirm={handleConfirmOk}
        onCancel={() => setConfirm(null)}
      />
    </main>
  );
};

export default Cart;
