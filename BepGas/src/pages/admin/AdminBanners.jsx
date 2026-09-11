// Trang quản lý banner quảng cáo cho Admin.
// 3 vị trí: hero (slider toàn màn hình), scroll (cuộn ngang), popup (xuất hiện khi vào trang).
// Banner có thể lên lịch theo ngày bắt đầu/kết thúc — backend tự lọc chỉ trả banner đang hoạt động.
// Hỗ trợ kéo thả để sắp xếp thứ tự hiển thị trong cùng một vị trí.
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Loader, X, Save, Image, Upload,
  Search, ChevronDown, GripVertical, AlertTriangle, Calendar, Clock, Eye, EyeOff,
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { bannerAPI, categoryAPI, productAPI } from '../../services/api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';

/* ── Constants ─────────────────────────────────────────── */
const emptyForm = {
  bannerTitle: '', imageUrl: '', linkUrl: '',
  position: 'hero', sortOrder: 0, isActive: true,
  startDate: '', endDate: '',
};

const STATIC_PAGES = [
  { label: 'Trang chủ',       url: '/'         },
  { label: 'Tất cả sản phẩm', url: '/products' },
  { label: 'Giỏ hàng',        url: '/cart'     },
  { label: 'Tài khoản',       url: '/account'  },
];

const positionLabel    = { hero:'Hero Section', sidebar:'Sidebar', popup:'Popup', scroll:'Cuộn ngang' };
const positionSizeHint = { hero:'1200 × 400 px', sidebar:'400 × 300 px', popup:'600 × 400 px', scroll:'800 × 300 px' };
const positionAspect   = { hero:'3/1', scroll:'8/3', sidebar:'4/3', popup:'3/2' };

const POSITIONS = [
  { id:'hero',    label:'Hero Section',  desc:'Slider full-width đầu trang',      size:'1200×400px' },
  { id:'scroll',  label:'Cuộn ngang',    desc:'Hàng banner cuộn ngang',           size:'800×300px'  },
  { id:'sidebar', label:'Sidebar',       desc:'Banner khối dọc',                  size:'400×300px'  },
  { id:'popup',   label:'Popup',         desc:'Hộp thoại 1 lần khi vào web',      size:'600×400px'  },
];

/* ── Helpers ─────────────────────────────────────────────── */
const detectLinkType = (url) => {
  if (!url) return null;
  if (STATIC_PAGES.some(p => p.url === url)) return null;
  if (/[?&](category|categoryId)=/.test(url)) return null;
  if (/^\/products\/[^?]+$/.test(url)) return 'product';
  return 'custom';
};

const toDatetimeLocal = (v) => {
  if (!v) return '';
  if (Array.isArray(v)) {
    const [Y, M, D, h = 0, m = 0] = v;
    return `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  return String(v).slice(0, 16);
};

const fmtBannerDate = (v) => {
  if (!v) return '';
  try {
    const d = Array.isArray(v) ? new Date(v[0], v[1]-1, v[2]) : new Date(String(v));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
  } catch { return ''; }
};

const getActive = (b) => b.active ?? b.isActive ?? true;

const parseDate = (v) => {
  if (!v) return null;
  try {
    if (Array.isArray(v)) { const [Y, M, D, h=0, m=0] = v; return new Date(Y, M-1, D, h, m); }
    return new Date(String(v));
  } catch { return null; }
};

const isExpiredBanner   = (b) => { const d = parseDate(b.endDate);   return !!d && new Date() > d; };
const isScheduledBanner = (b) => { const d = parseDate(b.startDate); return !!d && new Date() < d; };

/* ── Mini Mockup ─────────────────────────────────────────── */
const PositionMockup = ({ id, active }) => {
  const gray   = { background: '#e2e8f0', borderRadius: 2 };
  const accent = { background: active ? 'var(--primary)' : '#cbd5e1', borderRadius: 2, opacity: active ? 1 : 0.7 };
  if (id === 'hero') return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, width:88, height:60 }}>
      <div style={{ height:8, ...gray }} />
      <div style={{ height:22, ...accent }} />
      <div style={{ display:'flex', gap:3, flex:1 }}>{[0,1,2].map(i=><div key={i} style={{flex:1,...gray}}/>)}</div>
    </div>
  );
  if (id === 'sidebar') return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, width:88, height:60 }}>
      <div style={{ height:8, ...gray }} />
      <div style={{ display:'flex', gap:3, flex:1 }}>
        <div style={{ width:26, display:'flex', flexDirection:'column', gap:2 }}>
          <div style={{ flex:1, ...gray }}/><div style={{ height:18, ...accent }}/>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
          {[0,1].map(i=><div key={i} style={{flex:1,...gray}}/>)}
        </div>
      </div>
    </div>
  );
  if (id === 'popup') return (
    <div style={{ position:'relative', width:88, height:60 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:3, height:'100%' }}>
        <div style={{ height:8, ...gray }}/><div style={{ flex:1, ...gray }}/>
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.25)', borderRadius:2 }}/>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:52, height:34, borderRadius:4, ...accent }}/>
    </div>
  );
  if (id === 'scroll') return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, width:88, height:60 }}>
      <div style={{ height:8, ...gray }}/>
      <div style={{ display:'flex', gap:3, flex:1 }}>{[0,1].map(i=><div key={i} style={{flex:1,...accent}}/>)}</div>
      <div style={{ display:'flex', gap:3, height:6 }}>
        {[0,1,2].map(i=><div key={i} style={{ flex:1, height:5, borderRadius:99, background:i===0?(active?'var(--primary)':'#94a3b8'):'#e2e8f0' }}/>)}
      </div>
    </div>
  );
  return null;
};

/* ── GroupedLinkDropdown ─────────────────────────────────── */
const GroupedLinkDropdown = ({ value, categories, onSelect, onPickProduct, onCustom, onClear }) => {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const panelRef            = useRef(null);
  const inputRef            = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); else setSearch(''); }, [open]);

  const q = search.toLowerCase().trim();

  // Đọc cả 2 dạng link: ?category=slug (mới) và ?categoryId=id (banner cũ)
  const parseCategoryParam = (url) => {
    if (!url) return null;
    const raw = url.match(/[?&]category=([^&]+)/)?.[1] ?? url.match(/[?&]categoryId=([^&]+)/)?.[1];
    return raw ? decodeURIComponent(raw) : null;
  };

  const getLabel = () => {
    if (!value) return null;
    const s = STATIC_PAGES.find(p => p.url === value);
    if (s) return s.label;
    const catVal = parseCategoryParam(value);
    if (catVal) {
      const cat = categories.find(c => c.slug === catVal)
        ?? categories.find(c => String(c.categoryId ?? c.id) === catVal);
      return cat ? (cat.categoryName ?? cat.name) : value;
    }
    return null;
  };
  const label       = getLabel();
  const activeCatVal = parseCategoryParam(value);

  const filteredStatic = STATIC_PAGES.filter(p => !q || p.label.toLowerCase().includes(q) || p.url.includes(q));
  const filteredCats   = categories.filter(c => !q || (c.categoryName ?? c.name ?? '').toLowerCase().includes(q));

  const pick = (url) => { onSelect(url); setOpen(false); };

  return (
    <div style={{ position:'relative' }} ref={panelRef}>
      <button type="button" className={`link-dd-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className={label ? 'link-dd-value' : 'link-dd-placeholder'}>{label || '— Không có link —'}</span>
        <ChevronDown size={15} style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.2s', flexShrink:0 }}/>
      </button>
      {open && (
        <div className="link-dd-panel">
          <div className="link-dd-search">
            <Search size={14} color="var(--text-light)"/>
            <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên trang hoặc danh mục..."/>
            {search && <button type="button" onClick={() => setSearch('')} style={{ border:'none',background:'none',cursor:'pointer',padding:0,color:'var(--text-light)',display:'flex' }}><X size={13}/></button>}
          </div>

          {filteredStatic.length > 0 && (
            <div className="link-dd-group">
              <div className="link-dd-group-label">Trang hệ thống</div>
              {filteredStatic.map(p => (
                <button key={p.url} type="button" className={`link-dd-item ${value === p.url ? 'active' : ''}`} onClick={() => pick(p.url)}>
                  <span>{p.label}</span><code>{p.url}</code>
                </button>
              ))}
            </div>
          )}

          {filteredCats.length > 0 && (
            <div className="link-dd-group">
              <div className="link-dd-group-label">Danh mục sản phẩm</div>
              {filteredCats.map(c => {
                const cid      = c.categoryId ?? c.id;
                const slug     = c.slug || String(cid); // fallback sang ID khi danh mục thiếu slug
                const url      = `/products?category=${slug}`;
                const isActive = activeCatVal != null && (activeCatVal === slug || activeCatVal === String(cid));
                return (
                  <button key={cid} type="button" className={`link-dd-item ${isActive ? 'active' : ''}`} onClick={() => pick(url)}>
                    <span>{c.categoryName ?? c.name}</span><code>/products?category={slug}</code>
                  </button>
                );
              })}
            </div>
          )}

          {filteredStatic.length === 0 && filteredCats.length === 0 && q && (
            <p style={{ padding:'0.75rem', color:'var(--text-light)', fontSize:'0.84rem', margin:0 }}>
              Không tìm thấy "<strong>{q}</strong>"
            </p>
          )}

          <div className="link-dd-group link-dd-actions">
            <button type="button" className="link-dd-item link-dd-special" onClick={() => { onPickProduct(); setOpen(false); }}>
              <span>Tìm sản phẩm cụ thể...</span>
            </button>
            <button type="button" className="link-dd-item link-dd-special" onClick={() => { onCustom(); setOpen(false); }}>
              <span>Nhập URL tùy chỉnh...</span>
            </button>
            {value && (
              <button type="button" className="link-dd-item link-dd-clear" onClick={() => { onClear(); setOpen(false); }}>
                <span><X size={12}/> Bỏ link</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── SortableBannerCard ──────────────────────────────────── */
const SortableBannerCard = ({ banner, onEdit, onDelete, onToggle, products }) => {
  const bid = banner.bannerId ?? banner.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bid });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const isActive  = getActive(banner);
  const expired   = isExpiredBanner(banner);
  const scheduled = !expired && isScheduledBanner(banner);
  // Hết hạn thì banner không còn hiển thị trên web dù isActive vẫn true (khớp logic lọc
  // findVisibleBanners ở backend) — nút toggle phải phản ánh trạng thái THẬT này, không
  // phải cờ isActive thô, để tránh hiện "Kích hoạt" cho banner thực ra đã bị ẩn.
  const isLive    = isActive && !expired;
  const aspect    = positionAspect[banner.position] ?? '3/1';

  // Cảnh báo hết hàng — chỉ khi link trỏ trực tiếp vào 1 sản phẩm
  const slugMatch    = (banner.linkUrl ?? '').match(/^\/products\/([^?/]+)$/);
  const linkedProd   = slugMatch ? products.find(p =>
    (p.slug ?? p.productSlug ?? String(p.id ?? p.productId)) === slugMatch[1]
  ) : null;
  const outOfStock = linkedProd && (linkedProd.stockQty ?? 1) === 0;

  return (
    <div ref={setNodeRef} style={style}
      className={`ab-banner-card${isDragging ? ' ab-card-dragging' : ''}`}
      {...attributes}>

      {/* Tay kéo */}
      <button className="ab-drag-handle" {...listeners} title="Kéo để đổi thứ tự">
        <GripVertical size={16}/>
      </button>

      {/* Thumbnail */}
      <div className="ab-card-thumb" style={{ aspectRatio: aspect }}>
        {banner.imageUrl
          ? <img src={banner.imageUrl} alt={banner.bannerTitle || 'banner'}
              style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:4, display:'block' }}
              onError={e => { e.target.style.opacity = '0.3'; }}/>
          : <div className="ab-card-thumb-empty"><Image size={20} color="var(--border)"/></div>}
        {outOfStock && (
          <div className="ab-oos-badge"><AlertTriangle size={10}/> SP hết hàng</div>
        )}
      </div>

      {/* Thông tin */}
      <div className="ab-card-info">
        <div className="ab-card-name">
          {banner.bannerTitle || `${positionLabel[banner.position] ?? banner.position} #${banner.sortOrder}`}
        </div>
        <div className="ab-card-meta">
          {banner.linkUrl && (
            <code className="ab-card-link" title={banner.linkUrl}>{banner.linkUrl}</code>
          )}
          {(banner.startDate || banner.endDate) && (
            <span className="ab-date-hint">
              <Calendar size={11}/>
              {banner.startDate ? fmtBannerDate(banner.startDate) : ''}
              {banner.endDate   ? ` → ${fmtBannerDate(banner.endDate)}` : ''}
            </span>
          )}
        </div>
        <div className="ab-card-badges">
          <button
            className={`ab-toggle-btn ${isLive ? 'ab-toggle-on' : 'ab-toggle-off'}`}
            onClick={() => onToggle(bid, !isActive)}
            title={
              expired
                ? 'Đã hết hạn (qua ngày kết thúc) nên không hiển thị trên web dù kích hoạt hay không — sửa lại ngày kết thúc nếu muốn hiện lại'
                : (isActive ? 'Đang kích hoạt — click để tắt' : 'Đang tắt — click để bật')
            }>
            {isLive ? <Eye size={11}/> : <EyeOff size={11}/>}
            {isLive ? 'Kích hoạt' : 'Tắt'}
          </button>
          {expired   && <span className="admin-badge badge-red">Hết hạn</span>}
          {scheduled && <span className="admin-badge badge-yellow"><Clock size={10}/> Lên lịch</span>}
        </div>
      </div>

      {/* Hành động */}
      <div className="ab-card-actions">
        <button className="admin-action-btn edit"   onClick={() => onEdit(banner)}><Edit2  size={14}/></button>
        <button className="admin-action-btn delete" onClick={() => onDelete(bid)}> <Trash2 size={14}/></button>
      </div>
    </div>
  );
};

/* ── BannerSection ───────────────────────────────────────── */
const BannerSection = ({ posId, banners, products, onEdit, onDelete, onToggle, onAdd, onDragEnd }) => {
  const pos     = POSITIONS.find(p => p.id === posId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const ids     = useMemo(() => banners.map(b => b.bannerId ?? b.id), [banners]);

  return (
    <div className="ab-section">
      <div className="ab-section-header">
        <div className="ab-section-title-group">
          <h3 className="ab-section-title">{pos?.label}</h3>
          <span className="ab-section-hint">{pos?.desc} · {pos?.size}</span>
        </div>
        <div className="ab-section-right">
          <span className="ab-section-count">{banners.length} banner</span>
          <button className="admin-btn-primary ab-btn-add" onClick={onAdd}>
            <Plus size={14}/> Thêm
          </button>
        </div>
      </div>

      {banners.length === 0 ? (
        <div className="ab-empty-section">
          <Image size={28} color="var(--border)"/>
          <p>Chưa có banner ở vị trí này</p>
          <button className="ab-empty-add-btn" onClick={onAdd}><Plus size={13}/> Thêm banner đầu tiên</button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="ab-card-list">
              {banners.map(b => (
                <SortableBannerCard key={b.bannerId ?? b.id} banner={b}
                  products={products} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle}/>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════ */
const AdminBanners = () => {
  const [banners,         setBanners]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showModal,       setShowModal]       = useState(false);
  const [editing,         setEditing]         = useState(null);
  const [form,            setForm]            = useState(emptyForm);
  const [saving,          setSaving]          = useState(false);
  const [deleteId,        setDeleteId]        = useState(null);
  const [deleting,        setDeleting]        = useState(false);
  const [saveConfirm,     setSaveConfirm]     = useState(null);
  const [uploading,       setUploading]       = useState(false);
  const [dragOver,        setDragOver]        = useState(false);
  const [categories,      setCategories]      = useState([]);
  const [products,        setProducts]        = useState([]);
  const [scrollImages,    setScrollImages]    = useState([]);
  const [scrollDragOver,  setScrollDragOver]  = useState(null);

  const [linkMode,        setLinkMode]        = useState(null);
  const [productSearch,   setProductSearch]   = useState('');
  const [productResults,  setProductResults]  = useState([]);
  const [searchingProd,   setSearchingProd]   = useState(false);
  const [selectedProdName,setSelectedProdName]= useState('');

  const fileInputRef  = useRef(null);
  const scrollFileRef = useRef(null);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const nextSortOrder = (posId) => {
    const same = banners.filter(b => b.position === posId);
    if (same.length === 0) return 0;
    return Math.max(...same.map(b => Number(b.sortOrder ?? 0))) + 1;
  };

  // Gom nhóm banners theo vị trí, sắp xếp theo sortOrder
  const grouped = useMemo(() => {
    const g = { hero: [], scroll: [], sidebar: [], popup: [] };
    banners.forEach(b => { if (g[b.position]) g[b.position].push(b); });
    Object.keys(g).forEach(k => g[k].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    return g;
  }, [banners]);

  const fetchBanners = () =>
    bannerAPI.getAll().then(r => setBanners(r?.data ?? r ?? [])).catch(()=>{}).finally(()=>setLoading(false));

  useEffect(() => {
    fetchBanners();
    categoryAPI.getAll()
      .then(r => { const l=r?.data?.content??r?.data??r?.content??r??[]; setCategories(Array.isArray(l)?l:[]); })
      .catch(()=>{});
    productAPI.getAll(0, 200)
      .then(r => { const l=r?.data?.content??r?.content??[]; setProducts(Array.isArray(l)?l:[]); })
      .catch(()=>{});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (linkMode !== 'product' || !productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      setSearchingProd(true);
      try { const res=await productAPI.search(productSearch,0,8); setProductResults(res?.data?.content??res?.content??[]); }
      catch { setProductResults([]); }
      finally { setSearchingProd(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch, linkMode]);

  const resetLink = () => { set({linkUrl:''}); setLinkMode(null); setProductSearch(''); setProductResults([]); setSelectedProdName(''); };

  const pickProduct = (p) => {
    const pid=p.id??p.productId; const slug=p.slug??p.productSlug??pid;
    set({ linkUrl: `/products/${slug}` });
    setSelectedProdName(p.productName ?? String(slug));
    setProductResults([]); setProductSearch('');
  };

  const resetLinkState = (url) => {
    const mode = detectLinkType(url);
    setLinkMode(mode); setProductSearch(''); setProductResults([]);
    setSelectedProdName(mode==='product' ? (url??'') : '');
  };

  const openAdd = (posId = 'hero') => {
    setEditing(null);
    setForm({ ...emptyForm, position: posId, sortOrder: nextSortOrder(posId) });
    setScrollImages([]);
    resetLinkState('');
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditing(b.bannerId ?? b.id);
    const url = b.linkUrl ?? '';
    resetLinkState(url);
    setForm({
      bannerTitle: b.bannerTitle ?? '',
      imageUrl:    b.imageUrl    ?? '',
      linkUrl:     url,
      position:    b.position    ?? 'hero',
      sortOrder:   b.sortOrder   ?? 0,
      isActive:    getActive(b),
      startDate:   toDatetimeLocal(b.startDate),
      endDate:     toDatetimeLocal(b.endDate),
    });
    setShowModal(true);
  };

  const handleUpload = async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setUploading(true);
    try { const res=await bannerAPI.uploadImage(file); const url=res?.data??res; if(typeof url==='string') set({imageUrl:url}); }
    catch (err) { toast.error('Lỗi upload: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleScrollUploadMulti = async (files) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      setUploading(true);
      try {
        const res = await bannerAPI.uploadImage(file);
        const url = res?.data ?? res;
        if (typeof url === 'string') setScrollImages(imgs => [...imgs, url]);
      } catch (err) { toast.error('Lỗi upload: ' + err.message); }
      finally { setUploading(false); }
    }
  };

  const handleSave = () => {
    if (!form.bannerTitle.trim()) { toast.warn('Vui lòng nhập tên banner'); return; }
    if (form.position === 'scroll' && !editing) {
      if (!scrollImages.length) { toast.warn('Vui lòng thêm ít nhất 1 ảnh'); return; }
      setSaveConfirm({ mode: 'scroll', base: { ...form, startDate:form.startDate||null, endDate:form.endDate||null }, images: scrollImages });
      return;
    }
    if (!form.imageUrl.trim()) { toast.warn('Vui lòng chọn ảnh'); return; }
    setSaveConfirm({ mode: 'single', payload: { ...form, startDate:form.startDate||null, endDate:form.endDate||null } });
  };
  const doSave = async (conf) => {
    setSaveConfirm(null);
    setSaving(true);
    try {
      if (conf.mode === 'scroll') {
        const { base, images } = conf;
        const multi = images.length > 1;
        for (let i = 0; i < images.length; i++)
          await bannerAPI.create({
            ...base,
            imageUrl:    images[i],
            sortOrder:   Number(base.sortOrder) + i,
            bannerTitle: multi ? `${base.bannerTitle} #${i + 1}` : base.bannerTitle,
          });
        toast.success('Đã thêm banner thành công!');
      } else {
        const { payload } = conf;
        if (editing) await bannerAPI.update(editing, payload);
        else         await bannerAPI.create(payload);
        toast.success(editing ? 'Đã lưu thay đổi banner!' : 'Đã thêm banner thành công!');
      }
      setShowModal(false); fetchBanners();
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setSaving(false); }
  };

  // Toggle kích hoạt/tắt ngay trên card — không cần mở modal
  const handleToggle = async (bid, nextActive) => {
    const banner = banners.find(b => (b.bannerId ?? b.id) === bid);
    if (!banner) return;
    // Optimistic
    setBanners(prev => prev.map(b =>
      (b.bannerId ?? b.id) === bid ? { ...b, isActive: nextActive, active: nextActive } : b
    ));
    try {
      await bannerAPI.update(bid, { ...banner, isActive: nextActive });
      toast.success(nextActive ? 'Đã kích hoạt banner.' : 'Đã tắt banner.');
    } catch (err) {
      // Rollback
      setBanners(prev => prev.map(b =>
        (b.bannerId ?? b.id) === bid ? { ...b, isActive: !nextActive, active: !nextActive } : b
      ));
      toast.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await bannerAPI.delete(deleteId);
      setDeleteId(null); fetchBanners();
      toast.success('Đã xóa banner.');
    } catch (err) { toast.error('Lỗi xóa: ' + err.message); }
    finally { setDeleting(false); }
  };

  // Kéo thả để sắp xếp thứ tự trong một vị trí
  const handleDragEnd = async (e, position) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const group = [...(grouped[position] || [])];
    const from  = group.findIndex(b => (b.bannerId ?? b.id) === active.id);
    const to    = group.findIndex(b => (b.bannerId ?? b.id) === over.id);
    if (from === -1 || to === -1) return;
    const reordered = arrayMove(group, from, to);

    // Cập nhật UI ngay (optimistic)
    setBanners(prev => {
      const rest = prev.filter(b => b.position !== position);
      return [...rest, ...reordered.map((b, i) => ({ ...b, sortOrder: i }))];
    });

    // Chỉ lưu những banner thực sự thay đổi sortOrder
    try {
      const changed = reordered.filter((b, i) => (b.sortOrder ?? i) !== i);
      await Promise.all(
        changed.map((b) => {
          const newIdx = reordered.indexOf(b);
          const bid    = b.bannerId ?? b.id;
          return bannerAPI.update(bid, { ...b, sortOrder: newIdx });
        })
      );
      toast.success('Đã lưu thứ tự banner!');
    } catch {
      toast.error('Không thể lưu thứ tự. Vui lòng thử lại.');
      fetchBanners();
    }
  };

  if (loading) return <div className="admin-page admin-center"><Loader size={32} className="spin"/></div>;

  const isScrollNew = form.position === 'scroll' && !editing;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Quản lý quảng cáo</h1>
          <p className="ap-subtitle">{banners.length} banner · kéo &amp; thả để sắp xếp thứ tự</p>
        </div>
        <button className="admin-btn-primary" onClick={() => openAdd('hero')}>
          <Plus size={17}/> Thêm banner
        </button>
      </div>

      {/* ── 4 khu vực theo vị trí ── */}
      {POSITIONS.map(pos => (
        <BannerSection
          key={pos.id}
          posId={pos.id}
          banners={grouped[pos.id] ?? []}
          products={products}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
          onToggle={handleToggle}
          onAdd={() => openAdd(pos.id)}
          onDragEnd={(e) => handleDragEnd(e, pos.id)}
        />
      ))}

      {/* ══ MODAL FORM ══ */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="admin-modal" onClick={e=>e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? <><Edit2 size={17}/> Sửa banner</> : <><Plus size={17}/> Thêm banner</>}</h2>
              <button onClick={()=>setShowModal(false)}><X size={20}/></button>
            </div>

            <div className="admin-modal-body" style={{ overflowY: 'auto' }}>

              {/* 1. Tên banner */}
              <div className="admin-form-row">
                <label>Tên banner <span style={{color:'#ef4444'}}>*</span></label>
                <input
                  value={form.bannerTitle}
                  onChange={e=>set({bannerTitle:e.target.value})}
                  placeholder="VD: Khuyến mãi hè 2026 · Banner Tết · Xả kho tháng 5..."
                />
              </div>

              {/* 2. Vị trí */}
              <div className="admin-form-row">
                <label>Vị trí hiển thị</label>
                <div className="banner-pos-grid">
                  {POSITIONS.map(pos => {
                    const active = form.position === pos.id;
                    return (
                      <button key={pos.id} type="button"
                        className={`banner-pos-card ${active ? 'active' : ''}`}
                        onClick={() => set({
                          position:  pos.id,
                          sortOrder: nextSortOrder(pos.id),
                        })}>
                        <PositionMockup id={pos.id} active={active}/>
                        <div className="banner-pos-info">
                          <strong>{pos.label}</strong>
                          <span>{pos.desc}</span>
                          <code>{pos.size}</code>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Ảnh */}
              {isScrollNew ? (
                <div className="admin-form-row">
                  <label>Ảnh banner *
                    <span style={{fontWeight:400,color:'var(--text-light)',marginLeft:'0.5rem',fontSize:'0.8rem'}}>
                      800×300px · mỗi ảnh = 1 slide cuộn
                    </span>
                  </label>
                  {scrollImages.length > 0 && (
                    <>
                      <div className="ap-section-title" style={{marginBottom:'0.5rem'}}>
                        Ảnh đã thêm ({scrollImages.length})
                      </div>
                      <div className="admin-image-grid" style={{marginBottom:'0.75rem'}}>
                        {scrollImages.map((url, i) => (
                          <div key={i} className="admin-image-item">
                            <img src={url} alt={`slide ${i+1}`} onError={e=>e.target.style.opacity='0.3'}/>
                            <span className="admin-image-badge">#{i+1}</span>
                            <div className="admin-image-actions">
                              <button type="button" className="admin-img-btn del" title="Xóa ảnh"
                                onClick={()=>setScrollImages(imgs=>imgs.filter((_,j)=>j!==i))}>
                                <X size={13}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className={`ap-dropzone ${scrollDragOver === 'main' ? 'dragging' : ''}`}
                    style={{padding:'1.1rem 0.5rem'}}
                    onDragOver={e=>{e.preventDefault();setScrollDragOver('main');}}
                    onDragLeave={()=>setScrollDragOver(null)}
                    onDrop={e=>{e.preventDefault();setScrollDragOver(null);handleScrollUploadMulti(e.dataTransfer.files);}}
                    onClick={()=>scrollFileRef.current?.click()}>
                    {uploading
                      ? <><Loader size={22} className="spin"/><p style={{margin:0}}>Đang upload...</p></>
                      : <><Upload size={22}/><p style={{margin:0}}>Kéo thả ảnh vào đây</p><span>hoặc nhấn để chọn file — JPG, PNG, WEBP</span></>
                    }
                  </div>
                  <input ref={scrollFileRef} type="file" accept="image/*" multiple style={{display:'none'}}
                    onChange={e=>{handleScrollUploadMulti(e.target.files);e.target.value='';}}/>
                </div>
              ) : (
                <div className="admin-form-row">
                  <label>
                    Ảnh banner *
                    <span style={{fontWeight:400,color:'var(--text-light)',marginLeft:'0.5rem',fontSize:'0.8rem'}}>
                      {positionSizeHint[form.position]}
                    </span>
                  </label>
                  {form.imageUrl ? (
                    <div className="ap-img-preview ap-banner-preview"
                      title="Nhấn đúp để đổi ảnh"
                      onDoubleClick={() => fileInputRef.current?.click()}
                      style={{ aspectRatio: positionAspect[form.position], cursor:'pointer' }}>
                      <img src={form.imageUrl} alt="preview"
                        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', display:'block' }}
                        onError={e=>e.target.style.opacity='0.3'}/>
                      <div className="ap-preview-badge">{positionSizeHint[form.position]} · xem trước cắt ảnh</div>
                      <div className="ap-img-overlay">
                        <button type="button" className="ap-img-change-btn"
                          onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                          <Upload size={13}/> Đổi ảnh
                        </button>
                        <button type="button" className="ap-img-remove-btn" title="Xóa ảnh"
                          onClick={e => { e.stopPropagation(); set({imageUrl:''}); }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`ap-dropzone ${dragOver?'dragging':''}`}
                      style={{padding:'0.9rem', marginBottom:'0.4rem'}}
                      onClick={()=>fileInputRef.current?.click()}
                      onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
                      onDrop={e=>{e.preventDefault();setDragOver(false);handleUpload(e.dataTransfer.files[0]);}}>
                      {uploading
                        ? <><Loader size={20} className="spin"/><p style={{margin:0}}>Đang upload...</p></>
                        : <><Upload size={20}/><p style={{margin:0}}>Kéo thả hoặc nhấn để chọn ảnh</p><span style={{fontSize:'0.78rem'}}>JPG, PNG, WEBP</span></>}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{handleUpload(e.target.files[0]);e.target.value='';}}/>
                  <input value={form.imageUrl} onChange={e=>set({imageUrl:e.target.value})}
                    placeholder="Hoặc dán URL ảnh trực tiếp..."
                    style={{marginTop:'0.35rem'}}/>
                </div>
              )}

              {/* 4. Liên kết */}
              <div className="admin-form-row">
                <label>Liên kết khi nhấn</label>
                <GroupedLinkDropdown
                  value={linkMode===null ? form.linkUrl : ''}
                  categories={categories}
                  onSelect={(url) => { set({linkUrl:url}); setLinkMode(null); setProductSearch(''); setProductResults([]); setSelectedProdName(''); }}
                  onPickProduct={() => { setLinkMode('product'); set({linkUrl:''}); setSelectedProdName(''); }}
                  onCustom={() => { setLinkMode('custom'); set({linkUrl:''}); }}
                  onClear={resetLink}
                />
                {linkMode==='product' && (
                  <div style={{marginTop:'0.45rem'}}>
                    {form.linkUrl && (
                      <div className="link-selected-tag">
                        <span>{selectedProdName||form.linkUrl}<code style={{marginLeft:'0.4rem',fontSize:'0.72rem'}}>{form.linkUrl}</code></span>
                        <button type="button" onClick={resetLink}><X size={13}/></button>
                      </div>
                    )}
                    <div className="link-product-search">
                      <Search size={15} color="var(--text-light)"/>
                      <input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Gõ tên sản phẩm để tìm..." autoComplete="off"/>
                      {searchingProd&&<Loader size={14} className="spin"/>}
                    </div>
                    {productResults.length>0&&(
                      <div className="link-product-results">
                        {productResults.map(p=>{
                          const pid=p.id??p.productId; const slug=p.slug??p.productSlug??pid;
                          return (
                            <button key={pid} type="button" className="link-product-item" onClick={()=>pickProduct(p)}>
                              {p.imageUrl?<img src={p.imageUrl} alt={p.productName} style={{width:42,height:42,objectFit:'cover',borderRadius:4,flexShrink:0}}/>
                                :<div style={{width:42,height:42,background:'var(--bg-gray)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Image size={16} color="var(--border)"/></div>}
                              <div>
                                <div className="link-product-name">{p.productName}</div>
                                <div className="link-product-url">/products/{slug}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {productSearch.trim()&&!searchingProd&&productResults.length===0&&(
                      <p style={{fontSize:'0.82rem',color:'var(--text-light)',marginTop:'0.4rem',padding:'0.3rem 0'}}>Không tìm thấy sản phẩm nào</p>
                    )}
                  </div>
                )}
                {linkMode==='custom'&&(
                  <input value={form.linkUrl} onChange={e=>set({linkUrl:e.target.value})}
                    placeholder="/custom-page hoặc https://..." style={{marginTop:'0.45rem'}} autoComplete="off"/>
                )}
              </div>

              {/* 5. Thứ tự + Trạng thái */}
              <div className="admin-form-2col">
                <div className="admin-form-row">
                  <label>Thứ tự hiển thị</label>
                  <input type="number" min={0} value={form.sortOrder} onChange={e=>set({sortOrder:e.target.value})}/>
                </div>
                <div className="admin-form-row">
                  <label>Trạng thái</label>
                  <select value={String(form.isActive)} onChange={e=>set({isActive:e.target.value==='true'})}>
                    <option value="true">Kích hoạt</option>
                    <option value="false">Tắt</option>
                  </select>
                </div>
              </div>

              {/* 7. Lịch chạy */}
              <div className="admin-form-2col">
                <div className="admin-form-row">
                  <label>Bắt đầu <span style={{fontWeight:400,color:'var(--text-light)',fontSize:'0.78rem'}}>ngày &amp; giờ</span></label>
                  <input type="datetime-local" value={form.startDate} onChange={e=>set({startDate:e.target.value})}/>
                </div>
                <div className="admin-form-row">
                  <label>Kết thúc <span style={{fontWeight:400,color:'var(--text-light)',fontSize:'0.78rem'}}>ngày &amp; giờ</span></label>
                  <input type="datetime-local" value={form.endDate} onChange={e=>set({endDate:e.target.value})}/>
                </div>
              </div>

            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={()=>setShowModal(false)}>Huỷ</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving||uploading}>
                {saving?<Loader size={15} className="spin"/>:<Save size={15}/>}
                {editing?'Lưu thay đổi':(isScrollNew&&scrollImages.length>1)?`Thêm ${scrollImages.length} banner`:'Thêm banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={editing ? 'Lưu thay đổi banner?' : saveConfirm?.mode === 'scroll' ? `Thêm ${saveConfirm?.images?.length ?? 1} banner cuộn ngang?` : 'Thêm banner mới?'}
        message={editing ? 'Thông tin banner sẽ được cập nhật.' : 'Banner mới sẽ được thêm vào hệ thống.'}
        confirmLabel={editing ? 'Lưu thay đổi' : 'Thêm mới'}
        onConfirm={() => doSave(saveConfirm)}
        onCancel={() => setSaveConfirm(null)}
        loading={saving}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Xóa banner"
        message="Banner sẽ bị xóa vĩnh viễn khỏi hệ thống.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa banner"
        onConfirm={handleDelete}
        onCancel={()=>setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
};

export default AdminBanners;