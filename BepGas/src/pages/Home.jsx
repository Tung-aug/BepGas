// File này chứa toàn bộ giao diện trang chủ của BepGasVN.
// Trang chủ gồm nhiều section xếp từ trên xuống: banner hero, thương hiệu,
// danh mục, sản phẩm nổi bật, sản phẩm mới, bài viết cẩm nang, và cam kết dịch vụ.
// Dữ liệu được lấy từ API ngay khi trang mở, trong lúc chờ thì hiển thị skeleton giữ chỗ.

// Các hook cần import từ React:
// useState giúp lưu dữ liệu có thể thay đổi như danh sách sản phẩm, banner, thương hiệu.
// useEffect dùng để chạy code sau khi component render xong, thường dùng để gọi API.
// useRef giữ tham chiếu đến phần tử DOM hoặc giá trị mà khi thay đổi không làm trang render lại.
// useCallback ghi nhớ hàm để không tạo lại mỗi lần render, dùng cho hàm go() trong slider.
import { useState, useEffect, useRef, useCallback } from 'react';

// Link từ React Router dùng để tạo liên kết giữa các trang trong ứng dụng.
// Khác với thẻ a thông thường, Link không reload lại toàn bộ trang, chỉ cập nhật nội dung cần thiết.
import { Link } from 'react-router-dom';

// Các icon từ thư viện Lucide React, mỗi cái là một component SVG nhỏ.
// Truyền props size để điều chỉnh kích thước, color để đổi màu.
import {
  ArrowRight,    // mũi tên nhỏ bên cạnh nút "Xem tất cả" và "Đọc thêm"
  ShieldCheck,   // icon lá chắn trong ô "Thương hiệu đảm bảo"
  Truck,         // icon xe tải trong ô "Giao hàng tận nơi"
  RotateCcw,     // icon mũi tên xoay tròn trong ô "Đổi trả dễ dàng"
  Headphones,    // icon tai nghe trong ô "Sản phẩm chất lượng"
  ChevronLeft,   // nút mũi tên trái để lùi về slide trước trong slider
  ChevronRight,  // nút mũi tên phải để tiến sang slide tiếp theo
  BookOpen,      // icon cuốn sách bên cạnh tiêu đề "Cẩm nang nhà bếp"
  Calendar,      // icon lịch hiện cạnh ngày đăng của từng bài viết
} from 'lucide-react';

// ProductCard là component card hiển thị một sản phẩm gồm ảnh, tên, giá và nút thêm vào giỏ.
// SkeletonCard là phiên bản khung xám giữ chỗ khi đang tải sản phẩm.
// ScrollBannerRow là hàng banner cuộn ngang đặt ngay bên dưới slider banner lớn.
import ProductCard     from '../components/ProductCard';
import SkeletonCard    from '../components/SkeletonCard';
import ScrollBannerRow from '../components/ScrollBannerRow';

// Ba object này chứa các hàm gọi API tương ứng với từng loại dữ liệu.
// productAPI.getAll lấy danh sách sản phẩm, bannerAPI.getActive lấy banner đang bật,
// brandAPI.getAll lấy danh sách thương hiệu.
import { productAPI, bannerAPI, brandAPI } from '../services/api';

// CategoryContext là nơi lưu danh mục dùng chung cho toàn bộ ứng dụng.
// Thay vì mỗi trang tự gọi API lấy danh mục riêng, tất cả đều dùng chung một nguồn này.
import { useCategories } from '../context/CategoryContext';

// getCategoryEmoji tự động tìm emoji phù hợp với tên danh mục, ví dụ "Bếp" ra emoji lửa.
// renderCategoryIcon trả về component SVG nếu danh mục có cài icon tuỳ chỉnh từ admin,
// trả về null nếu không có, khi đó ta dùng emoji thay thế.
import { getCategoryEmoji }   from '../constants/emojis';
import { renderCategoryIcon } from '../constants/categoryIcons';

// Danh sách bài viết cẩm nang hiển thị ở gần cuối trang chủ.
// Hiện tại dùng dữ liệu viết cứng vì chưa có hệ thống blog được kết nối với backend.
// Ảnh minh hoạ đang dùng Unsplash làm placeholder tạm thời, sau này thay bằng ảnh thật.
// Mỗi bài có slug là phần sau /blog/ trong URL, tiêu đề, tóm tắt nội dung, ngày đăng và ảnh.
const ARTICLES = [
  {
    slug: 'chon-mua-bep-gas',
    title: 'Hướng dẫn chọn mua bếp gas phù hợp gia đình',
    excerpt: 'Bếp đôi hay đơn? Gas âm hay dương? Công suất bao nhiêu? Bài viết giúp bạn chọn đúng loại bếp phù hợp với nhu cầu và không gian bếp.',
    date: '15/05/2025',
    img: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=480&h=270&fit=crop',
  },
  {
    slug: 've-sinh-bep-gas',
    title: 'Cách vệ sinh bếp gas đúng cách — Bền đẹp hàng chục năm',
    excerpt: 'Vệ sinh đúng cách không chỉ giữ bếp sạch đẹp mà còn tăng hiệu quả đốt cháy, tiết kiệm gas và kéo dài tuổi thọ thiết bị đáng kể.',
    date: '22/05/2025',
    img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=480&h=270&fit=crop',
  },
  {
    slug: 'an-toan-bep-gas',
    title: 'Những lưu ý an toàn không thể bỏ qua khi dùng bếp gas',
    excerpt: 'Gas là nguồn năng lượng tiện dụng nhưng tiềm ẩn nguy hiểm. Nắm rõ những nguyên tắc an toàn để bảo vệ gia đình bạn.',
    date: '28/05/2025',
    img: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=480&h=270&fit=crop',
  },
];

// BannerSlider là component slider tự động chuyển slide mỗi 5 giây.
// Nhận props banners là mảng các banner đã được lọc theo vị trí hero từ component cha.
// Người dùng có thể bấm nút mũi tên hai bên hoặc chấm tròn bên dưới để chuyển thủ công.
const BannerSlider = ({ banners }) => {
  // idx là chỉ số của slide đang được hiển thị, bắt đầu từ 0 tức là slide đầu tiên.
  const [idx, setIdx] = useState(0);

  // timerRef lưu giữ ID của setInterval để ta có thể huỷ timer đó bằng clearInterval sau này.
  // Dùng useRef thay vì useState vì thay đổi timerRef không cần làm component render lại.
  const timerRef = useRef(null);

  // Hàm go nhận vào chỉ số slide muốn chuyển tới, đặt idx về đó và reset bộ đếm tự động.
  // Lý do cần reset timer: nếu người dùng vừa bấm nút chuyển slide thủ công,
  // ta không muốn slide tự nhảy tiếp ngay sau đó trong 5 giây tiếp theo.
  // useCallback giúp hàm này không bị tạo mới mỗi lần render trừ khi banners.length thay đổi.
  const go = useCallback((next) => {
    setIdx(next);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setIdx(i => (i + 1) % banners.length),
      5000
    );
  }, [banners.length]);

  // Khởi động timer tự chuyển slide khi component được gắn vào trang lần đầu.
  // Nếu chỉ có 1 banner thì không cần timer, hàm return sớm để thoát khỏi useEffect.
  // Hàm trả về ở cuối useEffect là hàm cleanup, tự động chạy khi component bị xoá khỏi trang,
  // giúp dọn dẹp timer không để nó chạy lãng phí sau khi component đã unmount.
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(
      () => setIdx(i => (i + 1) % banners.length),
      5000
    );
    return () => clearInterval(timerRef.current);
  }, [banners.length]);

  // Không hiển thị gì cả nếu mảng banners trống, tránh lỗi khi truy cập banners[idx].
  if (banners.length === 0) return null;

  const cur = banners[idx];

  return (
    <section className="hero-banner-slider">
      {/* Toàn bộ slide được bọc trong thẻ a để người dùng có thể click vào banner
          và điều hướng đến trang liên quan mà admin đã cấu hình trong linkUrl.
          Biến CSS --hbs-bg truyền URL ảnh vào stylesheet để dùng làm background.
          Nếu banner không có linkUrl thì gọi preventDefault để không nhảy đến dấu thăng. */}
      <a
        href={cur.linkUrl || '#'}
        className="hbs-slide"
        style={{ '--hbs-bg': `url(${cur.imageUrl})` }}
        onClick={e => { if (!cur.linkUrl) e.preventDefault(); }}
      >
        {/* Render thẻ img để công cụ tìm kiếm như Google đọc được nội dung ảnh,
            song song với background CSS để đảm bảo hiển thị đẹp trên các kích thước màn hình. */}
        <img
          src={cur.imageUrl}
          alt={cur.bannerTitle || 'Banner khuyến mãi BếpGasVN'}
          className="hbs-img"
        />
        {/* Lớp overlay gradient phủ lên ảnh, thường là tối dần từ dưới lên,
            giúp chữ đặt đè lên ảnh dễ đọc hơn mà không cần hộp nền riêng. */}
        <div className="hbs-overlay" />
      </a>

      {/* Nút mũi tên và chấm dot chỉ hiện khi có nhiều hơn 1 banner.
          Nếu chỉ có 1 banner thì không cần điều hướng, ẩn để giao diện gọn hơn.
          Công thức idx - 1 + length rồi chia lấy dư tránh chỉ số âm khi đang ở slide đầu. */}
      {banners.length > 1 && (
        <>
          <button className="hbs-arrow hbs-prev" onClick={() => go((idx - 1 + banners.length) % banners.length)}>
            <ChevronLeft size={22} />
          </button>
          <button className="hbs-arrow hbs-next" onClick={() => go((idx + 1) % banners.length)}>
            <ChevronRight size={22} />
          </button>

          {/* Vẽ một chấm tròn cho mỗi banner. Chấm của slide đang hiển thị
              được thêm class active để CSS làm nó nổi bật hơn các chấm khác. */}
          <div className="hbs-dots">
            {banners.map((_, i) => (
              <button
                key={i}
                className={`hbs-dot ${i === idx ? 'active' : ''}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

// useReveal là một custom hook tạo hiệu ứng xuất hiện khi người dùng cuộn trang xuống.
// Cách dùng: gọi useReveal lấy về một ref, gắn ref đó vào section muốn có hiệu ứng.

// Đây là component chính của trang chủ, chứa toàn bộ nội dung từ trên xuống dưới.
const Home = () => {
  // Lấy danh sách tất cả danh mục từ context dùng chung, không cần gọi API riêng ở đây.
  const { categories: allCats } = useCategories();

  // Khai báo state để lưu dữ liệu lấy từ API.
  // Tất cả bắt đầu là mảng rỗng và sẽ được cập nhật khi fetch xong.
  const [featured,       setFeatured]       = useState([]); // sản phẩm được đánh dấu nổi bật
  const [newProducts,    setNewProducts]    = useState([]); // sản phẩm mới, không trùng với featured
  const [banners,        setBanners]        = useState([]); // banner vị trí hero dùng cho slider lớn đầu trang
  const [scrollBanners,  setScrollBanners]  = useState([]); // banner vị trí scroll dùng cho hàng cuộn ngang
  const [sidebarBanners, setSidebarBanners] = useState([]); // banner vị trí sidebar đặt cạnh sản phẩm nổi bật
  const [brands,         setBrands]         = useState([]); // danh sách thương hiệu hiển thị trên trang chủ
  const [loading,        setLoading]        = useState(true); // true khi đang tải dữ liệu, false khi xong

  // Lọc danh mục để hiển thị trên trang chủ, ưu tiên danh mục con hơn danh mục cha
  // vì danh mục con cụ thể hơn và gần với thứ khách hàng thực sự tìm kiếm hơn.
  // Nếu chưa có danh mục con nào được tạo thì hiển thị danh mục cha thay thế.
  // Giới hạn tối đa 8 ô để lưới danh mục hiển thị đẹp và cân đối trên mọi màn hình.
  const childCats  = allCats.filter(c => c.isActive !== false && c.parentCategoryId);
  const categories = (childCats.length > 0
    ? childCats
    : allCats.filter(c => c.isActive !== false && !c.parentCategoryId)
  ).slice(0, 8);

  // Gắn ref từ useReveal vào từng section để mỗi cái có hiệu ứng xuất hiện riêng
  // khi người dùng cuộn trang xuống tới vùng đó. Mỗi ref hoạt động độc lập với nhau.

  // Gọi API để lấy dữ liệu trang chủ, chỉ chạy một lần khi component được mount lần đầu.
  // Mảng rỗng ở cuối useEffect có nghĩa là không phụ thuộc vào biến nào, chỉ chạy một lần.
  // Dùng Promise.all để gọi ba API cùng một lúc thay vì đợi lần lượt từng cái,
  // tổng thời gian chờ sẽ bằng API chậm nhất thay vì cộng dồn tất cả lại.
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [prodRes, bannerRes, brandRes] = await Promise.all([
          productAPI.getAll(0, 40),
          bannerAPI.getActive(),
          brandAPI.getAll(0, 50),
        ]);

        // Backend có thể trả dữ liệu theo nhiều cấu trúc khác nhau tuỳ phiên bản API,
        // nên dùng dấu hỏi chấm và hai dấu hỏi để thử từng cấu trúc, lấy cái nào có giá trị.
        const products = prodRes?.data?.content ?? prodRes?.content ?? [];

        // Lọc ra những sản phẩm được admin đánh dấu nổi bật, lấy tối đa 8 sản phẩm.
        const featuredList = products.filter(p => p.isFeatured).slice(0, 8);

        // Lưu id của sản phẩm nổi bật vào Set để tra cứu nhanh O(1) khi loại trừ trùng lặp.
        const featuredIds  = new Set(featuredList.map(p => p.id ?? p.productId));

        // Lọc ra danh sách sản phẩm không thuộc nhóm nổi bật để dùng cho mục sản phẩm mới.
        const nonFeatured  = products.filter(p => !featuredIds.has(p.id ?? p.productId));

        // Nếu admin có đánh dấu sản phẩm nổi bật thì dùng danh sách đó,
        // nếu không có sản phẩm nào được đánh dấu thì lấy 8 sản phẩm đầu tiên làm nổi bật.
        setFeatured(featuredList.length > 0 ? featuredList : products.slice(0, 8));

        // Nếu có danh sách nổi bật riêng thì sản phẩm mới lấy từ phần còn lại.
        // Nếu không có nổi bật riêng thì sản phẩm mới lấy từ vị trí 8 đến 11 trong mảng gốc.
        setNewProducts(featuredList.length > 0 ? nonFeatured.slice(0, 8) : products.slice(8, 12));

        // Phân loại banner theo trường position mà admin đặt khi tạo banner trong trang quản lý.
        // hero là vị trí slider to đầu trang, scroll là hàng cuộn ngang, sidebar là cột bên cạnh.
        const bList = bannerRes?.data ?? bannerRes ?? [];
        if (Array.isArray(bList)) {
          setBanners(       bList.filter(b => b.position === 'hero'));
          setScrollBanners( bList.filter(b => b.position === 'scroll'));
          setSidebarBanners(bList.filter(b => b.position === 'sidebar'));
        }

        // Chỉ lấy thương hiệu đang hoạt động và có trường slug, vì slug cần để tạo
        // đường dẫn /products?brand=ten-slug khi người dùng click vào logo thương hiệu.
        const bArr = brandRes?.data?.content ?? brandRes?.content ?? brandRes?.data ?? [];
        setBrands(
          Array.isArray(bArr)
            ? bArr.filter(b => b.isActive !== false && b.slug).slice(0, 10)
            : []
        );

      } catch {
        // Nếu mạng lỗi hoặc server không phản hồi, trang vẫn hiển thị bình thường
        // nhưng không có dữ liệu, không hiện thông báo lỗi để tránh làm xấu giao diện.
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  return (
    <main>
      {/* Hiển thị slider banner lớn đầu trang nếu admin đã thêm banner vào vị trí hero.
          Nếu không có banner nào thì bỏ qua section này, không để lại khoảng trống. */}
      {banners.length > 0 && <BannerSlider banners={banners} />}

      {/* Hàng banner cuộn ngang đặt ngay bên dưới slider hero.
          Chỉ hiển thị khi admin đã tạo banner có vị trí scroll. */}
      {scrollBanners.length > 0 && <ScrollBannerRow banners={scrollBanners} />}

      {/* Section danh mục sản phẩm, có hiệu ứng fade-in khi người dùng cuộn tới.
          Mỗi ô là Link dẫn đến trang sản phẩm đã được lọc sẵn theo danh mục đó. */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Danh mục sản phẩm</h2>
            <Link to="/products" className="see-all">Xem tất cả <ArrowRight size={16} /></Link>
          </div>

          <div className="home-cat-grid">
            {categories.length > 0
              ? categories.map(c => {
                  // id và tên có thể có tên field khác nhau tuỳ phiên bản backend
                  const cid  = c.categoryId ?? c.id;
                  const name = c.categoryName ?? c.name;
                  return (
                    <Link
                      key={cid}
                      to={`/products?category=${c.slug ?? cid}`}
                      className="home-cat-card"
                    >
                      <div className="home-cat-emoji">
                        {/* Thử render icon SVG tuỳ chỉnh trước nếu admin đã cài,
                            nếu không có thì tự động chọn emoji phù hợp theo tên danh mục. */}
                        {(() => {
                          const svg = renderCategoryIcon(c, { size: 36, color: 'var(--primary)' });
                          return svg !== null ? svg : getCategoryEmoji(c);
                        })()}
                      </div>
                      <span className="home-cat-name">{name}</span>
                    </Link>
                  );
                })
              : <p style={{ color: 'var(--text-light)' }}>Chưa có danh mục</p>}
          </div>
        </div>
      </section>

      {/* Section thương hiệu nổi bật, chỉ hiển thị khi có ít nhất một thương hiệu.
          Click vào card thương hiệu dẫn đến trang sản phẩm đã lọc theo thương hiệu đó. */}
      {brands.length > 0 && (
        <section className="section section-brand">
          <div className="container">
            <div className="section-header">
              <h2>Thương hiệu nổi bật</h2>
              <Link to="/brands" className="see-all">Xem tất cả <ArrowRight size={16} /></Link>
            </div>
            <div className="home-brand-grid">
              {brands.map(b => {
                const bid  = b.brandId ?? b.id;
                const name = b.brandName ?? b.name ?? '?';
                return (
                  <Link key={bid} to={`/products?brand=${b.slug}`} className="home-brand-card">
                    <div className="home-brand-logo-wrap">
                      {/* Hiển thị ảnh logo nếu thương hiệu có upload logo,
                          nếu không thì hiển thị chữ cái đầu của tên thương hiệu thay thế. */}
                      {b.logoUrl
                        ? <img src={b.logoUrl} alt={name} className="home-brand-logo" />
                        : <span className="home-brand-initial">{name[0]}</span>}
                    </div>
                    <span className="home-brand-name">{name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Section sản phẩm nổi bật — dùng home-products-appear (CSS animation tự chạy) thay vì
          reveal-section để tránh opacity:0 khi section render muộn sau khi data về. */}
      {(loading || featured.length > 0) && (
        <section className={`section section-gray${!loading && featured.length > 0 ? ' home-products-appear' : ''}`}>
          <div className="container">
            <div className="section-header">
              <h2>Sản phẩm nổi bật</h2>
              <Link to="/products" className="see-all">Xem tất cả <ArrowRight size={16} /></Link>
            </div>
            <div className={sidebarBanners.length > 0 ? 'home-featured-layout' : ''}>
              {sidebarBanners.length > 0 && (
                <aside className="home-sidebar-ads">
                  {sidebarBanners.map(b => (
                    <a
                      key={b.bannerId ?? b.id}
                      href={b.linkUrl || '#'}
                      className="home-sidebar-ad-item"
                      onClick={e => !b.linkUrl && e.preventDefault()}
                    >
                      <img src={b.imageUrl} alt={b.bannerTitle || 'Quảng cáo'} />
                    </a>
                  ))}
                </aside>
              )}
              <div className="product-grid">
                {loading
                  ? Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)
                  : featured.map(p => <ProductCard key={p.id ?? p.productId} product={p} />)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section sản phẩm mới nhất — cùng cách tiếp cận: CSS animation thay vì reveal-section */}
      {(loading || newProducts.length > 0) && (
        <section className={`section${!loading && newProducts.length > 0 ? ' home-products-appear' : ''}`}>
          <div className="container">
            <div className="section-header">
              <h2>Sản phẩm mới nhất</h2>
              <Link to="/products" className="see-all">Xem tất cả <ArrowRight size={16} /></Link>
            </div>
            <div className="product-grid">
              {loading
                ? Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)
                : newProducts.map(p => (
                    <ProductCard
                      key={p.id ?? p.productId}
                      product={p}
                      badge={p.salePrice != null && p.salePrice < p.price
                        ? `-${Math.round((1 - p.salePrice / p.price) * 100)}%`
                        : 'Mới'}
                    />
                  ))}
            </div>
          </div>
        </section>
      )}

      {/* Section cẩm nang nhà bếp, dùng dữ liệu tĩnh từ mảng ARTICLES khai báo phía trên.
          Thuộc tính loading lazy trên thẻ img giúp trình duyệt chỉ tải ảnh khi sắp cuộn tới,
          giảm dung lượng cần tải ngay lúc mở trang và làm trang chủ nhanh hơn. */}
      <section className="section section-gray">
        <div className="container">
          <div className="section-header">
            <h2>
              <BookOpen size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--primary)' }} />
              Cẩm nang nhà bếp
            </h2>
            <Link to="/blog" className="see-all">Xem tất cả <ArrowRight size={14}/></Link>
          </div>

          <div className="home-articles-grid">
            {ARTICLES.map(a => (
              <Link key={a.slug} to={`/blog/${a.slug}`} className="home-article-card">
                <img src={a.img} alt={a.title} className="home-article-img" loading="lazy" />
                <div className="home-article-body">
                  <div className="home-article-date">
                    <Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {a.date}
                  </div>
                  <div className="home-article-title">{a.title}</div>
                  <div className="home-article-excerpt">{a.excerpt}</div>
                  <span className="home-article-link">Đọc thêm <ArrowRight size={13} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Section cam kết dịch vụ ở cuối trang, gồm 4 ô xếp thành lưới.
          Thay vì viết 4 khối JSX giống nhau, định nghĩa mảng object rồi dùng map để render,
          sau này muốn sửa nội dung chỉ cần đổi trong mảng mà không cần tìm từng chỗ. */}
      <section className="trust-section">
        <div className="container trust-grid">
          {[
            { icon: <ShieldCheck size={30} color="#fff"/>, title: 'Thương hiệu đảm bảo',  sub: 'Nhập khẩu, bảo hành chính hãng' },
            { icon: <RotateCcw   size={30} color="#fff"/>, title: 'Đổi trả dễ dàng',       sub: 'Trong vòng 30 ngày mua hàng' },
            { icon: <Truck       size={30} color="#fff"/>, title: 'Giao hàng tận nơi',      sub: 'Toàn quốc, miễn phí từ 500K' },
            { icon: <Headphones  size={30} color="#fff"/>, title: 'Sản phẩm chất lượng',    sub: 'Đảm bảo tương thích & bền lâu' },
          ].map((t, i) => (
            <div key={i} className="trust-item">
              <div className="trust-icon-wrap">{t.icon}</div>
              <h4>{t.title}</h4>
              <p>{t.sub}</p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
};

export default Home;
