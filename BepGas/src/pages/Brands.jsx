// Trang danh sách tất cả thương hiệu, hỗ trợ tìm kiếm theo tên và xem theo nhóm chữ cái.
// Mỗi thương hiệu khi click sẽ dẫn đến trang sản phẩm đã lọc sẵn theo thương hiệu đó.

// useState lưu danh sách thương hiệu, trạng thái loading và từ khoá tìm kiếm.
// useMemo tính toán danh sách đã lọc và nhóm theo chữ cái mà không cần gọi lại hàm mỗi render.
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

// Search để hiển thị icon kính lúp trong ô tìm kiếm.
// ArrowRight cho nút "Xem sản phẩm" trên mỗi card thương hiệu.
// Tag cho icon tiêu đề trang, X cho nút xoá từ khoá tìm kiếm.
import { Search, ArrowRight, Tag, X } from 'lucide-react';
import { brandAPI } from '../services/api';

// BrandSkeleton là card xương hiển thị trong khi đang tải dữ liệu thương hiệu.
// Dùng CSS class sk-shimmer để tạo hiệu ứng sáng chạy qua như đang load.
const BrandSkeleton = () => (
  <div className="brand-page-card brand-skeleton">
    <div className="bpc-logo-wrap sk-shimmer" />
    <div className="bpc-info">
      <div className="sk-shimmer" style={{ height: 16, width: '60%', borderRadius: 6, marginBottom: 8 }} />
      <div className="sk-shimmer" style={{ height: 12, width: '90%', borderRadius: 6, marginBottom: 4 }} />
      <div className="sk-shimmer" style={{ height: 12, width: '70%', borderRadius: 6 }} />
    </div>
  </div>
);

const Brands = () => {
  // brands lưu toàn bộ thương hiệu đang hoạt động lấy từ API.
  // loading hiện skeleton trong lúc chờ dữ liệu về.
  // search lưu từ khoá người dùng đang gõ vào ô tìm kiếm.
  const [brands,  setBrands]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  // Gọi API lấy tối đa 100 thương hiệu khi component mount lần đầu.
  // Lọc bỏ thương hiệu có isActive = false để không hiển thị hàng đã ẩn.
  // Backend có thể trả dữ liệu ở nhiều cấu trúc khác nhau nên dùng ?? để thử từng cái.
  useEffect(() => {
    brandAPI.getAll(0, 100)
      .then(r => {
        const list = r?.data?.content ?? r?.content ?? r?.data ?? [];
        setBrands(Array.isArray(list) ? list.filter(b => b.isActive !== false) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // filtered là danh sách thương hiệu sau khi lọc theo từ khoá tìm kiếm.
  // useMemo giúp không tính lại mỗi lần render trừ khi brands hoặc search thay đổi.
  // Nếu search rỗng thì trả về toàn bộ brands không cần lọc.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(b => (b.brandName ?? b.name ?? '').toLowerCase().includes(q));
  }, [brands, search]);

  // grouped nhóm thương hiệu theo chữ cái đầu của tên, sắp xếp theo bảng chữ cái tiếng Việt.
  // Kết quả là mảng các cặp [chữ_cái, mảng_thương_hiệu] đã sắp thứ tự.
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(b => {
      const letter = (b.brandName ?? b.name ?? '#')[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(b);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'vi'));
  }, [filtered]);

  return (
    <main className="brands-page">

      {/* Phần header của trang gồm breadcrumb, tiêu đề và ô tìm kiếm.
          Số lượng thương hiệu hiện ra sau khi load xong thay vì hiện "..." trong lúc chờ. */}
      <section className="brands-hero">
        <div className="container">
          <div className="brands-breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span>/</span>
            <span>Thương hiệu</span>
          </div>
          <div className="brands-hero-inner">
            <div>
              <h1><Tag size={26} style={{ verticalAlign: 'middle', marginRight: 10, color: 'var(--primary)' }} />Thương hiệu nổi bật</h1>
              <p>{loading ? '...' : `${brands.length} thương hiệu thiết bị nhà bếp chính hãng`}</p>
            </div>

            {/* Ô tìm kiếm có icon kính lúp bên trái và nút X để xoá từ khoá.
                Nút X chỉ hiện khi người dùng đã gõ gì đó vào ô tìm kiếm. */}
            <div className="brands-search-wrap">
              <Search size={17} className="brands-search-icon" />
              <input
                className="brands-search-input"
                type="text"
                placeholder="Tìm thương hiệu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="brands-search-clear" onClick={() => setSearch('')}>
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Phần thân trang hiển thị theo ba trạng thái:
          1. Đang tải: hiện 12 skeleton card giữ chỗ
          2. Không tìm thấy: hiện thông báo và nút gợi ý
          3. Có kết quả: hiện danh sách nhóm theo chữ cái */}
      <div className="container brands-body">
        {loading ? (
          <div className="brands-grid">
            {Array(12).fill(0).map((_, i) => <BrandSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>Không tìm thấy thương hiệu nào</h3>
            <p>Thử tìm với từ khóa khác</p>
            <div className="empty-state-actions">
              <button className="btn btn-outline" onClick={() => setSearch('')}>Xóa tìm kiếm</button>
              <Link to="/products" className="btn btn-primary">Xem tất cả sản phẩm <ArrowRight size={16} /></Link>
            </div>
          </div>
        ) : (
          // Duyệt qua mảng grouped, mỗi nhóm hiện một chữ cái làm tiêu đề và lưới card bên dưới.
          grouped.map(([letter, items]) => (
            <div key={letter} className="brands-group">
              <div className="brands-group-letter">{letter}</div>
              <div className="brands-grid">
                {items.map(b => {
                  const bid  = b.brandId ?? b.id;
                  const name = b.brandName ?? b.name ?? '?';
                  return (
                    <Link
                      key={bid}
                      to={`/products?brand=${b.slug}`}
                      className="brand-page-card"
                    >
                      {/* Hiển thị logo nếu có, nếu không thì hiện chữ cái đầu của tên thương hiệu. */}
                      <div className="bpc-logo-wrap">
                        {b.logoUrl
                          ? <img src={b.logoUrl} alt={name} className="bpc-logo" />
                          : <span className="bpc-initial">{name[0]}</span>}
                      </div>

                      {/* Tên và mô tả ngắn của thương hiệu, mô tả chỉ hiện khi có dữ liệu. */}
                      <div className="bpc-info">
                        <h3 className="bpc-name">{name}</h3>
                        {b.description && (
                          <p className="bpc-desc">{b.description}</p>
                        )}
                      </div>

                      {/* Nút kêu gọi hành động, luôn nằm ở dưới cùng của card. */}
                      <span className="bpc-cta">
                        Xem sản phẩm <ArrowRight size={14} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
};

export default Brands;
