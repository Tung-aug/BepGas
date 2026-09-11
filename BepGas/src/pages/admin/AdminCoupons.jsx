// Trang quản lý mã giảm giá cho Admin — tạo, sửa, bật/tắt và xóa coupon.
// Hỗ trợ hai kiểu giảm: PERCENTAGE (phần trăm, có thể đặt giảm tối đa) và FIXED (số tiền cố định).
// Coupon được validate qua API khi khách nhập mã ở trang giỏ hàng hoặc checkout.
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader, X, Save, Tag } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { couponAPI } from '../../services/api';
import { toast } from '../../utils/toast';
import { fmt } from '../../utils/formatters';
import Switch from '../../components/Switch';
const emptyForm = { code:'', type:'percent', value:'', minOrderValue:'', maxDiscount:'', usageLimit:'', startDate:'', endDate:'', isActive:true };

/* Chuyển đổi ngày từ backend (array hoặc string) → định dạng datetime-local input */
const toDatetimeLocal = (v) => {
  if (!v) return '';
  if (Array.isArray(v)) {
    const [Y, M, D, h=0, m=0] = v;
    return `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  return String(v).slice(0, 16); // cắt đến phút: "2026-05-24T10:00"
};

/* Hiển thị ngày + giờ trong bảng */
const fmtDateTime = (v) => {
  if (!v) return '';
  try {
    const d = Array.isArray(v) ? new Date(v[0],v[1]-1,v[2],v[3]??0,v[4]??0) : new Date(String(v));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
  } catch { return ''; }
};

const AdminCoupons = () => {
  const [coupons,      setCoupons]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [form,         setForm]         = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);
  const [formErrors,   setFormErrors]   = useState({});
  const [deleteId,     setDeleteId]     = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [saveConfirm,  setSaveConfirm]  = useState(null);
  const [toggling,     setToggling]     = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchCode,   setSearchCode]   = useState('');

  const fetchCoupons = () => couponAPI.getAll().then(r=>setCoupons(r?.data??r??[])).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ fetchCoupons(); },[]);

  const handleToggle = async (c) => {
    const cid    = c.couponId ?? c.id;
    const newVal = !c.isActive;
    setToggling(cid);
    setCoupons(prev => prev.map(x => (x.couponId ?? x.id) === cid ? { ...x, isActive: newVal } : x));
    try {
      await couponAPI.update(cid, { ...c, isActive: newVal });
    } catch {
      setCoupons(prev => prev.map(x => (x.couponId ?? x.id) === cid ? { ...x, isActive: !newVal } : x));
      toast.error('Không thể cập nhật trạng thái');
    } finally { setToggling(null); }
  };

  const openAdd  = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c.couponId??c.id);
    setForm({ code:c.code??'', type:c.type??'percent', value:c.value??'', minOrderValue:c.minOrderValue??'', maxDiscount:c.maxDiscount??'', usageLimit:c.usageLimit??'', startDate:toDatetimeLocal(c.startDate), endDate:toDatetimeLocal(c.endDate), isActive:c.isActive??true });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.code.trim() || !form.value) return;
    const numValue = parseFloat(form.value);
    if (form.type === 'percent' && (isNaN(numValue) || numValue <= 0 || numValue > 100)) {
      toast.warn('Giảm giá phần trăm phải từ 1% đến 100%'); return;
    }
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      toast.warn('Thời gian kết thúc phải sau thời gian bắt đầu'); return;
    }
    const payload = { ...form, value: numValue, minOrderValue: form.minOrderValue?parseFloat(form.minOrderValue):0, maxDiscount: form.maxDiscount?parseFloat(form.maxDiscount):null, usageLimit: form.usageLimit?parseInt(form.usageLimit):null, startDate: form.startDate||null, endDate: form.endDate||null };
    setSaveConfirm(payload);
  };
  const doSave = async (payload) => {
    setSaveConfirm(null);
    try {
      setSaving(true);
      if (editing) await couponAPI.update(editing, payload);
      else         await couponAPI.create(payload);
      setShowModal(false); fetchCoupons();
      toast.success(editing ? 'Đã lưu mã khuyến mãi!' : 'Đã thêm mã khuyến mãi!');
    } catch(err){ toast.error('Lỗi: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await couponAPI.delete(deleteId);
      setDeleteId(null);
      fetchCoupons();
      toast.success('Đã xóa mã khuyến mãi.');
    } catch(err){ toast.error(err.message); }
    finally { setDeleting(false); }
  };

  /* Tính trạng thái hiển thị của một coupon */
  const couponStatus = (c) => {
    const expired = c.endDate && new Date(toDatetimeLocal(c.endDate)) < new Date();
    const full    = c.usageLimit != null && (c.usedCount??0) >= c.usageLimit;
    if (expired)  return 'expired';
    if (full)     return 'full';
    if (c.isActive) return 'active';
    return 'inactive';
  };

  /* Lọc danh sách theo trạng thái + tìm mã code */
  const filteredCoupons = coupons.filter(c => {
    const st = couponStatus(c);
    const matchStatus = filterStatus === 'all' || st === filterStatus;
    const matchCode   = !searchCode || c.code.includes(searchCode.toUpperCase());
    return matchStatus && matchCode;
  });

  const deletingCoupon = deleteId ? coupons.find(c => (c.couponId??c.id) === deleteId) : null;
  const editingCoupon  = editing  ? coupons.find(c => (c.couponId??c.id) === editing)  : null;

  const STATUS_TABS = [
    { v:'all',      l:'Tất cả' },
    { v:'active',   l:'Đang dùng' },
    { v:'inactive', l:'Đã tắt' },
    { v:'expired',  l:'Hết hạn' },
    { v:'full',     l:'Hết lượt' },
  ];

  if (loading) return <div className="admin-page admin-center"><Loader size={32} className="spin"/></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div><h1>Quản lý khuyến mãi</h1><p className="ap-subtitle">{coupons.length} mã giảm giá</p></div>
        <button className="admin-btn-primary" onClick={openAdd}><Plus size={17}/> Thêm mã</button>
      </div>

      {/* Thanh tìm kiếm + lọc trạng thái */}
      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'center',marginBottom:'0.75rem'}}>
        <input
          value={searchCode}
          onChange={e=>setSearchCode(e.target.value)}
          placeholder="Tìm mã code..."
          style={{padding:'0.42rem 0.75rem',border:'1px solid var(--border)',borderRadius:6,fontSize:'0.875rem',minWidth:160,background:'var(--bg-card)',color:'inherit'}}
        />
        {STATUS_TABS.map(({v,l})=>(
          <button key={v} onClick={()=>setFilterStatus(v)}
            style={{padding:'0.38rem 0.75rem',borderRadius:6,border:'1px solid var(--border)',background:filterStatus===v?'var(--primary)':'var(--bg-card)',color:filterStatus===v?'#fff':'inherit',cursor:'pointer',fontSize:'0.83rem',fontWeight:filterStatus===v?600:400}}>
            {l}
          </button>
        ))}
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Mã code</th><th>Loại</th><th>Giá trị</th><th>Đơn tối thiểu</th><th>Lượt sử dụng</th><th>Hết hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filteredCoupons.length === 0
              ? <tr><td colSpan={8} className="text-light text-center">{coupons.length === 0 ? 'Chưa có mã khuyến mãi' : 'Không có mã khớp bộ lọc'}</td></tr>
              : filteredCoupons.map(c => {
                  const cid = c.couponId??c.id;
                  const expired = c.endDate && new Date(toDatetimeLocal(c.endDate)) < new Date();
                  return (
                    <tr key={cid}>
                      <td>
                        <span style={{fontFamily:'monospace',fontWeight:700,letterSpacing:1,background:'var(--bg-gray)',padding:'0.2rem 0.6rem',borderRadius:4}}>{c.code}</span>
                      </td>
                      <td><span className="admin-cat-tag">{c.type==='percent'?'Phần trăm':'Cố định'}</span></td>
                      <td className="text-primary"><strong>{c.type==='percent'?`${c.value}%`:fmt(c.value)}</strong></td>
                      <td className="text-light">{c.minOrderValue?fmt(c.minOrderValue):'—'}</td>
                      <td>
                        <div>Đã dùng: <strong>{c.usedCount??0}</strong></div>
                        {c.usageLimit != null ? (
                          <div className="text-light" style={{fontSize:'0.78rem',marginTop:2}}>
                            Còn lại: <strong style={{color:(c.usageLimit-(c.usedCount??0))<=0?'#ef4444':'#10b981'}}>
                              {Math.max(0, c.usageLimit-(c.usedCount??0))}
                            </strong> / {c.usageLimit}
                          </div>
                        ) : (
                          <div className="text-light" style={{fontSize:'0.78rem',marginTop:2}}>Không giới hạn</div>
                        )}
                      </td>
                      <td className="text-light" style={{whiteSpace:'nowrap'}}>{c.endDate?fmtDateTime(c.endDate):'Không giới hạn'}</td>
                      <td>
                        {expired
                          ? <span className="admin-badge badge-red">Hết hạn</span>
                          : <Switch
                              checked={!!c.isActive}
                              onChange={() => handleToggle(c)}
                              labelOn="Đang dùng" labelOff="Tắt"
                              loading={toggling === cid}
                            />}
                      </td>
                      <td><div className="admin-actions">
                        <button className="admin-action-btn edit" onClick={()=>openEdit(c)}><Edit2 size={14}/></button>
                        <button className="admin-action-btn delete" onClick={()=>setDeleteId(cid)}><Trash2 size={14}/></button>
                      </div></td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="admin-modal" onClick={e=>e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing?<><Edit2 size={17}/> Sửa mã</>:<><Tag size={17}/> Thêm mã khuyến mãi</>}</h2>
              <button onClick={()=>setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-2col">
                <div className="admin-form-row">
                  <label>Mã code *{editing && <span style={{color:'var(--text-light)',fontWeight:400,fontSize:'0.78rem'}}> (không thể đổi)</span>}</label>
                  <input value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}
                    placeholder="VD: SALE50" disabled={!!editing}
                    style={{fontFamily:'monospace',fontWeight:700,opacity:editing?0.6:1,cursor:editing?'not-allowed':undefined}}/>
                </div>
                <div className="admin-form-row"><label>Loại giảm</label>
                  <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                    <option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định (đ)</option>
                  </select>
                </div>
              </div>
              <div className="admin-form-2col">
                <div className="admin-form-row">
                  <label>Giá trị * {form.type==='percent'&&<span style={{color:'var(--text-light)',fontWeight:400,fontSize:'0.8rem'}}>(1 – 100%)</span>}</label>
                  <input type="number" min={1} max={form.type==='percent'?100:undefined} value={form.value} onChange={e=>setForm({...form,value:e.target.value})} placeholder={form.type==='percent'?'VD: 20 (%)':'VD: 50000 (đ)'}/>
                </div>
                <div className="admin-form-row"><label>Đơn tối thiểu (đ)</label><input type="number" min={0} value={form.minOrderValue} onChange={e=>setForm({...form,minOrderValue:e.target.value})} placeholder="0 = không giới hạn"/></div>
              </div>
              <div className="admin-form-2col">
                <div className="admin-form-row"><label>Giảm tối đa (đ)</label><input type="number" min={0} value={form.maxDiscount} onChange={e=>setForm({...form,maxDiscount:e.target.value})} placeholder="Để trống = không giới hạn"/></div>
                <div className="admin-form-row">
                  <label>
                    Số lần dùng
                    {editingCoupon && (
                      <span style={{color:'var(--text-light)',fontWeight:400,fontSize:'0.78rem'}}>
                        {' '}(đã dùng: <strong>{editingCoupon.usedCount??0}</strong> lần)
                      </span>
                    )}
                  </label>
                  <input type="number" min={0} value={form.usageLimit} onChange={e=>setForm({...form,usageLimit:e.target.value})} placeholder="Để trống = không giới hạn"/>
                </div>
              </div>
              <div className="admin-form-2col">
                <div className="admin-form-row">
                  <label>Bắt đầu <span style={{fontWeight:400,color:'var(--text-light)',fontSize:'0.78rem'}}>ngày &amp; giờ</span></label>
                  <input type="datetime-local" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/>
                </div>
                <div className="admin-form-row">
                  <label>Kết thúc <span style={{fontWeight:400,color:'var(--text-light)',fontSize:'0.78rem'}}>ngày &amp; giờ</span></label>
                  <input type="datetime-local" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/>
                </div>
              </div>
              <div className="admin-form-row"><label>Trạng thái</label>
                <select value={String(form.isActive)} onChange={e=>setForm({...form,isActive:e.target.value==='true'})}>
                  <option value="true">Kích hoạt</option><option value="false">Tắt</option>
                </select>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={()=>setShowModal(false)}>Huỷ</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>{saving?<Loader size={15} className="spin"/>:<Save size={15}/>} {editing?'Lưu':'Thêm'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={editing ? 'Lưu thay đổi mã giảm giá?' : 'Thêm mã giảm giá mới?'}
        message={editing ? 'Thông tin mã khuyến mãi sẽ được cập nhật.' : 'Mã khuyến mãi mới sẽ được thêm vào hệ thống.'}
        confirmLabel={editing ? 'Lưu thay đổi' : 'Thêm mới'}
        onConfirm={() => doSave(saveConfirm)}
        onCancel={() => setSaveConfirm(null)}
        loading={saving}
      />

      <ConfirmModal
        open={!!deleteId}
        title={deletingCoupon?.usedCount > 0 ? 'Mã đang được sử dụng' : 'Xóa mã khuyến mãi'}
        danger={!(deletingCoupon?.usedCount > 0)}
        message={deletingCoupon?.usedCount > 0
          ? `Mã <strong>${deletingCoupon.code}</strong> đã được dùng <strong>${deletingCoupon.usedCount} lần</strong>. Xóa có thể gây lỗi tham chiếu đơn hàng cũ.<br/>Nên <strong>tắt mã</strong> để giữ lại lịch sử đơn hàng.`
          : 'Mã khuyến mãi sẽ bị xóa vĩnh viễn khỏi hệ thống.<br/>Hành động này <strong>không thể hoàn tác</strong>.'}
        confirmLabel={deletingCoupon?.usedCount > 0 ? 'Tắt mã thay vì xóa' : 'Xóa mã'}
        onConfirm={deletingCoupon?.usedCount > 0
          ? () => { handleToggle(deletingCoupon); setDeleteId(null); }
          : handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
};
export default AdminCoupons;