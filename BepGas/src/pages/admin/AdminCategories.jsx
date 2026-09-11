/*
 * Trang quản lý danh mục — Admin
 * Hỗ trợ danh mục cha/con 2 cấp, kéo thả sắp xếp thứ tự (drag-and-drop),
 * upload icon lên ImgBB, khoá/mở khoá, xoá (không xoá nếu có sản phẩm).
 * Dùng CategoryContext để các component khác (Header, Home) tự cập nhật sau khi sửa.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useCategories } from '../../context/CategoryContext';
import {
  Plus, Edit2, Trash2, Loader, X, Save,
  Lock, Unlock, GripVertical, ChevronDown,
  Search, Upload, Link,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminCategoryAPI } from '../../services/api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import Switch from '../../components/Switch';
import { toSlug } from '../../utils/formatters';
import { getCategoryEmoji, DEFAULT_EMOJI } from '../../constants/emojis';
import {
  CATEGORY_ICONS, ICON_REGISTRY, isIconName, renderCategoryIcon,
} from '../../constants/categoryIcons';

/* ── Chuẩn hoá field-name: chấp nhận cả camelCase (frontend) và snake_case (backend) ──
   Mục đích: backend có thể trả về categoryId hoặc category_id, hàm này đảm bảo
   component luôn dùng tên nhất quán dù backend đổi cách đặt tên.              ── */
const normalize = (c) => ({
  ...c,
  categoryId:       c.categoryId       ?? c.category_id       ?? c.id,
  categoryName:     c.categoryName     ?? c.category_name     ?? c.name ?? '',
  parentCategoryId: c.parentCategoryId ?? c.parent_category_id ?? null,
  isActive:         c.isActive         ?? c.is_active          ?? c.active ?? true,
  sortOrder:        c.sortOrder        ?? c.sort_order         ?? 0,
  slug:             c.slug             ?? '',
  imageUrl:         c.imageUrl         ?? c.image_url          ?? '',
});

/* ── Lấy trạng thái hiển thị — backend cũ dùng active, mới dùng isActive ── */
const getActive = (c) => c.isActive ?? c.active ?? false;

/* ── Giá trị mặc định khi mở modal thêm mới ── */
const emptyForm = { categoryName: '', slug: '', imageUrl: '', sortOrder: 0, isActive: true, parentCategoryId: null };

/* ══════════════════════════════════════════════════════════════════════════ */
/*  SortableRow — Một hàng trong bảng danh mục, hỗ trợ kéo thả sắp xếp      */
/*  Props:                                                                    */
/*    cat        — đối tượng danh mục (đã normalize)                         */
/*    onEdit     — mở modal sửa với dữ liệu của hàng này                     */
/*    onDelete   — mở confirm xóa                                            */
/*    onToggle   — bật/tắt hiển thị không cần mở modal                       */
/*    toggling   — id đang xử lý toggle (để hiện spinner)                    */
/*    parentName — tên danh mục cha (nếu là danh mục con)                    */
/* ══════════════════════════════════════════════════════════════════════════ */
function SortableRow({ cat, onEdit, onDelete, onToggle, toggling, parentName }) {
  const cid    = cat.categoryId ?? cat.id;
  const active = getActive(cat);

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: cid });

  /* Ưu tiên icon SVG từ registry (imageUrl là tên icon),
     nếu không có thì lấy emoji tự động theo tên danh mục */
  const iconEl = (() => {
    const svg = renderCategoryIcon(cat, { size: 22, color: 'var(--primary)' });
    if (svg !== null) return svg;
    return getCategoryEmoji(cat);
  })();

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.45 : 1,
        background: isDragging ? 'var(--bg-gray)' : undefined,
        position:   isDragging ? 'relative' : undefined,
        zIndex:     isDragging ? 50 : undefined,
      }}
    >
      {/* Drag handle */}
      <td style={{ width:28, padding:'0 4px 0 8px' }}>
        <button
          {...attributes}
          {...listeners}
          title="Kéo để sắp xếp"
          style={{
            background:'none', border:'none', cursor:'grab',
            color:'var(--text-light)', padding:'4px', borderRadius:4,
            display:'flex', alignItems:'center',
          }}
        >
          <GripVertical size={15}/>
        </button>
      </td>

      {/* Icon */}
      <td style={{ width:56 }}>
        <div className="cat-icon-cell">{iconEl}</div>
      </td>

      {/* Cấp */}
      <td style={{ width:90 }}>
        {cat.parentCategoryId
          ? <span className="cat-child-badge">↳ {parentName ?? 'Con'}</span>
          : <span className="cat-root-badge">Gốc</span>}
      </td>

      {/* Tên */}
      <td>
        <span style={{ fontWeight:600, fontSize:'0.9rem' }}>
          {cat.categoryName ?? cat.name}
        </span>
      </td>

      {/* Slug */}
      <td className="text-light" style={{ fontFamily:'monospace', fontSize:'0.82rem' }}>
        {cat.slug}
      </td>

      {/* Thứ tự */}
      <td style={{ textAlign:'center', fontWeight:600, fontSize:'0.88rem', color:'var(--text-light)' }}>
        {cat.sortOrder ?? 0}
      </td>

      {/* Trạng thái */}
      <td>
        <Switch
          checked={active}
          onChange={() => onToggle(cat)}
          labelOn="Hiển thị" labelOff="Ẩn"
          loading={toggling === cid}
        />
      </td>

      {/* Thao tác */}
      <td>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button className="ap-action-btn ap-action-edit" title="Sửa" onClick={() => onEdit(cat)}>
            <Edit2 size={15}/>
          </button>
          <span className="ap-action-divider"/>
          <button className="ap-action-btn ap-action-del" title="Xóa" onClick={() => onDelete(cid)}>
            <Trash2 size={15}/>
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  AdminCategories — Trang quản lý danh mục                                 */
/*  Luồng hoạt động:                                                          */
/*    1. Mount → fetchCats() lấy danh sách từ backend                        */
/*    2. Bảng hiển thị displayCats (gốc trước, con sau, sắp theo sortOrder)  */
/*    3. Kéo thả → handleDragEnd → gán sortOrder mới → gọi API reorder       */
/*    4. Thêm/Sửa → modal form → confirm → doSave → fetchCats + refreshMenu  */
/*    5. Xóa → confirm modal → handleDelete → fetchCats + refreshMenu        */
/* ══════════════════════════════════════════════════════════════════════════ */
const AdminCategories = () => {
  const { refreshCategories } = useCategories(); // cập nhật mega menu header ngay sau khi lưu

  /* ── Dữ liệu danh mục ── */
  const [cats,         setCats]         = useState([]);
  /* ── Trạng thái UI chung ── */
  const [loading,      setLoading]      = useState(true);   // đang tải dữ liệu ban đầu
  const [showModal,    setShowModal]    = useState(false);   // modal thêm/sửa có mở không
  const [editing,      setEditing]      = useState(null);   // null = thêm mới, có giá trị = id đang sửa
  const [form,         setForm]         = useState(emptyForm); // dữ liệu trong form modal
  const [saving,       setSaving]       = useState(false);   // đang gọi API lưu
  const [deleteId,     setDeleteId]     = useState(null);   // id cần xóa (mở confirm xóa)
  const [deleting,     setDeleting]     = useState(false);   // đang gọi API xóa
  const [saveConfirm,  setSaveConfirm]  = useState(null);   // payload đang chờ xác nhận lưu
  const [toggling,     setToggling]     = useState(null);   // id đang toggle hiển thị

  /* ── Trạng thái slug ── */
  const [slugLocked,   setSlugLocked]   = useState(false);  // khoá thì slug không tự sinh theo tên

  /* ── Trạng thái icon picker ── */
  const [showEmojiGrid, setShowEmojiGrid] = useState(false); // popover chọn icon có mở không
  const [iconSearch,    setIconSearch]    = useState('');    // text tìm kiếm trong picker
  const [urlDraft,      setUrlDraft]      = useState('');    // URL đang gõ để dán ảnh ngoài
  const [uploading,     setUploading]     = useState(false); // đang upload ảnh lên ImgBB
  const [imgDragOver,   setImgDragOver]   = useState(false); // đang kéo file vào vùng upload
  const [pickerStyle,   setPickerStyle]   = useState({});   // vị trí fixed của popover

  /* ── Trạng thái combobox chọn danh mục cha ── */
  const [parentSearch,  setParentSearch]  = useState('');   // text đang gõ trong combobox
  const [parentOpen,    setParentOpen]    = useState(false); // dropdown combobox có mở không

  /* ── Tham chiếu DOM ── */
  const pickerRef    = useRef(null);  // vùng popover icon (dùng để detect click-outside)
  const pickerBtnRef = useRef(null);  // nút toggle picker (dùng để tính vị trí popover)
  const imgFileRef   = useRef(null);  // input[type=file] ẩn cho upload ảnh
  const parentRef    = useRef(null);  // combobox danh mục cha (detect click-outside)
  const origSlugRef  = useRef('');    // lưu slug gốc khi mở edit, dùng để cảnh báo nếu đổi slug

  /* Mở icon picker với vị trí fixed — tính từ getBoundingClientRect của nút toggle.
     Tự chọn hiển thị bên dưới hoặc bên trên tuỳ vùng trống còn lại trong modal,
     giới hạn maxHeight để không che khuất nút Lưu/Hủy ở footer modal.          */
  const openPicker = () => {
    if (pickerBtnRef.current) {
      const r = pickerBtnRef.current.getBoundingClientRect();
      // Tìm modal cha gần nhất để tính vùng an toàn
      const modal = pickerBtnRef.current.closest('.admin-modal');
      const modalRect = modal ? modal.getBoundingClientRect() : null;
      // safeBottom: đáy modal trừ ~72px (footer chứa nút Lưu/Hủy)
      const safeBottom = modalRect
        ? modalRect.bottom - 72
        : window.innerHeight - 80;
      const below = safeBottom - r.bottom - 6;
      const above = r.top - (modalRect ? modalRect.top + 8 : 12);
      const fitsDown = below >= 180;
      setPickerStyle(fitsDown
        ? { top:    r.bottom + 6, left: r.left, width: r.width,
            maxHeight: Math.max(180, Math.min(below, 380)) }
        : { bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width,
            maxHeight: Math.max(180, Math.min(above, 380)) }
      );
    }
    setShowEmojiGrid(true);
    setIconSearch('');
  };

  /* Đóng icon picker khi click ra ngoài vùng popover và nút toggle */
  useEffect(() => {
    if (!showEmojiGrid) return;
    const onOutside = (e) => {
      if (
        pickerRef.current    && !pickerRef.current.contains(e.target) &&
        pickerBtnRef.current && !pickerBtnRef.current.contains(e.target)
      ) setShowEmojiGrid(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showEmojiGrid]);

  /* Đóng dropdown combobox danh mục cha khi click ra ngoài */
  useEffect(() => {
    if (!parentOpen) return;
    const onOutside = (e) => {
      if (parentRef.current && !parentRef.current.contains(e.target)) {
        setParentOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [parentOpen]);

  /* Cấu hình sensor kéo thả: phải kéo ít nhất 8px mới kích hoạt,
     tránh nhầm với sự kiện click thông thường vào nút sửa/xóa      */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* Danh mục gốc luôn trên cùng, con xếp theo sortOrder bên dưới */
  const displayCats = useMemo(() => {
    const roots    = cats.filter(c => !c.parentCategoryId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const children = cats.filter(c =>  c.parentCategoryId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return [...roots, ...children];
  }, [cats]);

  /* ── Lấy danh sách danh mục từ backend ──
     Gọi lại sau mỗi thao tác thêm/sửa/xóa để bảng luôn đồng bộ với server */
  const fetchCats = () => {
    setLoading(true);
    adminCategoryAPI.getAll()
      .then(r => setCats((r?.data ?? r ?? []).map(normalize)))
      .catch(err => toast.error('Không tải được danh mục: ' + (err.message ?? 'Lỗi kết nối')))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCats(); }, []); // chỉ chạy 1 lần khi component mount

  /* Helper: lấy tên danh mục cha hiện tại từ form.parentCategoryId */
  const currentParentName = (pid, catList) =>
    pid ? (catList.find(p => String(p.categoryId ?? p.id) === String(pid))?.categoryName ?? '') : '';

  /* Đổi danh mục cha trong form: nếu đổi nhóm (gốc→con, con→gốc, hoặc đổi sang cha khác)
     thì tự đặt sortOrder = max toàn bảng + 1 (giống quy ước có sẵn ở openAdd/handleDragEnd
     — sortOrder dùng chung 1 dãy số cho cả gốc và con, không tách riêng theo từng cha),
     tránh số thứ tự cũ (thuộc nhóm cũ) bị mang sang gây trùng với danh mục khác. */
  const applyParent = (f, pid) => {
    if ((f.parentCategoryId ?? null) === pid) return { ...f, parentCategoryId: pid };
    const maxOrder = cats
      .filter(c => String(c.categoryId ?? c.id) !== String(editing))
      .reduce((m, c) => Math.max(m, c.sortOrder ?? 0), -1);
    return { ...f, parentCategoryId: pid, sortOrder: maxOrder + 1 };
  };

  /* ── Xử lý kết thúc kéo thả ──
     Optimistic update: cập nhật UI ngay lập tức (không chờ server),
     sau đó gửi thứ tự mới lên API. Nếu API lỗi thì revert về dữ liệu server. */
  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx  = displayCats.findIndex(c => (c.categoryId ?? c.id) === active.id);
    const newIdx  = displayCats.findIndex(c => (c.categoryId ?? c.id) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    // displayCats luôn hiển thị gốc trước - con sau (tính lại độc lập theo nhóm mỗi lần
    // render), nên kéo xuyên giữa 2 nhóm không có tác dụng thật (nhóm gốc luôn bị đẩy lên
    // đầu lại) mà còn làm xáo trộn ngầm sortOrder của các dòng khác. Đổi cấp gốc/con phải
    // qua modal sửa (đã kiểm tra hợp lệ) — kéo-thả chỉ cho sắp xếp trong cùng nhóm.
    const isRoot = (c) => !c.parentCategoryId;
    if (isRoot(displayCats[oldIdx]) !== isRoot(displayCats[newIdx])) return;
    // Hoán đổi vị trí và gán sortOrder = vị trí index trong mảng mới
    const newCats = arrayMove(displayCats, oldIdx, newIdx).map((c, i) => ({ ...c, sortOrder: i }));
    setCats(newCats);
    try {
      await adminCategoryAPI.reorder(
        newCats.map(c => ({ id: c.categoryId ?? c.id, sortOrder: c.sortOrder }))
      );
    } catch { fetchCats(); } // lỗi → tải lại từ server để revert
  };


  /* ── Reset trạng thái các picker về mặc định khi đóng/mở modal ── */
  const resetPickerState = () => {
    setShowEmojiGrid(false);
    setIconSearch('');
    setUrlDraft('');
    setParentOpen(false);
  };

  /* ── Bật/tắt hiển thị trực tiếp từ bảng (không mở modal) ──
     Cập nhật UI trước (optimistic), rollback nếu API lỗi              */
  const handleToggle = async (cat) => {
    const cid    = cat.categoryId ?? cat.id;
    const newVal = !getActive(cat);
    setToggling(cid);
    setCats(prev => prev.map(c => (c.categoryId ?? c.id) === cid ? { ...c, isActive: newVal } : c));
    try {
      await adminCategoryAPI.update(cid, {
        ...cat,
        isActive:           newVal,
        parent_category_id: cat.parentCategoryId ?? null,
      });
    } catch {
      setCats(prev => prev.map(c => (c.categoryId ?? c.id) === cid ? { ...c, isActive: !newVal } : c));
      toast.error('Không thể cập nhật trạng thái');
    } finally { setToggling(null); }
  };

  /* ── Mở modal thêm mới ──
     sortOrder mặc định = max hiện tại + 1 (tự động xếp vào cuối)   */
  const openAdd = () => {
    const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), -1);
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: maxOrder + 1 });
    setSlugLocked(false);
    setParentSearch('');
    resetPickerState();
    setShowModal(true);
  };

  /* ── Mở modal sửa ──
     Nạp toàn bộ dữ liệu của danh mục vào form, khoá slug để tránh
     vô tình đổi và làm hỏng các link/banner đang dùng slug đó        */
  const openEdit = (c) => {
    setEditing(c.categoryId ?? c.id);
    origSlugRef.current = c.slug ?? '';
    setSlugLocked(true);
    resetPickerState();
    const pid = c.parentCategoryId ?? null;
    const parentName = pid
      ? (cats.find(p => String(p.categoryId ?? p.id) === String(pid))?.categoryName ?? '')
      : '';
    setParentSearch(parentName);
    setForm({
      categoryName:     c.categoryName ?? c.name ?? '',
      slug:             c.slug ?? '',
      imageUrl:         c.imageUrl ?? '',
      sortOrder:        c.sortOrder ?? 0,
      isActive:         getActive(c),
      parentCategoryId: pid,
    });
    setShowModal(true);
  };

  /* ── Upload icon ảnh lên ImgBB thông qua backend proxy ──
     Không upload thẳng từ trình duyệt để ẩn API key của ImgBB       */
  const handleIconUpload = async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const res = await adminCategoryAPI.uploadIcon(file);
      const url = res?.data ?? res;
      if (typeof url === 'string') {
        setForm(f => ({ ...f, imageUrl: url }));
        setShowEmojiGrid(false);
      }
    } catch (err) { toast.error('Lỗi upload: ' + err.message); }
    finally { setUploading(false); }
  };

  /* ── Áp dụng URL ảnh người dùng dán vào trường nhập ── */
  const applyUrl = (url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setForm(f => ({ ...f, imageUrl: trimmed }));
    setUrlDraft('');
    setShowEmojiGrid(false);
  };

  /* ── Khi tên thay đổi: tự sinh slug nếu slug chưa bị khoá ──
     Slug chỉ tự sinh khi thêm mới (slugLocked = false).
     Khi sửa, slug bị khoá mặc định để tránh thay đổi không chủ ý.  */
  const handleNameChange = (v) => {
    setForm(f => ({
      ...f,
      categoryName: v,
      slug: slugLocked ? f.slug : toSlug(v),
    }));
  };

  /* ── Lưu danh mục ──
     handleSave: validate form rồi mở confirm modal (chưa gọi API).
     doSave: được gọi sau khi người dùng xác nhận — thực sự gọi API. */
  const handleSave = () => {
    if (!form.categoryName.trim()) { toast.warn('Vui lòng nhập tên danh mục'); return; }
    if (!form.slug.trim()) { toast.warn('Slug không được để trống'); return; }
    const payload = {
      ...form,
      sortOrder:          form.sortOrder !== '' ? parseInt(form.sortOrder) : 0,
      parent_category_id: form.parentCategoryId ?? null,
    };
    setSaveConfirm(payload);
  };
  const doSave = async (payload) => {
    setSaveConfirm(null);
    try {
      setSaving(true);
      if (editing) await adminCategoryAPI.update(editing, payload);
      else         await adminCategoryAPI.create(payload);
      setShowModal(false);
      fetchCats();
      refreshCategories();
      toast.success(editing ? 'Đã lưu thay đổi danh mục!' : 'Đã thêm danh mục!');
      if (editing && form.slug !== origSlugRef.current && origSlugRef.current) {
        toast.warn(`Slug đã đổi từ "${origSlugRef.current}" → "${form.slug}". Các link và banner dùng slug cũ có thể bị hỏng.`);
      }
      if (editing && !form.isActive) {
        const activeChildren = cats.filter(c =>
          String(c.parentCategoryId) === String(editing) && getActive(c)
        );
        if (activeChildren.length > 0) {
          toast.warn(`${activeChildren.length} danh mục con vẫn đang hiển thị nhưng sẽ không truy cập được từ menu cha đã ẩn.`);
        }
      }
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Xóa danh mục sau khi người dùng xác nhận ── */
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await adminCategoryAPI.delete(deleteId);
      setDeleteId(null);
      fetchCats();
      refreshCategories(); // cập nhật mega menu ngay lập tức
      toast.success('Đã xóa danh mục.');
    } catch (err) {
      toast.error('Lỗi xóa: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  /* Hiện spinner toàn trang khi đang tải lần đầu */
  if (loading) return (
    <div className="admin-page admin-center"><Loader size={32} className="spin"/></div>
  );

  const catIds = displayCats.map(c => c.categoryId ?? c.id);

  /* Tính trước phần tử icon preview để hiển thị trong nút toggle picker:
     - Tên icon (string tên Lucide) → render component SVG
     - URL ảnh (http//) → thẻ <img>
     - Chuỗi emoji → thẻ <span>
     - Rỗng → emoji mặc định                                             */
  const currentIconEl = (() => {
    const raw = form.imageUrl;
    if (!raw) return <span style={{ fontSize:'1.8rem' }}>{DEFAULT_EMOJI}</span>;
    if (isIconName(raw)) {
      const Comp = ICON_REGISTRY[raw];
      return <Comp size={28} color="var(--primary)"/>;
    }
    // URL ảnh thật → hiển thị <img>
    if (raw.startsWith('http') || raw.startsWith('/')) {
      return <img src={raw} alt="icon" style={{ width:34, height:34, objectFit:'contain', borderRadius:4 }}/>;
    }
    // Emoji fallback
    return <span style={{ fontSize:'1.8rem' }}>{raw}</span>;
  })();

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <div>
          <h1>Quản lý danh mục</h1>
          <p className="ap-subtitle">{cats.length} danh mục • Kéo ≡ để sắp xếp</p>
        </div>
        <button className="admin-btn-primary" onClick={openAdd}>
          <Plus size={17}/> Thêm danh mục
        </button>
      </div>

      {/* ── Bảng ── */}
      <div className="admin-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width:28 }}></th>
                <th style={{ width:56 }}>Icon</th>
                <th style={{ width:90 }}>Cấp</th>
                <th>Tên danh mục</th>
                <th>Slug</th>
                <th style={{ width:80, textAlign:'center' }}>Thứ tự</th>
                <th style={{ width:110 }}>Trạng thái</th>
                <th style={{ width:96 }}>Thao tác</th>
              </tr>
            </thead>
            <SortableContext items={catIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {cats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-light text-center" style={{ padding:'2.5rem' }}>
                      Chưa có danh mục nào
                    </td>
                  </tr>
                ) : displayCats.map(c => (
                  <SortableRow
                    key={c.categoryId ?? c.id}
                    cat={c}
                    onEdit={openEdit}
                    onDelete={setDeleteId}
                    onToggle={handleToggle}
                    toggling={toggling}
                    parentName={c.parentCategoryId
                      ? (cats.find(p => String(p.categoryId ?? p.id) === String(c.parentCategoryId))?.categoryName ?? 'Cha')
                      : null}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Modal thêm / sửa                                      */}
      {/* ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal admin-modal-sm" onClick={e => e.stopPropagation()}>

            <div className="admin-modal-header">
              <h2>
                {editing
                  ? <><Edit2 size={17}/> Sửa danh mục</>
                  : <><Plus size={17}/> Thêm danh mục</>}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>

            <div className="admin-modal-body">

              {/* Tên danh mục */}
              <div className="admin-form-row">
                <label>Tên danh mục *</label>
                <input
                  value={form.categoryName}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="VD: Bếp gas"
                  autoFocus
                />
              </div>

              {/* Slug với lock/unlock */}
              <div className="admin-form-row">
                <label>
                  Slug
                  {!slugLocked && form.slug && (
                    <span style={{ fontSize:'0.72rem', color:'var(--primary)', marginLeft:'0.4rem' }}>
                      tự động
                    </span>
                  )}
                </label>
                <div className="ap-slug-row">
                  <input
                    value={form.slug}
                    readOnly={slugLocked}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="bep-gas"
                    style={{ fontFamily:'monospace', background: slugLocked ? 'var(--bg-gray)' : undefined }}
                  />
                  <button
                    type="button"
                    className={`ap-slug-lock-btn ${!slugLocked ? 'unlocked' : ''}`}
                    onClick={() => setSlugLocked(v => !v)}
                    title={slugLocked ? 'Mở chỉnh sửa slug' : 'Khoá slug'}
                  >
                    {slugLocked ? <Lock size={14}/> : <Unlock size={14}/>}
                  </button>
                </div>
              </div>

              {/* Danh mục cha — combobox tìm kiếm */}
              <div className="admin-form-row">
                <label>Thuộc danh mục cha</label>
                <div className="cat-parent-combo" ref={parentRef}>
                  <div className="cat-parent-input-wrap">
                    <input
                      type="text"
                      className="cat-parent-input"
                      placeholder="Gõ tên để tìm, hoặc để trống = danh mục gốc"
                      value={parentSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setParentSearch(val);
                        setParentOpen(true);
                        // Xoá hết → reset về gốc ngay
                        if (!val.trim()) setForm(f => applyParent(f, null));
                      }}
                      onFocus={() => setParentOpen(true)}
                      onBlur={() => {
                        /* Blur khi click ra ngoài (không phải click option) →
                           sync text về tên cha đang chọn. Click option dùng
                           onMouseDown+preventDefault nên KHÔNG trigger blur. */
                        setParentSearch(currentParentName(form.parentCategoryId, cats));
                        setParentOpen(false);
                      }}
                      autoComplete="off"
                    />
                    {/* Badge hiển thị tên cha đã chọn + nút xoá */}
                    {form.parentCategoryId && (
                      <button
                        type="button"
                        className="cat-parent-clear"
                        title="Bỏ chọn — đặt làm danh mục gốc"
                        onMouseDown={e => {
                          e.preventDefault(); // Ngăn input blur chạy trước click
                          setForm(f => applyParent(f, null));
                          setParentSearch('');
                          setParentOpen(false);
                        }}
                      >
                        <X size={13}/>
                      </button>
                    )}
                    <ChevronDown
                      size={15}
                      className={`cat-parent-chevron ${parentOpen ? 'open' : ''}`}
                      onMouseDown={e => {
                        e.preventDefault();
                        setParentOpen(v => !v);
                      }}
                    />
                  </div>

                  {/* Trạng thái đang chọn */}
                  {form.parentCategoryId ? (
                    <span className="cat-parent-chosen">
                      Danh mục con của: <strong>
                        {cats.find(c => String(c.categoryId ?? c.id) === String(form.parentCategoryId))?.categoryName ?? '—'}
                      </strong>
                    </span>
                  ) : (
                    <span className="cat-parent-chosen muted">Danh mục gốc (không có cha)</span>
                  )}

                  {/* Dropdown danh sách */}
                  {parentOpen && (
                    <div className="cat-parent-dropdown">
                      {/* Option: Danh mục gốc */}
                      <button
                        type="button"
                        className={`cat-parent-option ${!form.parentCategoryId ? 'active' : ''}`}
                        onMouseDown={e => {
                          e.preventDefault(); // Ngăn input blur → onBlur không chạy
                          setForm(f => applyParent(f, null));
                          setParentSearch('');
                          setParentOpen(false);
                        }}
                      >
                        <span className="cat-parent-option-icon">🌐</span>
                        <span>— Danh mục gốc (không có cha) —</span>
                      </button>

                      {/* Tất cả danh mục (trừ chính nó), lọc theo text gõ */}
                      {(() => {
                        const filtered = cats.filter(c => {
                          const cid = c.categoryId ?? c.id;
                          // Loại bỏ chính danh mục đang sửa
                          if (editing && String(cid) === String(editing)) return false;
                          // Lọc theo text tìm kiếm
                          return (c.categoryName ?? '').toLowerCase().includes(parentSearch.toLowerCase());
                        });
                        return (
                          <>
                            {filtered.map(c => {
                              const cid  = c.categoryId ?? c.id;
                              const name = c.categoryName ?? c.name ?? '';
                              const isRoot = !c.parentCategoryId;
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  className={`cat-parent-option ${String(form.parentCategoryId) === String(cid) ? 'active' : ''}`}
                                  onMouseDown={e => {
                                    e.preventDefault(); // Ngăn input blur
                                    setForm(f => applyParent(f, Number(cid)));
                                    setParentSearch(name);
                                    setParentOpen(false);
                                  }}
                                >
                                  <span className="cat-parent-option-icon">{isRoot ? '📁' : '↳'}</span>
                                  <span style={{ paddingLeft: isRoot ? 0 : '0.5rem' }}>{name}</span>
                                  {String(form.parentCategoryId) === String(cid) && (
                                    <span className="cat-parent-check">✓</span>
                                  )}
                                </button>
                              );
                            })}
                            {filtered.length === 0 && parentSearch && (
                              <div className="cat-parent-empty">Không tìm thấy danh mục nào</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Chọn icon SVG ── */}
              <div className="admin-form-row">
                <label>Icon danh mục</label>
                <div className="cat-icon-field" ref={pickerRef}>

                  {/* ── Nút toggle ── */}
                  <button
                    ref={pickerBtnRef}
                    type="button"
                    className="cat-icon-preview-btn"
                    aria-expanded={showEmojiGrid}
                    onClick={() => showEmojiGrid ? setShowEmojiGrid(false) : openPicker()}
                    title="Nhấn để chọn icon"
                  >
                    <span className="cat-icon-display">{currentIconEl}</span>
                    <span className="cat-icon-hint">
                      {form.imageUrl
                        ? (CATEGORY_ICONS.find(i => i.name === form.imageUrl)?.label
                           ?? (form.imageUrl.startsWith('http') ? 'Ảnh tùy chỉnh' : form.imageUrl))
                        : 'Chọn icon danh mục…'}
                    </span>
                    <ChevronDown size={15} className={`cat-icon-arrow ${showEmojiGrid ? 'open' : ''}`}/>
                  </button>

                  {/* ── Bảng chọn (popover fixed) ── */}
                  {showEmojiGrid && (
                    <div ref={pickerRef} className="cat-icon-grid" style={pickerStyle}>

                      {/* 1. Ô tìm nhanh */}
                      <div className="cat-picker-search-wrap">
                        <Search size={14} className="cat-picker-search-icon"/>
                        <input
                          autoFocus
                          type="text"
                          className="cat-picker-search"
                          placeholder="Tìm nhanh icon…"
                          value={iconSearch}
                          onChange={e => setIconSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                        {iconSearch && (
                          <button className="cat-picker-search-clear" type="button"
                            onClick={() => setIconSearch('')}><X size={12}/></button>
                        )}
                      </div>

                      {/* 2. Lưới icon SVG */}
                      <div className="cat-icon-grid-inner">
                        {CATEGORY_ICONS
                          .filter(({ label }) =>
                            !iconSearch || label.toLowerCase().includes(iconSearch.toLowerCase()))
                          .map(({ name, label }) => {
                            const Comp = ICON_REGISTRY[name];
                            return (
                              <button
                                key={name}
                                type="button"
                                className={`cat-icon-option ${form.imageUrl === name ? 'active' : ''}`}
                                onClick={() => { setForm(f => ({ ...f, imageUrl: name })); setShowEmojiGrid(false); }}
                                title={label}
                              >
                                <Comp size={22}/>
                                <span className="cat-icon-option-label">{label}</span>
                              </button>
                            );
                          })}
                        {iconSearch && CATEGORY_ICONS.filter(({ label }) =>
                          label.toLowerCase().includes(iconSearch.toLowerCase())).length === 0 && (
                          <p className="cat-picker-no-result">Không tìm thấy</p>
                        )}
                      </div>

                      {/* 3. Khu vực ảnh ngoài (ImgBB) */}
                      <div className="cat-imgbb-section">
                        <div className="cat-imgbb-title">
                          <Link size={13}/> HOẶC DÙNG ICON NGOÀI
                        </div>

                        {/* Kéo thả / Tải lên */}
                        <div
                          className={`cat-imgbb-dropzone ${imgDragOver ? 'dragging' : ''} ${uploading ? 'loading' : ''}`}
                          onClick={() => !uploading && imgFileRef.current?.click()}
                          onDragOver={e => { e.preventDefault(); setImgDragOver(true); }}
                          onDragLeave={() => setImgDragOver(false)}
                          onDrop={e => {
                            e.preventDefault(); setImgDragOver(false);
                            handleIconUpload(e.dataTransfer.files[0]);
                          }}
                        >
                          {uploading
                            ? <><Loader size={16} className="spin"/><span>Đang upload…</span></>
                            : <><Upload size={16}/><span>Kéo thả hoặc <u>chọn file</u></span></>
                          }
                          <small>.PNG · .SVG · .WebP · .JPG</small>
                        </div>
                        <input ref={imgFileRef} type="file" accept="image/*" style={{display:'none'}}
                          onChange={e => { handleIconUpload(e.target.files[0]); e.target.value = ''; }}/>
                      </div>

                      {/* 4. Xóa icon */}
                      {form.imageUrl && (
                        <button type="button" className="cat-emoji-clear"
                          onClick={() => { setForm(f => ({ ...f, imageUrl: '' })); setShowEmojiGrid(false); }}>
                          ✕ Bỏ icon (dùng tự động theo tên danh mục)
                        </button>
                      )}
                    </div>
                  )}

                  {!form.imageUrl && (
                    <span style={{ fontSize:'0.75rem', color:'var(--text-light)' }}>
                      Nếu không chọn, icon sẽ tự động theo tên danh mục
                    </span>
                  )}
                </div>
              </div>

              {/* Thứ tự + Trạng thái */}
              <div className="admin-form-2col">
                <div className="admin-form-row">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number" min={0} step={1}
                    value={form.sortOrder}
                    onChange={e => setForm({ ...form, sortOrder: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </div>
                <div className="admin-form-row">
                  <label>Trạng thái</label>
                  <select
                    value={String(form.isActive)}
                    onChange={e => setForm({ ...form, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Hiển thị</option>
                    <option value="false">Ẩn</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setShowModal(false)}>Huỷ</button>
              <button
                className="admin-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader size={15} className="spin"/> : <Save size={15}/>}
                {' '}{editing ? 'Lưu thay đổi' : 'Thêm danh mục'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={editing ? 'Lưu thay đổi danh mục?' : 'Thêm danh mục mới?'}
        message={editing ? 'Thông tin danh mục sẽ được cập nhật.' : 'Danh mục mới sẽ được thêm vào hệ thống.'}
        confirmLabel={editing ? 'Lưu thay đổi' : 'Thêm mới'}
        onConfirm={() => doSave(saveConfirm)}
        onCancel={() => setSaveConfirm(null)}
        loading={saving}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Xóa danh mục"
        message="Các sản phẩm thuộc danh mục này sẽ mất liên kết danh mục.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa danh mục"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
};

export default AdminCategories;