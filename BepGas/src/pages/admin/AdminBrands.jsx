// Trang quản lý thương hiệu cho Admin — tạo, sửa, xóa thương hiệu.
// Slug tự sinh từ tên thương hiệu và dùng làm tham số filter URL /products?brand=<slug>.
import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Loader, X, Save, Upload, Image } from 'lucide-react';
import { brandAPI } from '../../services/api';
import { toast } from '../../utils/toast';
import { toSlug } from '../../utils/formatters';
import ConfirmModal from '../../components/ConfirmModal';
import Switch from '../../components/Switch';

const emptyForm = { name: '', slug: '', logoUrl: '', description: '', isActive: true };

const AdminBrands = () => {
  const [brands,     setBrands]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(null); // payload to send on confirm
  const [toggling,   setToggling]   = useState(null); // brandId đang toggle
  const [slugEdited, setSlugEdited] = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const fileRef = useRef(null);

  const fetchBrands = () =>
    brandAPI.getAll(0, 100)
      .then(r => setBrands(r?.data?.content ?? r?.content ?? r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { fetchBrands(); }, []);

  const handleToggle = async (b) => {
    const bid    = b.brandId ?? b.id;
    const newVal = !b.isActive;
    setToggling(bid);
    setBrands(prev => prev.map(x => (x.brandId ?? x.id) === bid ? { ...x, isActive: newVal } : x));
    try {
      await brandAPI.update(bid, { ...b, isActive: newVal });
    } catch {
      setBrands(prev => prev.map(x => (x.brandId ?? x.id) === bid ? { ...x, isActive: !newVal } : x));
      toast.error('Không thể cập nhật trạng thái');
    } finally { setToggling(null); }
  };

  const openAdd  = () => { setEditing(null); setForm(emptyForm); setSlugEdited(false); setShowModal(true); };
  const openEdit = (b) => {
    setEditing(b.brandId ?? b.id); setSlugEdited(true);
    setForm({ name: b.name??b.brandName??'', slug: b.slug??'', logoUrl: b.logoUrl??'', description: b.description??'', isActive: b.isActive??true });
    setShowModal(true);
  };

  const handleUpload = async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const res = await brandAPI.uploadLogo(file);
      const url = res?.data ?? res;
      if (typeof url === 'string') setForm(f => ({ ...f, logoUrl: url }));
    } catch (err) { toast.error('Lỗi upload: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.warn('Vui lòng nhập tên thương hiệu'); return; }
    const payload = {
      brandName:   form.name.trim(),
      slug:        form.slug.trim(),
      logoUrl:     form.logoUrl.trim(),
      description: form.description.trim(),
      isActive:    form.isActive,
    };
    setSaveConfirm(payload);
  };
  const doSave = async (payload) => {
    setSaveConfirm(null);
    try {
      setSaving(true);
      if (editing) await brandAPI.update(editing, payload);
      else         await brandAPI.create(payload);
      setShowModal(false); fetchBrands();
      toast.success(editing ? 'Đã lưu thay đổi thương hiệu!' : 'Đã thêm thương hiệu!');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await brandAPI.delete(deleteId);
      setDeleteId(null);
      fetchBrands();
      toast.success('Đã xóa thương hiệu.');
    } catch (err) { toast.error('Lỗi xóa: ' + err.message); }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="admin-page admin-center"><Loader size={32} className="spin"/></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div><h1>Quản lý thương hiệu</h1><p className="ap-subtitle">{brands.length} thương hiệu</p></div>
        <button className="admin-btn-primary" onClick={openAdd}><Plus size={17}/> Thêm thương hiệu</button>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Thương hiệu</th><th>Slug</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {brands.length === 0
              ? <tr><td colSpan={4} className="text-light text-center">Chưa có thương hiệu</td></tr>
              : brands.map(b => {
                  const bid = b.brandId ?? b.id;
                  return (
                    <tr key={bid}>
                      <td>
                        <div className="admin-user-cell">
                          {b.logoUrl
                            ? <img src={b.logoUrl} alt={b.name} style={{width:40,height:40,objectFit:'contain',border:'1px solid var(--border)',borderRadius:4,background:'#fff'}}/>
                            : <div style={{width:40,height:40,background:'var(--bg-gray)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center'}}><Image size={18} color="#9ca3af"/></div>}
                          <strong>{b.name ?? b.brandName}</strong>
                        </div>
                      </td>
                      <td className="text-light" style={{fontFamily:'monospace'}}>{b.slug}</td>
                      <td>
                        <Switch
                          checked={!!b.isActive}
                          onChange={() => handleToggle(b)}
                          labelOn="Hiển thị" labelOff="Ẩn"
                          loading={toggling === bid}
                        />
                      </td>
                      <td><div className="admin-actions">
                        <button className="admin-action-btn edit" onClick={() => openEdit(b)}><Edit2 size={14}/></button>
                        <button className="admin-action-btn delete" onClick={() => setDeleteId(bid)}><Trash2 size={14}/></button>
                      </div></td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {/* Modal thêm / sửa */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal admin-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? <><Edit2 size={17}/> Sửa thương hiệu</> : <><Plus size={17}/> Thêm thương hiệu</>}</h2>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="admin-modal-body">

              {/* Tên */}
              <div className="admin-form-row">
                <label>Tên thương hiệu *</label>
                <input
                  value={form.name}
                  onChange={e => { const v = e.target.value; setForm(f => ({ ...f, name: v, slug: slugEdited ? f.slug : toSlug(v) })); }}
                  placeholder="VD: Bosch"
                />
              </div>

              {/* Slug */}
              <div className="admin-form-row">
                <label>Slug {!slugEdited && <span style={{fontSize:'0.72rem',color:'var(--primary)'}}>tự động</span>}</label>
                <input
                  value={form.slug}
                  onChange={e => { setSlugEdited(true); setForm(f => ({ ...f, slug: e.target.value })); }}
                  onFocus={() => setSlugEdited(true)}
                  placeholder="bosch"
                  style={{fontFamily:'monospace'}}
                />
              </div>

              {/* Logo — chỉ upload file, không dán URL thủ công */}
              <div className="admin-form-row">
                <label>Logo thương hiệu</label>

                {form.logoUrl ? (
                  /* Preview khi đã có logo — nhấn đúp để đổi logo */
                  <div>
                    <div className="ap-logo-preview" title="Nhấn đúp để đổi logo"
                      onDoubleClick={() => fileRef.current?.click()} style={{ cursor:'pointer' }}>
                      <img src={form.logoUrl} alt="logo" onError={e => e.target.style.opacity='0.3'}/>
                    </div>
                    <div className="ap-logo-actions">
                      <button type="button" className="ap-logo-change-btn"
                        onClick={() => fileRef.current?.click()}>
                        <Upload size={13}/> Đổi logo
                      </button>
                      <button type="button" className="ap-logo-remove-btn"
                        onClick={() => setForm(f => ({ ...f, logoUrl: '' }))}>
                        <X size={13}/> Xóa
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Dropzone kéo thả */
                  <div
                    className={`ap-dropzone ${dragOver ? 'dragging' : ''}`}
                    style={{padding:'0.85rem'}}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
                  >
                    {uploading
                      ? <><Loader size={20} className="spin"/><p style={{margin:0}}>Đang upload...</p></>
                      : <><Upload size={20}/><p style={{margin:0}}>Kéo thả logo vào đây</p><span>hoặc nhấn để chọn file · PNG, JPG, SVG, WebP</span></>
                    }
                  </div>
                )}

                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => { handleUpload(e.target.files[0]); e.target.value = ''; }}/>
              </div>

              {/* Trạng thái */}
              <div className="admin-form-row">
                <label>Trạng thái</label>
                <select value={String(form.isActive)} onChange={e => setForm({ ...form, isActive: e.target.value === 'true' })}>
                  <option value="true">Hiển thị</option>
                  <option value="false">Ẩn</option>
                </select>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving || uploading}>
                {saving ? <Loader size={15} className="spin"/> : <Save size={15}/>} {editing ? 'Lưu' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={editing ? 'Lưu thay đổi thương hiệu?' : 'Thêm thương hiệu mới?'}
        message={editing ? 'Thông tin thương hiệu sẽ được cập nhật.' : 'Thương hiệu mới sẽ được thêm vào hệ thống.'}
        confirmLabel={editing ? 'Lưu thay đổi' : 'Thêm mới'}
        onConfirm={() => doSave(saveConfirm)}
        onCancel={() => setSaveConfirm(null)}
        loading={saving}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Xóa thương hiệu"
        message="Thương hiệu sẽ bị xóa vĩnh viễn khỏi hệ thống.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa thương hiệu"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
};
export default AdminBrands;