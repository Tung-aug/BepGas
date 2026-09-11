// Trang chi tiết sản phẩm với URL dạng /products/:slug (SEO-friendly).
// Nếu slug là số thuần thì gọi API theo ID, còn lại gọi theo slug.
// Tính năng: lightbox phóng to ảnh, sticky CTA bar khi scroll xuống,
// tab nav điều hướng nội dung, thông tin bảo hành, phí lắp đặt, màu sắc, thông số kỹ thuật và đánh giá.

import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import { Star, ShoppingCart, Truck, ShieldCheck, Package, Heart,
         ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { productAPI }  from '../services/api';
import { useCart }     from '../context/CartContext';
import { useAuth }     from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuthModal } from '../context/AuthModalContext';
import ProductCard    from '../components/ProductCard';
import ReviewSection  from '../components/ReviewSection';

// fmt định dạng tiền tệ kiểu "150.000 ₫" theo locale vi-VN.
const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n ?? 0);

// DetailSkeleton là layout giữ chỗ trong lúc chờ API trả về dữ liệu sản phẩm.
// Dùng sk-shimmer để tạo hiệu ứng loading quen thuộc.
const DetailSkeleton = () => (
  <main className="container product-detail-page">
    <div className="sk-shimmer" style={{ height: 16, width: 240, borderRadius: 6, marginBottom: '1.5rem' }} />
    <div className="detail-grid">
      <div className="sk-shimmer" style={{ borderRadius: 12, aspectRatio: '1', width: '100%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="sk-shimmer" style={{ height: 12, width: '40%', borderRadius: 6 }} />
        <div className="sk-shimmer" style={{ height: 28, width: '90%', borderRadius: 6 }} />
        <div className="sk-shimmer" style={{ height: 28, width: '70%', borderRadius: 6 }} />
        <div className="sk-shimmer" style={{ height: 20, width: '30%', borderRadius: 6, marginTop: 8 }} />
        <div className="sk-shimmer" style={{ height: 40, borderRadius: 8, marginTop: 8 }} />
        <div className="sk-shimmer" style={{ height: 50, borderRadius: 8 }} />
      </div>
    </div>
  </main>
);

// Lightbox là modal phóng to ảnh fullscreen với điều hướng bằng mũi tên bàn phím hoặc nút click.
// Phím Escape đóng lightbox, ArrowLeft/Right chuyển ảnh trước/sau.
// Click vào nền tối (overlay) cũng đóng lightbox, click vào ảnh thì không.
const Lightbox = ({ images, startIdx, onClose }) => {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  setIdx(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft')   setIdx(i => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}><X size={24} /></button>

      {images.length > 1 && (
        <button className="lightbox-arrow lightbox-prev"
          onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}>
          <ChevronLeft size={28} />
        </button>
      )}

      {/* stopPropagation để click vào ảnh không đóng lightbox. */}
      <img src={images[idx]} alt={`Ảnh ${idx + 1}`} className="lightbox-img" onClick={e => e.stopPropagation()} />

      {images.length > 1 && (
        <button className="lightbox-arrow lightbox-next"
          onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}>
          <ChevronRight size={28} />
        </button>
      )}

      {images.length > 1 && (
        <div className="lightbox-dots">
          {images.map((_, i) => (
            <button key={i} className={`lightbox-dot ${i === idx ? 'active' : ''}`}
              onClick={e => { e.stopPropagation(); setIdx(i); }} />
          ))}
        </div>
      )}
    </div>
  );
};

const ProductDetail = () => {
  const { slug }                 = useParams(); // slug hoặc ID từ URL
  const { addItem }              = useCart();
  const { isLoggedIn }           = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const { showAuthModal }        = useAuthModal();
  const [searchParams]           = useSearchParams();
  const location                 = useLocation();

  // openReview = true khi URL có ?review=1, dùng để tự scroll xuống phần đánh giá VÀ tự mở form
  // viết đánh giá — dùng cho link "Đánh giá" (chưa đánh giá) từ Account/OrderDetail.
  const openReview = searchParams.get('review') === '1';
  // scrollToReviews = true khi URL có #reviews — dùng cho link "Xem đánh giá" (đã đánh giá rồi),
  // chỉ cuộn xuống xem, KHÔNG tự mở form viết đánh giá (autoOpen vẫn để false).
  const scrollToReviews = location.hash === '#reviews';

  const [product,      setProduct]      = useState(null);
  const [related,      setRelated]      = useState([]); // sản phẩm liên quan cùng danh mục
  const [selectedImg,  setSelectedImg]  = useState(null); // ảnh đang hiển thị ở khung chính
  const [qty,          setQty]          = useState(1);
  const [added,        setAdded]        = useState(false); // flash "Đã thêm vào giỏ!" trong 2 giây
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [reviewStats,  setReviewStats]  = useState({ avg: 0, total: 0 }); // tổng hợp đánh giá từ ReviewSection
  const [lightboxIdx,  setLightboxIdx]  = useState(null); // null = đóng, số = index ảnh đang mở
  const [stickyVisible, setStickyVisible] = useState(false); // true khi nút CTA đã scroll ra ngoài viewport
  const [activeSection, setActiveSection] = useState(null); // section đang trong viewport cho tab nav

  // ref dùng cho IntersectionObserver: actionsRef để kích sticky bar, 3 ref còn lại cho tab nav.
  const actionsRef = useRef(null);
  const descRef    = useRef(null);
  const specsRef   = useRef(null);
  const reviewRef  = useRef(null);

  // Tải dữ liệu sản phẩm mỗi khi slug thay đổi.
  // Phân biệt slug số (ID) và slug chữ (SEO URL) để gọi đúng API endpoint.
  // Tải song song sản phẩm liên quan sau khi có categoryId, không block render chính.
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(''); setQty(1);
      try {
        const isNumeric = /^\d+$/.test(slug);
        const res = isNumeric ? await productAPI.getById(slug) : await productAPI.getBySlug(slug);
        const p   = res?.data ?? res;
        setProduct(p);
        setSelectedImg(p.primaryImageUrl ?? p.imageUrls?.[0] ?? null);
        if (p.categoryId) {
          productAPI.getByCategory(p.categoryId, 0, 5).then(r => {
            setRelated((r?.data?.content ?? r?.content ?? []).filter(x => x.id !== p.id).slice(0, 4));
          }).catch(() => {});
        }
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    };
    load();
  }, [slug]);

  // IntersectionObserver theo dõi actionsRef: khi khối nút CTA ra khỏi viewport thì hiện sticky bar.
  // Dependency là product vì observer cần element đã render.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [product]);

  // IntersectionObserver theo dõi 3 section để highlight tab nav tương ứng khi scroll.
  // rootMargin cắt bớt vùng top và bottom để section cần chiếm đủ vùng "giữa" mới được tính là active.
  useEffect(() => {
    if (!product) return;
    const refs = [
      { ref: descRef,   id: 'desc'    },
      { ref: specsRef,  id: 'specs'   },
      { ref: reviewRef, id: 'reviews' },
    ];
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.dataset.section);
        });
      },
      { rootMargin: '-15% 0px -65% 0px' }
    );
    refs.forEach(({ ref }) => { if (ref.current) obs.observe(ref.current); });
    return () => obs.disconnect();
  }, [product]);

  // Tự scroll xuống phần đánh giá nếu URL có ?review=1 (chưa đánh giá, sẽ tự mở form luôn — xem
  // autoOpen ở ReviewSection) hoặc #reviews (đã đánh giá, chỉ cuộn xuống xem, không tự mở form).
  // Delay 500ms chờ component render xong rồi mới tính vị trí scroll.
  useEffect(() => {
    if ((!openReview && !scrollToReviews) || !product || !reviewRef.current) return;
    const t = setTimeout(() => scrollToSection(reviewRef), 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReview, scrollToReviews, product]);

  // scrollToSection tính vị trí scroll có tính offset của header cố định (110px).
  const scrollToSection = (ref) => {
    if (!ref.current) return;
    const offset = 110;
    const top = ref.current.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  // handleWishlist toggle yêu thích, nhắc đăng nhập nếu chưa có tài khoản.
  const handleWishlist = () => {
    if (!isLoggedIn) { showAuthModal(); return; }
    toggle(product.id);
  };

  // handleAddToCart thêm sản phẩm vào giỏ với giá sale và giá gốc để tính % giảm trong giỏ.
  // Flash trạng thái "Đã thêm" trong 2 giây rồi trở về trạng thái bình thường.
  const handleAddToCart = () => {
    const salePrice = Number(product?.salePrice ?? product?.price ?? 0);
    const origPrice = Number(product?.price ?? 0);
    addItem({
      id: product.id, productId: product.id,
      name:  product.name ?? product.productName,
      image: selectedImg, slug: product.slug,
      price: salePrice,
      originalPrice: origPrice > salePrice ? origPrice : null,
      quantity: qty,
      requiresInstallation: product.requiresInstallation ?? false,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Hiện skeleton trong lúc loading, trang lỗi nếu không tìm thấy sản phẩm.
  if (loading) return <DetailSkeleton />;
  if (error || !product) return (
    <main className="container" style={{ padding: '4rem', textAlign: 'center' }}>
      <h2>Không tìm thấy sản phẩm</h2>
      <Link to="/products" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>Quay lại</Link>
    </main>
  );

  // Tính giá và % giảm giá để hiển thị.
  const activePrice   = Number(product.salePrice ?? product.price ?? 0);
  const originalPrice = Number(product.price ?? 0);
  const discount      = originalPrice > activePrice
    ? Math.round(((originalPrice - activePrice) / originalPrice) * 100) : 0;
  const maxQty        = product.stockQty > 0 ? product.stockQty : 99;
  const isOOS         = product.stockQty === 0; // out of stock
  const allImages     = product.imageUrls?.length > 0 ? product.imageUrls : (selectedImg ? [selectedImg] : []);
  const wished        = isWishlisted(product.id);

  // Parse chuỗi JSON specifications để lấy danh sách màu sắc và thông số kỹ thuật.
  // Tách colors ra riêng vì cần render đặc biệt (swatch), phần còn lại render dạng bảng.
  let specs = [], colors = [];
  try {
    const obj = JSON.parse(product.specifications || '{}');
    colors = Array.isArray(obj.colors) ? obj.colors : [];
    // eslint-disable-next-line no-unused-vars
    const { colors: _colors, ...rest } = obj;
    specs = Object.entries(rest);
  } catch { /* bỏ qua nếu JSON không hợp lệ */ }

  return (
    <main className="container product-detail-page">

      {/* Breadcrumb: Trang chủ / Danh mục / Tên sản phẩm. */}
      <nav className="detail-breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        {product.categoryName && (
          <><Link to={`/products?category=${product.categorySlug ?? ''}`}>{product.categoryName}</Link><span>/</span></>
        )}
        <span className="detail-bc-current">{product.name}</span>
      </nav>

      <div className="detail-grid">

        {/* Cột ảnh: ảnh chính click được để mở lightbox, hàng thumbnail bên dưới để chuyển ảnh. */}
        <div className="detail-image">
          {product.isFeatured && <span className="product-badge">Nổi bật</span>}

          <div className="detail-main-img-wrap"
            onClick={() => allImages.length > 0 && setLightboxIdx(allImages.indexOf(selectedImg) >= 0 ? allImages.indexOf(selectedImg) : 0)}>
            {selectedImg
              ? <img src={selectedImg} alt={product.name} />
              : <div style={{ background: '#f3f4f6', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                  <Package size={64} color="#d1d5db" />
                </div>}
            {allImages.length > 0 && (
              <div className="detail-zoom-hint"><ZoomIn size={18} /> Phóng to</div>
            )}
          </div>

          {allImages.length > 1 && (
            <div className="detail-thumbnails">
              {allImages.map((url, i) => (
                <img key={i} src={url} alt={`${product.name} ${i + 1}`}
                  className={selectedImg === url ? 'thumb-active' : ''}
                  onClick={() => setSelectedImg(url)} />
              ))}
            </div>
          )}
        </div>

        {/* Cột thông tin: tên, rating tổng hợp, giá, mô tả ngắn, tồn kho, màu sắc, nút hành động và cam kết. */}
        <div className="detail-info">
          <p className="detail-meta">
            {product.categoryName}{product.brandName ? ` • ${product.brandName}` : ''}
          </p>
          <h1>{product.name}</h1>

          {/* Hiện sao và số đánh giá nếu có, hoặc "Chưa có đánh giá" nếu chưa có. */}
          <div className="product-rating" style={{ marginBottom: '1rem' }}>
            {reviewStats.total > 0 ? (
              <>
                {Array(5).fill(0).map((_, i) => (
                  <Star key={i} size={18} fill={i < Math.round(reviewStats.avg) ? '#f59e0b' : 'none'} color="#f59e0b" />
                ))}
                <span style={{ marginLeft: '.35rem', fontWeight: 600 }}>{reviewStats.avg.toFixed(1)}</span>
                <span style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>({reviewStats.total} đánh giá)</span>
              </>
            ) : (
              <span style={{ fontSize: '.85rem', color: 'var(--text-light)', fontStyle: 'italic' }}>Chưa có đánh giá</span>
            )}
          </div>

          <div className="detail-price">
            <span className="price-current">{fmt(activePrice)}</span>
            {discount > 0 && <>
              <span className="price-original">{fmt(originalPrice)}</span>
              <span className="price-discount">-{discount}%</span>
            </>}
          </div>

          {product.shortDesc && <p className="detail-description">{product.shortDesc}</p>}

          {/* Trạng thái tồn kho: hết hàng / sắp hết / còn hàng với màu sắc khác nhau. */}
          {product.stockQty !== undefined && (
            <p className={`detail-stock ${isOOS ? 'stock-out' : product.stockQty <= 5 ? 'stock-low-text' : 'stock-ok'}`}>
              {isOOS ? '✕ Hết hàng' : product.stockQty <= 5 ? `⚡ Còn ${product.stockQty} sản phẩm` : `✓ Còn hàng (${product.stockQty})`}
            </p>
          )}

          {/* Hiển thị swatch màu sắc từ trường specifications JSON nếu có. */}
          {colors.length > 0 && (
            <div className="detail-colors">
              <h4>Màu sắc:</h4>
              <div className="detail-color-list">
                {colors.map((c, i) => (
                  <div key={i} className="detail-color-item" title={c.name}>
                    <span className="detail-color-swatch" style={{ background: c.hex }} />
                    <span className="detail-color-name">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Khu vực nút hành động được gắn ref để IntersectionObserver biết khi nào cần hiện sticky bar. */}
          <div className="detail-actions" ref={actionsRef}>
            <div className="qty-control">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={isOOS}>−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(q => Math.min(maxQty, q + 1))} disabled={isOOS}>+</button>
            </div>
            <button
              className={`add-to-cart-btn large ${added ? 'added' : ''}`}
              onClick={handleAddToCart}
              disabled={isOOS}
            >
              <ShoppingCart size={20} />
              {isOOS ? 'Hết hàng' : added ? 'Đã thêm vào giỏ!' : 'Thêm vào giỏ hàng'}
            </button>
            <button
              className={`detail-wishlist-btn ${wished ? 'wishlisted' : ''}`}
              onClick={handleWishlist}
              title={wished ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
              <Heart size={22} fill={wished ? '#e85d04' : 'none'} color={wished ? '#e85d04' : 'currentColor'} />
            </button>
          </div>

          {/* Hai cam kết: miễn phí ship và thông tin bảo hành. */}
          <div className="detail-trust">
            <div><Truck size={18} color="#e85d04" /> Miễn phí vận chuyển đơn từ 500.000đ</div>
            {product.warrantyMonths > 0
              ? <div><ShieldCheck size={18} color="#e85d04" /> Bảo hành chính hãng {product.warrantyMonths} tháng</div>
              : <div style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}><ShieldCheck size={18} color="#9ca3af" /> Không áp dụng bảo hành</div>
            }
          </div>

          {/* Thông tin phí lắp đặt chỉ hiện cho sản phẩm cần kỹ thuật viên lắp đặt. */}
          {product.requiresInstallation && (
            <div className="detail-install-block">
              <span className="detail-install-icon">🔧</span>
              <div>
                <strong>Dịch vụ lắp đặt</strong>
                <p>Sản phẩm này cần được lắp đặt bởi kỹ thuật viên.</p>
                <p className="detail-install-fee">
                  Phí lắp đặt: <strong>{fmt(product.installationFee ?? 150000)}</strong>
                  {product.installationFee == null && <span className="detail-install-default"> (mặc định)</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav sticky xuất hiện khi cuộn xuống, highlight tab tương ứng với section đang xem.
          Chỉ hiện khi có ít nhất mô tả hoặc thông số kỹ thuật. */}
      {(product.description || specs.length > 0 || product.weight) && (
        <nav className="detail-tab-nav" aria-label="Điều hướng nội dung sản phẩm">
          {product.description && (
            <button className={`dtn-btn${activeSection === 'desc' ? ' dtn-active' : ''}`}
              onClick={() => scrollToSection(descRef)}>Mô tả</button>
          )}
          {(specs.length > 0 || product.weight) && (
            <button className={`dtn-btn${activeSection === 'specs' ? ' dtn-active' : ''}`}
              onClick={() => scrollToSection(specsRef)}>Thông số</button>
          )}
          <button className={`dtn-btn${activeSection === 'reviews' ? ' dtn-active' : ''}`}
            onClick={() => scrollToSection(reviewRef)}>
            Đánh giá {reviewStats.total > 0 && `(${reviewStats.total})`}
          </button>
        </nav>
      )}

      {/* Phần mô tả và bảng thông số kỹ thuật, mỗi phần gắn ref và data-section để tab nav theo dõi. */}
      {(product.description || specs.length > 0 || product.weight) && (
        <div className="detail-tabs" style={{ marginTop: '2rem' }}>
          {product.description && (
            <div className="detail-tab-content" ref={descRef} data-section="desc">
              <h3>Mô tả sản phẩm</h3>
              <p style={{ lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-line' }}>{product.description}</p>
            </div>
          )}
          {(specs.length > 0 || product.weight) && (
            <div className="detail-tab-content" style={{ marginTop: '2rem' }} ref={specsRef} data-section="specs">
              <h3>Thông số kỹ thuật</h3>
              <table className="specs-table">
                <tbody>
                  {product.weight && (
                    <tr><td><strong>Khối lượng</strong></td><td>{product.weight} kg</td></tr>
                  )}
                  {specs.map(([k, v]) => (
                    <tr key={k}><td><strong>{k}</strong></td><td>{String(v)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ReviewSection tự quản lý việc load đánh giá, trả stats về qua callback onStatsLoad
          để trang này hiện điểm sao tổng hợp ở phần thông tin sản phẩm phía trên. */}
      <div ref={reviewRef} id="reviews" data-section="reviews">
        <ReviewSection productId={product.id} onStatsLoad={setReviewStats} autoOpen={openReview} />
      </div>

      {/* Sản phẩm liên quan cùng danh mục, lọc bỏ sản phẩm đang xem. */}
      {related.length > 0 && (
        <section className="section">
          <h2>Sản phẩm liên quan</h2>
          <div className="product-grid">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Lightbox phóng to ảnh, hiện khi lightboxIdx không null. */}
      {lightboxIdx !== null && (
        <Lightbox images={allImages} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* Sticky CTA bar cố định ở đáy màn hình khi người dùng cuộn qua nút "Thêm vào giỏ" chính.
          Hiện ảnh thumbnail, tên, giá và nút thêm vào giỏ gọn hơn. */}
      {stickyVisible && product && (
        <div className="detail-sticky-bar">
          <div className="container detail-sticky-inner">
            <div className="detail-sticky-info">
              {selectedImg && <img src={selectedImg} alt={product.name} className="detail-sticky-img" />}
              <div>
                <div className="detail-sticky-name">{product.name}</div>
                <div className="price-current" style={{ fontSize: '1rem' }}>{fmt(activePrice)}</div>
              </div>
            </div>
            <button
              className={`add-to-cart-btn ${added ? 'added' : ''}`}
              style={{ width: 'auto', padding: '0.6rem 1.5rem' }}
              onClick={handleAddToCart}
              disabled={isOOS}
            >
              <ShoppingCart size={16} />
              {isOOS ? 'Hết hàng' : added ? 'Đã thêm!' : 'Thêm vào giỏ'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default ProductDetail;
