/*
 * Trang danh sách sản phẩm — hỗ trợ lọc nâng cao
 * Filter: danh mục (URL slug), thương hiệu (URL slug), khoảng giá (preset + slider tuỳ chỉnh), sắp xếp.
 * Tất cả filter đồng bộ lên URL query params để có thể chia sẻ link.
 * Khoảng giá được tự sinh từ dữ liệu thực tế của sản phẩm (buildPriceRanges).
 * Filter khách hàng chỉ fetch 1 lần toàn bộ rồi lọc client-side (tối đa 200 sản phẩm/lần).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronUp, ChevronDown, Filter, ArrowRight } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import SkeletonCard from '../components/SkeletonCard';
import DualRangeSlider from '../components/DualRangeSlider';
import { useCategories } from '../context/CategoryContext';
import { productAPI, brandAPI } from '../services/api';
import { fmtShort } from '../utils/formatters';

// Gộp cả hai field để tương thích trước/sau khi fix backend @JsonProperty
const getCatActive = (c) => c.isActive ?? c.active ?? true;

// Xây cây danh mục từ danh sách phẳng dựa trên parentId / parentCategoryId
// Sắp xếp theo sortOrder trước khi build cây — object key là số (categoryId) nên
// Object.values(map) sẽ tự sắp lại theo ID tăng dần (quy tắc của JS), không giữ đúng
// thứ tự sortOrder; phải tự sort danh sách phẳng rồi duyệt theo nó, không qua Object.values.
const buildCategoryTree = (cats) => {
  const sorted = [...cats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const map = {};
  sorted.forEach(c => { map[String(c.categoryId ?? c.id)] = { ...c, children: [] }; });
  const roots = [];
  sorted.forEach(c => {
    const node = map[String(c.categoryId ?? c.id)];
    const pid  = String(node.parentId ?? node.parentCategoryId ?? '');
    if (pid && pid !== 'null' && pid !== 'undefined' && map[pid]) map[pid].children.push(node);
    else roots.push(node);
  });
  return roots;
};

// Đếm sản phẩm của node bao gồm toàn bộ con cháu
const sumCatCount = (node, directCounts) => {
  let n = directCounts[String(node.categoryId ?? node.id)] ?? 0;
  (node.children ?? []).forEach(child => { n += sumCatCount(child, directCounts); });
  return n;
};

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

const roundNice = (n) => {
  if (n >= 10000000)  return Math.round(n / 1000000)  * 1000000;
  if (n >= 1000000)   return Math.round(n / 500000)   * 500000;
  if (n >= 100000)    return Math.round(n / 100000)   * 100000;
  return Math.round(n / 10000) * 10000;
};

// Tự sinh khoảng giá thông minh từ danh sách sản phẩm thực tế
const buildPriceRanges = (products) => {
  const prices = products
    .map(p => Number(p.salePrice ?? p.price ?? 0))
    .filter(p => p > 0);
  if (prices.length < 2) return [];

  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  if (minP === maxP) return [];

  // Tạo 4 điểm chia đều, làm tròn sang số đẹp
  const step = (maxP - minP) / 4;
  const raw  = [1, 2, 3].map(i => roundNice(minP + step * i));

  // Bỏ trùng và bỏ giá trị >= max
  const cuts = [...new Set(raw)].filter(v => v > minP && v < maxP);

  const ranges = [{ label: 'Tất cả', min: 0, max: Infinity }];
  let prev = 0;
  cuts.forEach(cut => {
    ranges.push({
      label: prev === 0 ? `Dưới ${fmtShort(cut)}` : `Từ ${fmtShort(prev)} - ${fmtShort(cut)}`,
      min: prev, max: cut,
    });
    prev = cut;
  });
  ranges.push({ label: `Trên ${fmtShort(prev)}`, min: prev, max: Infinity });
  return ranges;
};

const sortOptions = [
  { value: 'default',    label: 'Mặc định' },
  { value: 'price-asc',  label: 'Giá tăng dần' },
  { value: 'price-desc', label: 'Giá giảm dần' },
  { value: 'sold',       label: 'Bán chạy nhất' },
];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products,      setProducts]      = useState([]);
  const [allBrands,     setAllBrands]     = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const { categories, loading: catsLoading } = useCategories();
  const [loading,    setLoading]    = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  // Sort đồng bộ với URL param ?sort=
  const sortFromUrl = searchParams.get('sort') || 'default';
  const setSort = (val) => setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('sort', val); return p; }, { replace: true });
  const sort = sortFromUrl;

  // Filter state — brand filter theo URL (slug), giá filter client-side
  const [priceRangeIdx,  setPriceRangeIdx]  = useState(0);
  const [customMin,      setCustomMin]      = useState(0);
  const [customMax,      setCustomMax]      = useState(0);
  const [showAllBrands, setShowAllBrands] = useState(false);

  // Ref để update số tiền trực tiếp vào DOM — không trigger re-render khi kéo
  const minInputRef = useRef(null);
  const maxInputRef = useRef(null);

  // Collapsible
  const [openBrand, setOpenBrand] = useState(true);
  const [openPrice, setOpenPrice] = useState(true);
  const [openCat,   setOpenCat]   = useState(true);

  // URL dùng slug: ?category=bep-gas  |  ?brand=samsung-vn
  const categorySlug = searchParams.get('category') || '';
  const brandSlug    = searchParams.get('brand')    || '';
  const searchQuery  = searchParams.get('search')   || '';

  // Resolve category slug → ID; fallback sang ID khi danh mục thiếu slug
  const categoryObj = useMemo(
    () => categorySlug
      ? (categories.find(c => c.slug === categorySlug)
         ?? categories.find(c => String(c.categoryId ?? c.id) === categorySlug))
      : null,
    [categorySlug, categories],
  );
  const categoryId = categoryObj ? String(categoryObj.categoryId ?? categoryObj.id) : '';

  // Resolve brand slug → ID (thử slug trước, fallback ID khi chip dùng ID làm slug)
  const brandObj = useMemo(
    () => brandSlug
      ? allBrands.find(b => b.slug === brandSlug)
        ?? allBrands.find(b => String(b.id ?? b.brandId) === brandSlug)
      : null,
    [brandSlug, allBrands],
  );
  const brandId = brandObj ? String(brandObj.id ?? brandObj.brandId) : '';

  useEffect(() => {
    brandAPI.getAll(0, 200)
      .then(r => {
        const list = r?.data?.content ?? r?.content ?? r?.data ?? r ?? [];
        setAllBrands(Array.isArray(list) ? list : []);
      })
      .catch(err => console.error('[Products] brands:', err))
      .finally(() => setBrandsLoading(false));
  }, []);

  const fetchProducts = useCallback(async () => {
    // Chờ context/data load xong trước khi resolve slug → id
    if (categorySlug && catsLoading)   return;
    if (brandSlug    && brandsLoading) return;
    setLoading(true);
    setPriceRangeIdx(0); // reset filter giá mỗi lần đổi category/brand/search
    try {
      let prods = [];
      if (searchQuery) {
        const res = await productAPI.search(searchQuery, 0, 200);
        prods = res?.data?.content ?? res?.content ?? [];
      } else if (categoryId) {
        // /tree endpoint: trả sản phẩm của danh mục cha + toàn bộ con trong một lần gọi
        const res = await productAPI.getByCategoryTree(categoryId, 0, 200);
        prods = res?.data?.content ?? res?.content ?? [];
      } else if (brandId) {
        const res = await productAPI.getByBrand(brandId, 0, 200);
        prods = res?.data?.content ?? res?.content ?? [];
      } else {
        const res = await productAPI.getAll(0, 200);
        prods = res?.data?.content ?? res?.content ?? [];
      }
      setProducts(prods);
    } catch (err) { console.error('[Products] fetch:', err); setProducts([]); }
    finally  { setLoading(false); }
  }, [searchQuery, categoryId, brandId, categorySlug, brandSlug, catsLoading, brandsLoading]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Khoảng giá động từ sản phẩm thực tế
  const priceRanges = useMemo(() => buildPriceRanges(products), [products]);

  // Giá min/max thực tế để set slider
  const actualMin = useMemo(() => {
    const prices = products.map(p => Number(p.salePrice ?? p.price ?? 0)).filter(v => v > 0);
    return prices.length ? Math.min(...prices) : 0;
  }, [products]);

  const actualMax = useMemo(() => {
    const prices = products.map(p => Number(p.salePrice ?? p.price ?? 0)).filter(v => v > 0);
    return prices.length ? Math.max(...prices) : 50000000;
  }, [products]);

  // Khi sản phẩm load xong, reset custom range theo giá thực tế
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomMin(actualMin);
    setCustomMax(actualMax);
    if (minInputRef.current) minInputRef.current.value = fmt(actualMin);
    if (maxInputRef.current) maxInputRef.current.value = fmt(actualMax);
  }, [actualMin, actualMax]);

  // Đếm số sản phẩm của từng hãng trong danh sách hiện tại
  const brandCounts = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const bid = String(p.brandId ?? p.brand?.id);
      if (bid && bid !== 'undefined') map[bid] = (map[bid] || 0) + 1;
    });
    return map;
  }, [products]);

  // Chỉ hiển thị hãng có ít nhất 1 sản phẩm trong danh mục/tìm kiếm hiện tại
  const relevantBrands = useMemo(() => {
    const ids = new Set(Object.keys(brandCounts));
    if (ids.size === 0) return []; // không có sp → ẩn hẳn block thương hiệu
    return allBrands.filter(b => ids.has(String(b.id ?? b.brandId)));
  }, [brandCounts, allBrands]);

  // Đếm số sp theo danh mục trong kết quả hiện tại
  const categoryCounts = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const cid = String(p.categoryId ?? p.category?.id ?? p.category?.categoryId ?? '');
      if (cid && cid !== 'undefined') map[cid] = (map[cid] || 0) + 1;
    });
    return map;
  }, [products]);



  const visibleBrands = showAllBrands ? relevantBrands : relevantBrands.slice(0, 6);

  // Cây danh mục cha-con
  const categoryTree = useMemo(() => {
    const activeCats = categories.filter(c => getCatActive(c));
    return buildCategoryTree(activeCats);
  }, [categories]);

  // Tự xóa brand khi đổi category và brand đó không còn sản phẩm trong category mới
  useEffect(() => {
    if (!brandSlug || loading || brandsLoading) return;
    if (relevantBrands.length === 0 && products.length === 0) return;
    const stillRelevant = relevantBrands.some(b => b.slug === brandSlug);
    if (!stillRelevant) {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.delete('brand');
        return p;
      }, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantBrands, brandSlug, loading]);

  // Lấy range đang áp dụng
  const activeRange = priceRanges[priceRangeIdx];
  const filterMin   = priceRangeIdx === 0 ? customMin : (activeRange?.min ?? 0);
  const filterMax   = priceRangeIdx === 0 ? customMax : (activeRange?.max ?? Infinity);

  /* Lọc và sắp xếp client-side — toàn bộ chạy trên danh sách đã fetch về
     Lọc giá + hãng, rồi sắp xếp theo tuỳ chọn người dùng chọn trên toolbar */
  const filtered = useMemo(() => [...products]
    .filter(p => {
      const price   = Number(p.salePrice ?? p.price ?? 0);
      const inPrice = price >= filterMin && (filterMax === Infinity || price <= filterMax);
      // Nếu fetch về theo category → lọc thêm theo brand client-side (nếu có ?brand=)
      const inBrand = !brandId || String(p.brandId ?? p.brand?.id) === brandId;
      return inPrice && inBrand;
    })
    .sort((a, b) => {
      const pa = Number(a.salePrice ?? a.price ?? 0);
      const pb = Number(b.salePrice ?? b.price ?? 0);
      if (sort === 'price-asc')  return pa - pb;
      if (sort === 'price-desc') return pb - pa;
      if (sort === 'sold')       return (b.soldQty ?? 0) - (a.soldQty ?? 0);
      return 0; // default: giữ nguyên thứ tự backend
    }), [products, filterMin, filterMax, brandId, sort]);

  /* Đổi danh mục: cập nhật ?category= trên URL, đồng thời xoá ?search=
     vì tìm kiếm text và lọc danh mục không dùng cùng nhau               */
  const setCategory = (slug) => {
    const p = new URLSearchParams(searchParams);
    if (!slug) p.delete('category'); else p.set('category', slug);
    p.delete('search');
    setSearchParams(p);
  };

  /* Toggle thương hiệu: click lần 2 vào hãng đang chọn để bỏ lọc */
  const setBrandFilter = (slug) => {
    const p = new URLSearchParams(searchParams);
    if (!slug || slug === brandSlug) p.delete('brand');
    else p.set('brand', slug);
    setSearchParams(p);
  };

  /* Xoá từ khoá tìm kiếm, quay về danh sách mặc định */
  const clearSearch = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('search');
    p.delete('category');
    setSearchParams(p);
  };

  /* Xoá tất cả bộ lọc (brand, giá) về mặc định */
  const clearAllFilters = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('brand');
    setSearchParams(p);
    setPriceRangeIdx(0);
    setCustomMin(actualMin);
    setCustomMax(actualMax);
    if (minInputRef.current) minInputRef.current.value = fmt(actualMin);
    if (maxInputRef.current) maxInputRef.current.value = fmt(actualMax);
  };

  

  const hasActiveFilter = !!brandSlug || priceRangeIdx !== 0
    || customMin > actualMin || customMax < actualMax;

  const currentCatName = searchQuery
    ? 'Kết quả tìm kiếm'
    : categorySlug ? (categoryObj?.categoryName ?? 'Sản phẩm')
    : brandSlug    ? (brandObj?.brandName ?? brandObj?.name ?? 'Thương hiệu')
    : 'Tất cả sản phẩm';

  // Render cây danh mục đệ quy
  const renderCatTree = (nodes, depth = 0) => nodes
    .filter(node => {
      // Khi đang lọc theo brand: ẩn danh mục không có sản phẩm
      if (!brandSlug) return true;
      return sumCatCount(node, categoryCounts) > 0;
    })
    .map(node => {
      const cid      = String(node.categoryId ?? node.id);
      const count    = sumCatCount(node, categoryCounts);
      const slug     = node.slug ?? cid;
      const isActive = categorySlug === slug;
      return (
        <div key={cid} className={depth > 0 ? 'cat-children' : undefined}>
          <label className={`filter-checkbox${isActive ? ' cat-active' : ''}`}>
            <input type="radio" name="category" checked={isActive}
              onChange={() => setCategory(slug)} />
            <span className="cat-name">{node.categoryName ?? node.name}</span>
            {count > 0 && <span className="brand-row-count">{count}</span>}
          </label>
          {node.children?.length > 0 && renderCatTree(node.children, depth + 1)}
        </div>
      );
    });

  /* sidebarContent là biến JSX (không phải component) để tránh DualRangeSlider
     bị unmount/remount mỗi lần render — dùng chung cho cả desktop và mobile drawer */
  const sidebarContent = (
    <div className="filter-sidebar">
      <div className="filter-sidebar-header">
        <div className="filter-sidebar-title"><Filter size={18} /><h3>Bộ lọc tìm kiếm</h3></div>
        {hasActiveFilter && <button className="filter-clear-all" onClick={clearAllFilters}>Xóa lọc</button>}
        <button className="close-filter" onClick={() => setFilterOpen(false)}><X size={20} /></button>
      </div>

      {/* 1. Danh mục — cha-con, đếm cả sp của con */}
      <div className="filter-section">
        <button className="filter-section-title" onClick={() => setOpenCat(!openCat)}>
          <span>Danh mục</span>
          {openCat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {openCat && (
          <>
            <label className="filter-checkbox">
              <input type="radio" name="category" checked={!categorySlug} onChange={() => setCategory('')} />
              <span>Tất cả danh mục</span>
            </label>
            {renderCatTree(categoryTree)}
          </>
        )}
      </div>

      {/* 2. Hãng sản xuất — chỉ hiện hãng có sp trong danh mục đang chọn */}
      {relevantBrands.length > 0 && (
        <div className="filter-section">
          <button className="filter-section-title" onClick={() => setOpenBrand(!openBrand)}>
            <span>Thương hiệu</span>
            {openBrand ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openBrand && (
            <>
              <div className="brand-list">
                {visibleBrands.map(b => {
                  const bid   = String(b.id ?? b.brandId);
                  const bname = b.brandName ?? b.name ?? '';
                  const count = brandCounts[bid] ?? 0;
                  return (
                    <button
                      key={bid}
                      className={`brand-row-btn ${b.slug === brandSlug ? 'brand-active' : ''}`}
                      onClick={() => setBrandFilter(b.slug)}
                    >
                      {b.logoUrl
                        ? <img className="brand-row-logo" src={b.logoUrl} alt={bname}/>
                        : <span className="brand-row-initial">{bname.charAt(0)}</span>}
                      <span className="brand-row-name">{bname}</span>
                      <span className="brand-row-count">{count}</span>
                    </button>
                  );
                })}
              </div>
              {relevantBrands.length > 6 && (
                <button className="show-more-brands" onClick={() => setShowAllBrands(s => !s)}>
                  {showAllBrands ? 'Thu gọn' : `Xem thêm (${relevantBrands.length - 6})`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. Mức giá — khoảng tự sinh từ sp thực tế */}
      {priceRanges.length > 0 && (
        <div className="filter-section">
          <button className="filter-section-title" onClick={() => setOpenPrice(!openPrice)}>
            <span>Mức giá</span>
            {openPrice ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openPrice && (
            <>
              <div className="price-presets">
                {priceRanges.map((r, i) => (
                  <label key={i} className="filter-checkbox">
                    <input type="radio" name="priceRange"
                      checked={priceRangeIdx === i}
                      onChange={() => { setPriceRangeIdx(i); setCustomMin(actualMin); setCustomMax(actualMax); }} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>

              <p className="price-custom-label">Hoặc nhập khoảng giá phù hợp với bạn:</p>
              <div className="price-inputs">
                <input ref={minInputRef} type="text" className="price-input"
                  defaultValue={fmt(customMin)}
                  onBlur={e => { setCustomMin(Number(e.target.value.replace(/\D/g, ''))); setPriceRangeIdx(0); }} />
                <span className="price-sep">~</span>
                <input ref={maxInputRef} type="text" className="price-input"
                  defaultValue={fmt(customMax)}
                  onBlur={e => { setCustomMax(Number(e.target.value.replace(/\D/g, ''))); setPriceRangeIdx(0); }} />
              </div>
              <DualRangeSlider
                min={actualMin}
                max={actualMax}
                valueMin={priceRangeIdx === 0 ? customMin : (activeRange?.min ?? actualMin)}
                valueMax={priceRangeIdx === 0 ? customMax : (activeRange?.max === Infinity ? actualMax : Math.min(activeRange?.max ?? actualMax, actualMax))}
                onDrag={(dMin, dMax) => {
                  if (minInputRef.current) minInputRef.current.value = fmt(dMin);
                  if (maxInputRef.current) maxInputRef.current.value = fmt(dMax);
                }}
                onChange={(newMin, newMax) => {
                  setCustomMin(newMin);
                  setCustomMax(newMax);
                  setPriceRangeIdx(0);
                  if (minInputRef.current) minInputRef.current.value = fmt(newMin);
                  if (maxInputRef.current) maxInputRef.current.value = fmt(newMax);
                }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-light)', marginTop:'0.25rem' }}>
                <span>{fmt(actualMin)}</span>
                <span>{fmt(actualMax)}</span>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );

  return (
    <main className="products-page">
      <div className="container">
        {/* Tiêu đề trang: thay đổi theo danh mục / hãng / từ khoá đang chọn */}
        <div className="page-title">
          <h1>{currentCatName}</h1>
          {searchQuery && (
            <div className="search-tag">
              Kết quả cho: <strong>"{searchQuery}"</strong>
              <button onClick={clearSearch}><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Layout 2 cột: sidebar lọc (desktop cố định, mobile drawer) + lưới sản phẩm */}
        <div className="products-layout">
          {/* Sidebar cố định — chỉ hiển thị trên màn hình lớn (CSS ẩn trên mobile) */}
          <aside className="sidebar-desktop">{sidebarContent}</aside>

          {/* Drawer lọc trên mobile — mở khi nhấn nút "Bộ lọc" ở toolbar */}
          {filterOpen && (
            <>
              <div className="overlay" onClick={() => setFilterOpen(false)} />
              <aside className="sidebar-mobile">{sidebarContent}</aside>
            </>
          )}

          <div className="products-main">
            <div className="products-toolbar">
              <button className="filter-toggle" onClick={() => setFilterOpen(true)}>
                <SlidersHorizontal size={18} /> Bộ lọc
                {hasActiveFilter && <span className="filter-badge" />}
              </button>
              <span className="products-count">{filtered.length} sản phẩm</span>
              <select value={sort} onChange={e => setSort(e.target.value)} className="sort-select">
                {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="product-grid">
                {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filtered.length > 0 ? (
              <div className="product-grid">
                {filtered.map(p => <ProductCard key={p.id ?? p.productId} product={p} />)}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3>Không tìm thấy sản phẩm nào</h3>
                <p>Thử thay đổi bộ lọc hoặc tìm với từ khóa khác</p>
                <div className="empty-state-actions">
                  {hasActiveFilter && (
                    <button className="btn btn-outline" onClick={clearAllFilters}>
                      Xóa bộ lọc
                    </button>
                  )}
                  <Link to="/products" className="btn btn-primary">
                    Xem tất cả sản phẩm <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Products;
