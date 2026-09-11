// Trang quản lý sản phẩm cho Admin — CRUD đầy đủ với upload ảnh và thông số kỹ thuật JSON.
// Slug được tự sinh từ tên sản phẩm khi tạo mới, có thể chỉnh tay sau đó.
// Ảnh upload lên ImgBB qua productAPI.uploadImages, có thể đặt ảnh chính (isPrimary).
// Chế độ xem lưới (card) và danh sách (table) để phù hợp với nhiều tình huống quản lý.
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Edit2, Trash2, Eye, Loader, X, Save,
  Upload, Star, Image, Package, LayoutGrid, List,
  ShieldCheck, Wrench, Tag, Settings2, FileText, Lock, Unlock, ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminAPI, brandAPI, productAPI } from '../../services/api';
import { toast } from '../../utils/toast';
import { toSlug } from '../../utils/formatters';
import { PRODUCT_STATUS_MAP as statusMap } from '../../constants/adminConstants';
import { useCategories } from '../../context/CategoryContext';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorState from '../../components/ErrorState';

// Sản phẩm có stockQty <= 5 được đánh dấu "sắp hết" màu vàng trong danh sách.
const LOW_STOCK_THRESHOLD = 5;

// Dropdown danh mục custom — luôn mở xuống dưới, không bị native select tự lật ngược
const CategorySelect = ({ value, onChange, categories, childMap, placeholder = '-- Chọn danh mục --', allLabel }) => {
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const getLabel = (val) => {
    if (!val || val === 'all') return allLabel ?? placeholder;
    const strVal = String(val);
    for (const parent of categories.filter(c => !c.parentCategoryId)) {
      const pid = String(parent.categoryId ?? parent.id);
      if (pid === strVal) return parent.categoryName ?? parent.name;
      const ch = (childMap[pid] ?? []).find(c => String(c.categoryId ?? c.id) === strVal);
      if (ch) return `↳ ${ch.categoryName ?? ch.name}`;
    }
    return placeholder;
  };

  const select = (val) => { onChange(val); setOpen(false); };

  return (
    <div ref={wrapRef} className="ap-cat-sel-wrap">
      <button type="button" className={`ap-cat-sel-btn ${open ? 'open' : ''}`} onClick={() => setOpen(v => !v)}>
        <span className="ap-cat-sel-label">{getLabel(value)}</span>
        <ChevronDown size={14} className={`ap-cat-sel-arrow ${open ? 'open' : ''}`}/>
      </button>
      {open && (
        <div className="ap-cat-sel-menu">
          {allLabel && (
            <div className={`ap-cat-sel-option ${!value || value === 'all' ? 'active' : ''}`} onClick={() => select('all')}>
              {allLabel}
            </div>
          )}
          {!allLabel && (
            <div className={`ap-cat-sel-option ap-cat-sel-placeholder ${!value ? 'active' : ''}`} onClick={() => select('')}>
              {placeholder}
            </div>
          )}
          {categories.filter(c => !c.parentCategoryId).map(parent => {
            const pid      = String(parent.categoryId ?? parent.id);
            const children = childMap[pid] ?? [];
            return (
              <Fragment key={pid}>
                <div className={`ap-cat-sel-group ${String(value) === pid ? 'active' : ''}`} onClick={() => select(pid)}>
                  {parent.categoryName ?? parent.name}
                </div>
                {children.map(ch => {
                  const cid = String(ch.categoryId ?? ch.id);
                  return (
                    <div key={cid} className={`ap-cat-sel-option ap-cat-sel-child ${String(value) === cid ? 'active' : ''}`} onClick={() => select(cid)}>
                      ↳ {ch.categoryName ?? ch.name}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

// BrandSelect — dropdown tùy chỉnh cho thương hiệu, tái dùng CSS của CategorySelect (ap-cat-sel-*)
// để có sẵn max-height + overflow-y: auto — tránh tràn ra ngoài khi danh sách thương hiệu dài.
const BrandSelect = ({ value, onChange, brands, placeholder = '-- Chọn thương hiệu --' }) => {
  const [open, setOpen] = useState(false);
  const wrapRef         = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const getLabel = (val) => {
    if (!val) return placeholder;
    const b = brands.find(b => String(b.brandId ?? b.id) === String(val));
    return b ? (b.name ?? b.brandName) : placeholder;
  };

  const select = (val) => { onChange(val); setOpen(false); };

  return (
    <div ref={wrapRef} className="ap-cat-sel-wrap">
      <button type="button" className={`ap-cat-sel-btn ${open ? 'open' : ''}`} onClick={() => setOpen(v => !v)}>
        <span className="ap-cat-sel-label">{getLabel(value)}</span>
        <ChevronDown size={14} className={`ap-cat-sel-arrow ${open ? 'open' : ''}`}/>
      </button>
      {open && (
        <div className="ap-cat-sel-menu">
          <div className={`ap-cat-sel-option ap-cat-sel-placeholder ${!value ? 'active' : ''}`} onClick={() => select('')}>
            {placeholder}
          </div>
          {brands.map(b => {
            const bid = String(b.brandId ?? b.id);
            return (
              <div key={bid} className={`ap-cat-sel-option ${String(value) === bid ? 'active' : ''}`} onClick={() => select(bid)}>
                {b.name ?? b.brandName}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const emptyForm = {
  name: '', slug: '', shortDesc: '', description: '',
  sku: '', warrantyMonths: '', weight: '', status: 'active',
  isFeatured: false, requiresInstallation: false, installationFee: '',
  categoryId: '', brandId: '', specifications: '',
  price: '', salePrice: '', stockQty: '',
};

const TABS = [
  { id: 'info',   label: 'Thông tin', icon: FileText  },
  { id: 'specs',  label: 'Thông số',  icon: Settings2 },
  { id: 'images', label: 'Ảnh',       icon: Image     },
];

/* ── Format số có dấu phân cách hàng nghìn ───────────────── */
const fmtNum = (v) =>
  v !== '' && v !== null && !isNaN(v)
    ? Number(v).toLocaleString('vi-VN')
    : '';
const parseNum = (s) => s.replace(/[^\d]/g, '');

/* ── Input giá tiền (hiển thị có dấu phân cách) ─────────── */
const PriceInput = ({ value, onChange, placeholder }) => (
  <div className="num-input-wrap">
    <input
      type="text"
      inputMode="numeric"
      value={fmtNum(value)}
      onChange={e => onChange(parseNum(e.target.value))}
      placeholder={placeholder}
    />
    {value !== '' && <span className="num-input-suffix">đ</span>}
  </div>
);

/* ══════════════════════════════════════════════════════════ */
const AdminProducts = () => {
  const [searchParams]             = useSearchParams();
  const { categories, childMap }   = useCategories();
  const [products,  setProducts]   = useState([]);
  const [brands,    setBrands]     = useState([]);
  const [loading,   setLoading]    = useState(true);
  const [error,     setError]      = useState('');
  const [search,    setSearch]     = useState('');
  const [catFilter,    setCatFilter]    = useState('all');
  // statusFilter: 'all' | 'active' | 'low_stock' | 'out_of_stock' | 'inactive' | 'featured'
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');

  // Sync filter/sort từ URL params — chạy lại mỗi khi URL thay đổi (kể cả navigate cùng route)
  useEffect(() => {
    if (searchParams.get('lowStock') === '1') setStatusFilter('low_stock');
    else if (searchParams.get('status') === 'out_of_stock') setStatusFilter('out_of_stock');
    else setStatusFilter('all');

    setSortBy(searchParams.get('sort') === 'sold' ? 'sold' : 'default');
  }, [searchParams]);
  const [view, setView] = useState('grid');

  // modal
  const [showModal,  setShowModal]  = useState(false);
  const [activeTab,  setActiveTab]  = useState('info');
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [slugLocked, setSlugLocked] = useState(true);  // true = readonly, false = editable
  const [deleteId,   setDeleteId]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(null);

  // specs
  const [specs,     setSpecs]     = useState([]);
  const [colors,    setColors]    = useState([]);
  const [colorName, setColorName] = useState('');
  const [colorHex,  setColorHex]  = useState('#000000');

  // images
  const [images,           setImages]           = useState([]);
  const [uploadFiles,      setUploadFiles]      = useState([]);
  const [previewUrls,      setPreviewUrls]      = useState([]);
  // Xóa ảnh / đặt ảnh chính chỉ áp dụng thật lên server khi nhấn "Lưu thay đổi" —
  // trước đó chỉ là thay đổi tạm trên UI để có thể hủy bằng cách đóng modal không lưu.
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);
  const [pendingPrimaryId, setPendingPrimaryId] = useState(null);
  const fileInputRef = useRef(null);

  /* ── Fetch ───────────────────────────────────────────────── */
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getProducts(0, 500);
      setProducts(res?.data?.content ?? res?.content ?? res?.data ?? []);
    } catch (err) { setError(err.message); }
    finally      { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchProducts();
    brandAPI.getAll().then(r => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBrands(r?.data?.content ?? r?.content ?? r?.data ?? r ?? []);
    }).catch(() => {});
  }, [fetchProducts]);

  // Tạo preview URL và dọn dẹp khi uploadFiles thay đổi
  useEffect(() => {
    const urls = uploadFiles.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [uploadFiles]);

  /* ── Lọc sản phẩm ────────────────────────────────────────── */
  const filtered = products
    .filter(p => {
      const name = (p.productName ?? p.name ?? '').toLowerCase();
      const qty  = p.stockQty ?? 0;
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchCat    = catFilter === 'all' || String(p.categoryId) === catFilter;
      const matchStatus =
        statusFilter === 'all'       ? true :
        statusFilter === 'low_stock' ? (p.status === 'active' && qty > 0 && qty <= LOW_STOCK_THRESHOLD) :
        statusFilter === 'featured'  ? !!p.isFeatured :
                                       p.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    })
    .sort((a, b) => sortBy === 'sold' ? (b.soldQty ?? 0) - (a.soldQty ?? 0) : 0);
  const filterActive = search !== '' || catFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'default';
  const clearFilters = () => { setSearch(''); setCatFilter('all'); setStatusFilter('all'); setSortBy('default'); };

  /* ── Mở modal ───────────────────────────────────────────── */
  const openAdd = () => {
    setEditing(null); setForm(emptyForm); setActiveTab('info');
    setSpecs([]); setColors([]); setColorName(''); setColorHex('#000000');
    setImages([]); setUploadFiles([]);
    setPendingDeleteIds([]); setPendingPrimaryId(null);
    setSlugLocked(true);
    setShowModal(true);
  };

  const openEdit = async (p) => {
    const id = p.productId ?? p.id;
    setEditing(id); setActiveTab('info'); setUploadFiles([]);
    setPendingDeleteIds([]); setPendingPrimaryId(null);
    setSlugLocked(false); // slug đã tồn tại, cho sửa
    try {
      const obj = JSON.parse(p.specifications || '{}');
      const { colors: saved, ...rest } = obj;
      setColors(Array.isArray(saved) ? saved : []);
      setColorName(''); setColorHex('#000000');
      setSpecs(Object.entries(rest).map(([key, value]) => ({ key, value: String(value) })));
    } catch { setSpecs([]); setColors([]); }

    const name = p.productName ?? p.name ?? '';
    setForm({
      name,
      slug: p.slug ?? '',
      shortDesc: p.shortDesc ?? '', description: p.description ?? '',
      sku: p.sku ?? '', warrantyMonths: p.warrantyMonths || '',
      weight: p.weight ?? '', status: p.status ?? 'active',
      isFeatured: p.isFeatured ?? false,
      requiresInstallation: p.requiresInstallation ?? false,
      installationFee: p.installationFee != null ? String(p.installationFee) : '',
      categoryId: p.categoryId ?? '', brandId: p.brandId ?? '',
      specifications: p.specifications ?? '',
      price:    String(p.price    ?? ''),
      salePrice: String(p.salePrice ?? ''),
      stockQty:  String(p.stockQty  ?? ''),
    });

    const imgRes = await productAPI.getImages(id).catch(() => null);
    setImages(imgRes?.data ?? imgRes ?? []);
    setShowModal(true);
  };

  /* ── Lưu sản phẩm — tạo + upload ảnh cùng lúc ───────────── */
  const handleSave = () => {
    if (!form.name.trim()) { setActiveTab('info'); toast.warn('Vui lòng nhập tên sản phẩm'); return; }

    const specsObj = {};
    specs.filter(s => s.key.trim()).forEach(s => { specsObj[s.key.trim()] = s.value; });
    if (colors.length > 0) specsObj.colors = colors;

    const payload = {
      ...form,
      specifications:  JSON.stringify(specsObj),
      warrantyMonths:  form.warrantyMonths  !== '' ? parseInt(form.warrantyMonths)        : 0,
      stockQty:        form.stockQty        !== '' ? parseInt(form.stockQty)              : 0,
      weight:          form.weight          !== '' ? parseFloat(form.weight)              : null,
      price:           form.price           !== '' ? parseFloat(form.price)               : null,
      salePrice:       form.salePrice       !== '' ? parseFloat(form.salePrice)           : null,
      installationFee: form.installationFee !== '' ? parseFloat(form.installationFee)     : null,
    };
    setSaveConfirm(payload);
  };
  const doSave = async (payload) => {
    setSaveConfirm(null);
    try {
      setSaving(true);
      let savedId = editing;
      if (editing) {
        await adminAPI.updateProduct(editing, payload);
      } else {
        const res = await adminAPI.createProduct(payload);
        savedId = res?.data?.id ?? res?.id;
      }
      if (uploadFiles.length > 0 && savedId) {
        const fd = new FormData();
        uploadFiles.forEach(f => fd.append('files', f));
        await productAPI.uploadImages(savedId, fd);
      }
      // Áp dụng các thay đổi ảnh đã đánh dấu (xóa / đặt ảnh chính) lên server — chỉ tới lúc này mới thật sự thực hiện.
      for (const imgId of pendingDeleteIds) {
        await productAPI.deleteImage(imgId);
      }
      if (pendingPrimaryId) {
        await productAPI.setPrimaryImage(pendingPrimaryId);
      }
      setPendingDeleteIds([]); setPendingPrimaryId(null);
      setShowModal(false);
      fetchProducts();
      toast.success(editing ? 'Đã lưu sản phẩm!' : 'Đã thêm sản phẩm!');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally      { setSaving(false); }
  };

  /* ── Ảnh — chỉ đánh dấu thay đổi cục bộ, thực sự gửi lên server khi nhấn "Lưu thay đổi" ── */
  const visibleImages   = images.filter(img => !pendingDeleteIds.includes(img.id));
  const effectivePrimaryId = pendingPrimaryId
    ?? visibleImages.find(img => img.isPrimary)?.id
    ?? visibleImages[0]?.id
    ?? null;

  const handleDeleteImage = (imageId) => {
    setPendingDeleteIds(prev => [...prev, imageId]);
    // Nếu ảnh đang đánh dấu xóa là ảnh chính hiện hành, tự chọn ảnh còn lại đầu tiên làm ảnh chính tạm
    if (effectivePrimaryId === imageId) {
      const remaining = images.filter(img => img.id !== imageId && !pendingDeleteIds.includes(img.id));
      setPendingPrimaryId(remaining[0]?.id ?? null);
    }
  };

  const handleSetPrimary = (imageId) => {
    setPendingPrimaryId(imageId);
  };

  /* ── Xoá sản phẩm ────────────────────────────────────────── */
  const handleDelete = async (id) => {
    try {
      setDeleting(true);
      await adminAPI.deleteProduct(id);
      setDeleteId(null); fetchProducts();
      toast.success('Đã xóa sản phẩm.');
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  const getCatName = (p) => {
    const cat = categories.find(c => (c.categoryId ?? c.id) === p.categoryId);
    return cat?.categoryName ?? cat?.name ?? '—';
  };
  const getPrimaryImage = (p) =>
    p.images?.find(i => i.isPrimary)?.imageUrl
    ?? p.images?.[0]?.imageUrl
    ?? p.primaryImageUrl ?? p.imageUrls?.[0] ?? null;

  const tabIdx = TABS.findIndex(t => t.id === activeTab);
  const isLastTab = tabIdx === TABS.length - 1;

  /* ── Loading / Error ─────────────────────────────────────── */
  if (loading) return <div className="admin-page admin-center"><Loader size={32} className="spin"/><p>Đang tải...</p></div>;
  if (error)   return <div className="admin-page admin-center"><ErrorState message={error} onRetry={fetchProducts} /></div>;

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="admin-page">

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1>Quản lý sản phẩm</h1>
          <p className="ap-subtitle">{products.length} sản phẩm trong kho</p>
        </div>
        <button className="admin-btn-primary" onClick={openAdd}>
          <Plus size={17}/> Thêm sản phẩm
        </button>
      </div>

      {/* Quick stats — nhấn để lọc theo trạng thái */}
      <div className="ap-quick-stats">
        {[
          { label:'Tất cả',    value: products.length,                                                                                                     color:'#3b82f6', bg:'#eff6ff', filter:'all'         },
          { label:'Đang bán',  value: products.filter(p=>p.status==='active').length,                                                                     color:'#10b981', bg:'#ecfdf5', filter:'active'      },
          { label:'Sắp hết',   value: products.filter(p=>p.status==='active'&&(p.stockQty??0)>0&&(p.stockQty??0)<=LOW_STOCK_THRESHOLD).length,             color:'#f97316', bg:'#fff7ed', filter:'low_stock'   },
          { label:'Hết hàng',  value: products.filter(p=>p.status==='out_of_stock').length,                                                               color:'#ef4444', bg:'#fee2e2', filter:'out_of_stock' },
          { label:'Ngừng bán', value: products.filter(p=>p.status==='inactive').length,                                                                   color:'#6b7280', bg:'#f3f4f6', filter:'inactive'     },
          { label:'Nổi bật',   value: products.filter(p=>p.isFeatured).length,                                                                            color:'#6366f1', bg:'#eef2ff', filter:'featured'     },
        ].map((s,i) => (
          <div key={i} className="ap-stat"
            style={{'--sc':s.color,'--sb':s.bg, cursor:'pointer',
              outline: statusFilter === s.filter ? `2px solid ${s.color}` : 'none'}}
            onClick={() => setStatusFilter(s.filter)}
            title={`Nhấn để lọc: ${s.label}`}>
            <strong>{s.value}</strong><span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17}/>
          <input placeholder="Tìm tên sản phẩm..." value={search} onChange={e=>setSearch(e.target.value)}/>
          {search && (
            <button className="search-clear-btn" onClick={()=>setSearch('')} title="Xóa tìm kiếm">
              <X size={14}/>
            </button>
          )}
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="admin-select">
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang bán</option>
          <option value="low_stock">Sắp hết hàng (≤{LOW_STOCK_THRESHOLD})</option>
          <option value="out_of_stock">Hết hàng</option>
          <option value="inactive">Ngừng bán</option>
          <option value="featured">Nổi bật</option>
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="admin-select">
          <option value="default">Sắp xếp mặc định</option>
          <option value="sold">Bán chạy nhất</option>
        </select>
        <CategorySelect
          value={catFilter}
          onChange={setCatFilter}
          categories={categories}
          childMap={childMap}
          allLabel="Tất cả danh mục"
        />
        {/* Nút xóa bộ lọc */}
        {filterActive && (
          <button className="admin-btn-ghost ap-clear-filter" onClick={clearFilters}>
            <X size={14}/> Xóa bộ lọc
          </button>
        )}
        <span className="admin-count">{filtered.length} kết quả</span>
        <div className="ap-view-toggle">
          <button className={view==='grid'?'active':''} onClick={()=>setView('grid')}><LayoutGrid size={16}/></button>
          <button className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={16}/></button>
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        filtered.length === 0 ? <EmptyState hasFilter={filterActive} onClear={clearFilters}/> :
        <div className="ap-grid">
          {filtered.map(p => (
            <ProductCard key={p.productId??p.id} p={p} catName={getCatName(p)}
              imgUrl={getPrimaryImage(p)} onEdit={()=>openEdit(p)}
              onDelete={()=>setDeleteId(p.productId??p.id)}/>
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="admin-card">
          <table className="admin-table">
            <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Thương hiệu</th><th>Trạng thái</th><th>Tồn kho</th><th>Bảo hành</th><th>Thao tác</th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} className="text-light text-center">Không có sản phẩm</td></tr>
                : filtered.map(p => (
                  <tr key={p.productId??p.id}>
                    <td>
                      <div className="admin-product-cell">
                        {getPrimaryImage(p)
                          ? <img src={getPrimaryImage(p)} alt={p.productName??p.name}/>
                          : <div className="ap-no-img"><Package size={18}/></div>}
                        <div>
                          <div className="ap-list-name">{p.productName??p.name}</div>
                          {p.sku && <div className="text-light">SKU: {p.sku}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="admin-cat-tag">{getCatName(p)}</span></td>
                    <td className="text-light">{brands.find(b=>(b.brandId??b.id)===p.brandId)?.name??'—'}</td>
                    <td><span className={`admin-badge ${statusMap[p.status]?.cls??'badge-gray'}`}>{statusMap[p.status]?.label??p.status}</span></td>
                    <td><StockBadge p={p}/></td>
                    <td className="text-light">{p.warrantyMonths ? <span style={{color:'#10b981',fontWeight:600}}>BH {p.warrantyMonths} tháng</span> : <span style={{color:'#9ca3af'}}>Không BH</span>}</td>
                    <td>
                      <div className="admin-actions">
                        <Link to={`/products/${p.slug??p.productId}`} target="_blank" className="admin-action-btn view"><Eye size={15}/></Link>
                        <button className="admin-action-btn edit" onClick={()=>openEdit(p)}><Edit2 size={15}/></button>
                        <button className="admin-action-btn delete" onClick={()=>setDeleteId(p.productId??p.id)}><Trash2 size={15}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODAL ══════════════════════════════════════════════ */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="admin-modal admin-modal-wide" onClick={e=>e.stopPropagation()}>

            <div className="admin-modal-header">
              <h2>{editing?<><Edit2 size={17}/> Sửa sản phẩm</>:<><Plus size={17}/> Thêm sản phẩm mới</>}</h2>
              <button onClick={()=>setShowModal(false)}><X size={20}/></button>
            </div>

            {/* Tabs */}
            <div className="ap-tabs">
              {TABS.map((t,i) => {
                const Icon  = t.icon;
                const badge = t.id==='specs'  && specs.length>0
                            ? specs.length
                            : t.id==='images' && (images.length+uploadFiles.length)>0
                            ? images.length+uploadFiles.length
                            : null;
                const done  = i < tabIdx;
                return (
                  <button key={t.id} className={`ap-tab ${activeTab===t.id?'active':''} ${done?'done':''}`}
                    onClick={()=>setActiveTab(t.id)}>
                    <Icon size={15}/>{t.label}
                    {badge!==null&&<span className="ap-tab-badge">{badge}</span>}
                  </button>
                );
              })}
            </div>

            <div className="admin-modal-body" style={{padding:'1.5rem', overflowY:'auto'}}>

              {/* ── TAB 1: Thông tin ── */}
              {activeTab === 'info' && (
                <div className="ap-tab-content">
                  <div className="ap-form-grid">

                    {/* Tên sản phẩm */}
                    <div className="admin-form-row ap-col-2">
                      <label>Tên sản phẩm *</label>
                      <input
                        value={form.name}
                        onChange={e => {
                          const name = e.target.value;
                          setForm(f => ({
                            ...f,
                            name,
                            slug: slugLocked ? toSlug(name) : f.slug,
                          }));
                        }}
                        placeholder="Nhập tên đầy đủ"
                      />
                    </div>

                    {/* Slug — readonly mặc định, mở khoá bằng nút bút chì */}
                    <div className="admin-form-row">
                      <label>
                        Slug (URL)
                        {slugLocked && <span style={{fontSize:'0.7rem',color:'var(--primary)',marginLeft:'0.4rem'}}>tự động</span>}
                      </label>
                      <div className="ap-slug-row">
                        <input
                          value={form.slug}
                          readOnly={slugLocked}
                          onChange={e => !slugLocked && setForm(f=>({...f,slug:e.target.value}))}
                          placeholder="ten-san-pham"
                          style={{fontFamily:'monospace',fontSize:'0.85rem',background:slugLocked?'var(--bg-gray)':undefined,flex:1}}
                        />
                        <button
                          type="button"
                          className={`ap-slug-lock-btn ${!slugLocked?'unlocked':''}`}
                          title={slugLocked?'Nhấn để sửa slug':'Đang sửa slug'}
                          onClick={()=>setSlugLocked(v=>!v)}
                        >
                          {slugLocked?<Lock size={14}/>:<Unlock size={14}/>}
                        </button>
                      </div>
                    </div>

                    <div className="admin-form-row">
                      <label>SKU</label>
                      <input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="VD: BSP-001"/>
                    </div>
                    <div className="admin-form-row">
                      <label>Danh mục</label>
                      <CategorySelect
                        value={form.categoryId}
                        onChange={v => setForm({ ...form, categoryId: v })}
                        categories={categories}
                        childMap={childMap}
                      />
                    </div>
                    <div className="admin-form-row">
                      <label>Thương hiệu</label>
                      <BrandSelect
                        value={form.brandId}
                        onChange={v => setForm({ ...form, brandId: v })}
                        brands={brands}
                      />
                    </div>
                    <div className="admin-form-row">
                      <label>Thời hạn bảo hành (tháng) <span style={{fontWeight:400,color:'var(--text-light)',fontSize:'0.8rem'}}>— Nhập 0 nếu không bảo hành</span></label>
                      <input type="number" min={0} value={form.warrantyMonths} onChange={e=>setForm({...form,warrantyMonths:e.target.value})}/>
                    </div>
                    <div className="admin-form-row">
                      <label>Khối lượng (kg)</label>
                      <input type="number" min={0} step="0.1" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/>
                    </div>
                    <div className="admin-form-row">
                      <label>Trạng thái</label>
                      <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                        <option value="active">Đang bán</option>
                        <option value="inactive">Ngừng bán</option>
                        <option value="out_of_stock">Hết hàng</option>
                      </select>
                    </div>

                    {/* Giá — có dấu phân cách hàng nghìn */}
                    <div className="admin-form-row">
                      <label>Giá gốc (đ)</label>
                      <PriceInput value={form.price} onChange={v=>setForm({...form,price:v})} placeholder="VD: 2.500.000"/>
                    </div>
                    <div className="admin-form-row">
                      <label>Giá khuyến mãi (đ) <span style={{color:'var(--text-light)',fontWeight:400,fontSize:'0.7rem'}}>để trống nếu không giảm</span></label>
                      <PriceInput value={form.salePrice} onChange={v=>setForm({...form,salePrice:v})} placeholder="Để trống = không giảm"/>
                    </div>

                    {/* Tồn kho */}
                    <div className="admin-form-row">
                      <label>Tồn kho</label>
                      <input type="number" min={0} value={form.stockQty} onChange={e=>setForm({...form,stockQty:e.target.value})} placeholder="0"/>
                    </div>

                    {/* Mô tả ngắn → TEXTAREA (không phải input) */}
                    <div className="admin-form-row ap-col-2">
                      <label>Mô tả ngắn <span style={{color:'var(--text-light)',fontWeight:400,fontSize:'0.7rem'}}>hiển thị trang danh sách</span></label>
                      <textarea
                        rows={3}
                        value={form.shortDesc}
                        onChange={e=>setForm({...form,shortDesc:e.target.value})}
                        placeholder="Mô tả ngắn gọn về sản phẩm, tối đa 2-3 câu..."
                        style={{resize:'vertical',minHeight:'72px'}}
                      />
                    </div>

                    <div className="admin-form-row ap-col-2">
                      <label>Mô tả chi tiết</label>
                      <textarea rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mô tả đầy đủ về sản phẩm" style={{maxHeight:'200px', resize:'vertical'}}/>
                    </div>

                    <div className="admin-form-row ap-col-2">
                      <label style={{marginBottom:'0.5rem'}}>Tuỳ chọn</label>
                      <div className="ap-checkbox-group ap-checkbox-row">
                        <label className="ap-checkbox">
                          <input type="checkbox" checked={form.isFeatured} onChange={e=>setForm({...form,isFeatured:e.target.checked})}/>
                          <span className="ap-check-box"><Star size={11}/></span>Sản phẩm nổi bật
                        </label>
                        <label className="ap-checkbox">
                          <input type="checkbox" checked={form.requiresInstallation} onChange={e=>setForm({...form,requiresInstallation:e.target.checked})}/>
                          <span className="ap-check-box"><Wrench size={11}/></span>Cần lắp đặt
                        </label>
                      </div>
                    </div>

                    {form.requiresInstallation && (
                      <div className="admin-form-row">
                        <label>
                          Phí lắp đặt (đ)
                          <span style={{color:'var(--text-light)',fontWeight:400,fontSize:'0.7rem',marginLeft:'0.4rem'}}>để trống = dùng mặc định 150.000đ</span>
                        </label>
                        <PriceInput value={form.installationFee} onChange={v=>setForm({...form,installationFee:v})} placeholder="Để trống = 150.000đ"/>
                      </div>
                    )}
                  </div>

                  {/* Màu sắc */}
                  <div className="admin-form-row" style={{marginTop:'0.5rem'}}>
                    {/*<label>Màu sắc</label>*/}
                    {/*colors.length > 0 && (
                      <div className="ap-color-list">
                        {colors.map((c,i) => (
                          <div key={i} className="ap-color-tag">
                            <span className="ap-color-swatch" style={{background:c.hex}}/>
                            <span className="ap-color-label">{c.name}</span>
                            <button className="ap-color-remove" onClick={()=>setColors(prev=>prev.filter((_,j)=>j!==i))}><X size={11}/></button>
                          </div>
                        ))}
                      </div>
                    )*/}
                    {/*<div className="ap-color-input-row">
                      <input type="color" value={colorHex} onChange={e=>setColorHex(e.target.value)} className="ap-color-picker" title="Chọn màu"/>
                      <input type="text" value={colorName} onChange={e=>setColorName(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'&&colorName.trim()){setColors(p=>[...p,{name:colorName.trim(),hex:colorHex}]);setColorName('');}}}
                        placeholder="Tên màu (VD: Đen, Trắng...)" className="ap-color-name-input"/>
                      <button className="admin-btn-primary" style={{padding:'0.5rem 0.9rem',fontSize:'0.85rem'}}
                        onClick={()=>{if(!colorName.trim())return;setColors(p=>[...p,{name:colorName.trim(),hex:colorHex}]);setColorName('');}}>
                        <Plus size={14}/> Thêm
                      </button>
                    </div>*/}
                  </div>
                </div>
              )}

              {/* ── TAB 2: Thông số kỹ thuật ── */}
              {activeTab === 'specs' && (
                <div className="ap-tab-content">
                  <div className="ap-specs-header">
                    <p className="text-light" style={{fontSize:'0.85rem'}}>Thêm thông số kỹ thuật hiển thị trên trang sản phẩm.</p>
                    <button className="admin-btn-primary" onClick={()=>setSpecs(prev=>[...prev,{key:'',value:''}])}>
                      <Plus size={15}/> Thêm thông số
                    </button>
                  </div>
                  {specs.length === 0 ? (
                    <div className="ap-empty-tab"><Settings2 size={32}/><p>Chưa có thông số nào</p></div>
                  ) : (
                    <div className="ap-specs-list">
                      {specs.map((s,i) => (
                        <div key={i} className="ap-spec-row">
                          <input className="ap-spec-key" placeholder="Tên thông số (VD: Công suất)" value={s.key}
                            onChange={e=>setSpecs(prev=>prev.map((x,j)=>j===i?{...x,key:e.target.value}:x))}/>
                          <span className="ap-spec-sep">:</span>
                          <input className="ap-spec-val" placeholder="Giá trị (VD: 4000W)" value={s.value}
                            onChange={e=>setSpecs(prev=>prev.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/>
                          <button className="admin-action-btn delete" onClick={()=>setSpecs(prev=>prev.filter((_,j)=>j!==i))}><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {specs.some(s=>s.key.trim()) && (
                    <details className="ap-specs-preview">
                      <summary>Xem JSON</summary>
                      <pre>{JSON.stringify(Object.fromEntries(specs.filter(s=>s.key.trim()).map(s=>[s.key,s.value])),null,2)}</pre>
                    </details>
                  )}
                </div>
              )}

              {/* ── TAB 3: Ảnh — cho phép chọn ảnh trước khi lưu ── */}
              {activeTab === 'images' && (
                <div className="ap-tab-content">
                  {/* Xóa cảnh báo cũ — upload ảnh được xử lý đồng thời khi tạo sản phẩm */}

                  {/* Ảnh đã lưu (khi sửa) — xóa / đặt ảnh chính ở đây chỉ là tạm, áp dụng thật khi nhấn "Lưu thay đổi" */}
                  {visibleImages.length > 0 && (
                    <>
                      <div className="ap-section-title">
                        Ảnh đã lưu ({visibleImages.length})
                        <span style={{marginLeft:'0.5rem',fontSize:'0.72rem',color:'var(--text-light)'}}>— thay đổi sẽ áp dụng khi nhấn "Lưu thay đổi"</span>
                      </div>
                      <div className="admin-image-grid" style={{marginBottom:'1rem'}}>
                        {visibleImages.map(img => {
                          const isPrimary = img.id === effectivePrimaryId;
                          return (
                            <div key={img.id} className={`admin-image-item ${isPrimary?'is-primary':''}`}>
                              <img src={img.imageUrl} alt={img.altText??''}/>
                              {isPrimary && <span className="admin-image-badge">Chính</span>}
                              <div className="admin-image-actions">
                                {!isPrimary && (
                                  <button className="admin-img-btn star" title="Đặt ảnh chính" onClick={()=>handleSetPrimary(img.id)}><Star size={13}/></button>
                                )}
                                <button className="admin-img-btn del" title="Xóa ảnh" onClick={()=>handleDeleteImage(img.id)}><X size={13}/></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Preview ảnh mới chọn */}
                  {uploadFiles.length > 0 && (
                    <>
                      <div className="ap-section-title">
                        Ảnh đã chọn ({uploadFiles.length})
                        {!editing && <span style={{marginLeft:'0.5rem',fontSize:'0.72rem',color:'var(--text-light)'}}>— sẽ được upload cùng khi nhấn "Tạo sản phẩm"</span>}
                      </div>
                      <div className="admin-image-grid" style={{marginBottom:'1rem'}}>
                        {uploadFiles.map((file,i) => (
                          <div key={i} className="admin-image-item preview">
                            <img src={previewUrls[i]} alt={file.name}/>
                            <span className="admin-image-badge new">Mới</span>
                            <div className="admin-image-actions">
                              <button className="admin-img-btn del" onClick={()=>setUploadFiles(prev=>prev.filter((_,j)=>j!==i))}><X size={13}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Dropzone */}
                  <div className="ap-dropzone"
                    onClick={()=>fileInputRef.current?.click()}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('dragging');}}
                    onDragLeave={e=>e.currentTarget.classList.remove('dragging')}
                    onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('dragging');setUploadFiles(prev=>[...prev,...Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/'))]);}}
                  >
                    <Upload size={28}/>
                    <p>Kéo thả ảnh vào đây</p>
                    <span>hoặc nhấn để chọn file — JPG, PNG, WEBP</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:'none'}}
                    onChange={e=>{setUploadFiles(prev=>[...prev,...Array.from(e.target.files)]);e.target.value='';}}/>
                </div>
              )}
            </div>

            {/* Footer — nút Submit chỉ hiện trên tab cuối (khi thêm mới), luôn hiện khi sửa */}
            <div className="admin-modal-footer">
              <div className="ap-tab-nav">
                {tabIdx > 0 && (
                  <button className="admin-btn-ghost" onClick={()=>setActiveTab(TABS[tabIdx-1].id)}>
                    ← Trước
                  </button>
                )}
                {!isLastTab && (
                  <button className="admin-btn-ghost" onClick={()=>setActiveTab(TABS[tabIdx+1].id)}>
                    Tiếp theo →
                  </button>
                )}
              </div>
              <div style={{display:'flex',gap:'0.75rem'}}>
                <button className="admin-btn-ghost" onClick={()=>setShowModal(false)}>Huỷ</button>
                {/* Nút lưu: luôn hiện khi editing, chỉ hiện ở tab cuối khi thêm mới */}
                {(editing || isLastTab) && (
                  <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving?<Loader size={16} className="spin"/>:<Save size={16}/>}
                    {editing ? 'Lưu thay đổi' : `Tạo sản phẩm${uploadFiles.length>0?` + ${uploadFiles.length} ảnh`:''}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={editing ? 'Lưu thay đổi sản phẩm?' : 'Thêm sản phẩm mới?'}
        message={editing ? 'Thông tin sản phẩm sẽ được cập nhật.' : 'Sản phẩm mới sẽ được thêm vào hệ thống.'}
        confirmLabel={editing ? 'Lưu thay đổi' : 'Thêm mới'}
        onConfirm={() => doSave(saveConfirm)}
        onCancel={() => setSaveConfirm(null)}
        loading={saving}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Xóa sản phẩm"
        message="Sản phẩm sẽ bị xóa vĩnh viễn cùng toàn bộ hình ảnh.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa sản phẩm"
        onConfirm={() => handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
};

/* ── Nhãn tồn kho — dùng trên card và trong bảng ─────────── */
const StockBadge = ({ p, overlay = false }) => {
  const qty = p.stockQty ?? 0;
  const isEmpty  = qty === 0 || p.status === 'out_of_stock';
  const isLow    = !isEmpty && qty <= LOW_STOCK_THRESHOLD && p.status === 'active';
  const cls      = isEmpty ? 'ap-stock-empty' : isLow ? 'ap-stock-low' : 'ap-stock-ok';
  const label    = isEmpty ? 'Hết tồn' : isLow ? `Sắp hết: còn ${qty}` : `Còn ${qty}`;
  return <span className={`${overlay ? 'ap-card-stock' : 'ap-stock-table'} ${cls}`}>{label}</span>;
};

/* ── Card sản phẩm — action buttons lớn hơn ───────────────── */
const ProductCard = ({ p, catName, imgUrl, onEdit, onDelete }) => {
  const st   = statusMap[p.status] ?? { label: p.status, cls: 'badge-gray' };
  const name = p.productName ?? p.name ?? 'Sản phẩm';
  return (
    <div className="ap-card">
      <div className="ap-card-img">
        {imgUrl
          ? <img src={imgUrl} alt={name}
              onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
          : null}
        <div className="ap-card-no-img" style={{display:imgUrl?'none':'flex'}}><Package size={32}/></div>
        {/* Nhãn lớp 1: trạng thái bán — góc trên phải */}
        <span className={`ap-card-status admin-badge ${st.cls}`}>{st.label}</span>
        {p.isFeatured && (
          <span className="ap-card-featured" title="Nổi bật" style={{background:'#eef2ff',color:'#6366f1'}}>★</span>
        )}
        {/* Nhãn lớp 2: tồn kho — góc dưới trái */}
        <StockBadge p={p} overlay />
      </div>
      <div className="ap-card-body">
        <p className="ap-card-cat"><Tag size={11}/> {catName}</p>
        <h3 className="ap-card-name" title={name}>{name}</h3>
        {p.shortDesc && <p className="ap-card-desc">{p.shortDesc}</p>}
        <div className="ap-card-meta">
          {p.warrantyMonths>0 && <span className="ap-meta-tag"><ShieldCheck size={12}/> BH {p.warrantyMonths} tháng</span>}
          {p.requiresInstallation && <span className="ap-meta-tag"><Wrench size={12}/> Lắp đặt</span>}
          {p.sku && <span className="ap-meta-tag"><Tag size={12}/> {p.sku}</span>}
        </div>
      </div>
      {/* Actions — to hơn, có separator trước nút xóa */}
      <div className="ap-card-footer">
        <Link to={`/products/${p.slug??p.productId}`} target="_blank" className="ap-action-btn ap-action-view" title="Xem trang">
          <Eye size={16}/>
        </Link>
        <button className="ap-action-btn ap-action-edit" title="Sửa sản phẩm" onClick={onEdit}>
          <Edit2 size={16}/>
        </button>
        <span className="ap-action-divider"/>
        <button className="ap-action-btn ap-action-del" title="Xoá sản phẩm" onClick={onDelete}>
          <Trash2 size={16}/>
        </button>
      </div>
    </div>
  );
};

const EmptyState = ({ hasFilter, onClear }) => (
  <div className="ap-empty">
    <Package size={48}/>
    <p>{hasFilter ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có sản phẩm nào'}</p>
    {hasFilter
      ? <button className="admin-btn-ghost" onClick={onClear}><X size={14}/> Xóa bộ lọc</button>
      : <span>Nhấn "Thêm sản phẩm" để bắt đầu</span>}
  </div>
);

export default AdminProducts;