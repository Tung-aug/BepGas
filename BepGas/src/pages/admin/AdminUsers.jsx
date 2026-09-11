// Trang quản lý tài khoản người dùng cho Admin.
// ADMIN có thể tạo, sửa, khóa/mở khóa và xóa tài khoản — STAFF chỉ được xem.
// Mỗi user có tab địa chỉ riêng để admin hỗ trợ khách khi cần sửa địa chỉ giao hàng.
import { useState, useEffect } from 'react';
import {
  Search, Loader, Plus, Edit2, Trash2, Lock, Unlock, X, Save,
  ShieldCheck, UserCog, User, MapPin, Home, MoreVertical, Star,
  CheckCircle, Eye, EyeOff,
} from 'lucide-react';
import { adminAPI, addressAPI } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorState from '../../components/ErrorState';
import { toast } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';
import { provinces } from '../../constants/provinces';

const roleConfig = {
  customer: { label: 'Khách hàng', color: '#0ea5e9', bg: '#e0f2fe', icon: User       },
  staff:    { label: 'Nhân viên',  color: '#8b5cf6', bg: '#ede9fe', icon: UserCog    },
  admin:    { label: 'Admin',      color: '#ef4444', bg: '#fef2f2', icon: ShieldCheck },
};

const TABS = [
  { id: 'all',      label: 'Tất cả'     },
  { id: 'customer', label: 'Khách hàng' },
  { id: 'staff',    label: 'Nhân viên'  },
  { id: 'admin',    label: 'Admin'      },
];

const emptyUserForm = { fullName: '', email: '', password: '', phone: '', role: 'customer' };
const emptyAddrForm = { fullName: '', phone: '', street: '', ward: '', district: '', province: '', isDefault: false };

/* Hiển thị địa chỉ đầy đủ — backend dùng street/province, hỗ trợ cả addressLine/city cũ */
const formatFullAddr = (a) => {
  const street   = a.street ?? a.addressLine ?? '';
  const ward     = a.ward     ?? '';
  const district = a.district ?? '';
  const province = a.province ?? a.city ?? '';
  return [street, ward, district, province].filter(Boolean).join(', ');
};

/* ── Sub-component: Form thêm/sửa địa chỉ ───────────────── */
const AddrForm = ({ initial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(initial ?? emptyAddrForm);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const phoneClean = form.phone.replace(/[\s.\-]/g, '');
    if (!form.fullName.trim() || !phoneClean || !form.street.trim()) {
      toast.warn('Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ cụ thể');
      return;
    }
    if (!/^0[3-9]\d{8}$/.test(phoneClean)) {
      toast.warn('Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số)');
      return;
    }
    onSave(form);
  };

  return (
    <form className="au-addr-form" onSubmit={handleSubmit}>
      <div className="au-addr-form-grid">
        <div className="admin-form-row">
          <label>Họ và tên người nhận *</label>
          <input value={form.fullName} onChange={e=>set({fullName:e.target.value})} placeholder="Nguyễn Văn A"/>
        </div>
        <div className="admin-form-row">
          <label>Số điện thoại *</label>
          <input value={form.phone} onChange={e=>set({phone:e.target.value})} placeholder="0912 345 678" maxLength={11}/>
        </div>
      </div>

      <div className="admin-form-row">
        <label>Địa chỉ cụ thể * <span style={{fontWeight:400,color:'var(--text-light)',fontSize:'0.78rem'}}>số nhà, tên đường</span></label>
        <input value={form.street} onChange={e=>set({street:e.target.value})} placeholder="Số 12, Đường Nguyễn Trãi"/>
      </div>

      <div className="au-addr-form-grid">
        <div className="admin-form-row">
          <label>Phường / Xã</label>
          <input value={form.ward} onChange={e=>set({ward:e.target.value})} placeholder="Phường Bến Nghé"/>
        </div>
        <div className="admin-form-row">
          <label>Quận / Huyện</label>
          <input value={form.district} onChange={e=>set({district:e.target.value})} placeholder="Quận 1"/>
        </div>
      </div>

      <div className="admin-form-row">
        <label>Tỉnh / Thành phố *</label>
        <select value={form.province} onChange={e=>set({province:e.target.value})}>
          <option value="">— Chọn tỉnh/thành phố —</option>
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <label className="au-addr-default-check">
        <input type="checkbox" checked={form.isDefault} onChange={e=>set({isDefault:e.target.checked})}/>
        Đặt làm địa chỉ mặc định
      </label>

      <div className="au-addr-form-footer">
        <button type="button" className="admin-btn-ghost" onClick={onCancel}>Huỷ</button>
        <button type="submit" className="admin-btn-primary" disabled={saving}>
          {saving ? <Loader size={14} className="spin"/> : <Save size={14}/>}
          {initial ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
        </button>
      </div>
    </form>
  );
};

/* ══════════════════════════════════════════════════════════ */
const AdminUsers = () => {
  const { isAdmin } = useAuth();
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  // Staff chỉ xem được khách hàng — khởi tạo và khoá tab ở 'customer'
  const [tab,        setTab]        = useState(isAdmin ? 'all' : 'customer');
  const changeTab = (id) => { if (isAdmin) setTab(id); };

  // modal thêm / sửa user
  const [showModal,   setShowModal]  = useState(false);
  const [editing,     setEditing]    = useState(null);
  const [form,        setForm]       = useState(emptyUserForm);
  const [formErrors,  setFormErrors] = useState({});
  const [showPwd,     setShowPwd]    = useState(false);
  const [saving,      setSaving]     = useState(false);

  // xác nhận xóa / khoá user
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleting,      setDeleting]      = useState(false);
  const [saveConfirm,   setSaveConfirm]   = useState(null);
  const [lockConfirmId, setLockConfirmId] = useState(null);
  const [toggling,      setToggling]      = useState(null);
  const [openMenu,   setOpenMenu]   = useState(null);
  const [menuPos,    setMenuPos]    = useState({ top: 0, right: 0 });

  // ── Modal quản lý địa chỉ ──────────────────────────────
  const [addrModal,      setAddrModal]      = useState(null);  // { userId, userName }
  const [addresses,      setAddresses]      = useState([]);
  const [addrLoading,    setAddrLoading]    = useState(false);
  const [addrFormMode,   setAddrFormMode]   = useState(null);  // null | 'add' | { id, data }
  const [addrSaving,     setAddrSaving]     = useState(false);
  const [deleteAddrId,   setDeleteAddrId]   = useState(null);  // id đang xác nhận xóa
  const [deletingAddr,   setDeletingAddr]   = useState(false);
  const [settingDefault, setSettingDefault] = useState(null);  // id đang set default

  /* ── Fetch users ──────────────────────────────────────── */
  const fetchUsers = () => {
    adminAPI.getUsers(0, 200)
      .then(res => setUsers(res?.data?.content ?? res?.content ?? res?.data ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchUsers(); }, []);

  // Đóng dropdown 3 chấm khi click ra ngoài
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  /* ── Lọc ─────────────────────────────────────────────── */
  const byRole   = (role) => users.filter(u => (u.role?.toLowerCase() ?? 'customer') === role);
  const tabList  = tab === 'all' ? users : byRole(tab);
  const filtered = tabList.filter(u =>
    (u.fullName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email    ?? '').toLowerCase().includes(search.toLowerCase())
  );

  /* ── User CRUD ────────────────────────────────────────── */
  const openAdd = () => {
    setEditing(null); setForm(emptyUserForm); setFormErrors({}); setShowPwd(false); setShowModal(true);
  };
  const openEdit = (u) => {
    setEditing(u.userId ?? u.id);
    setForm({ fullName: u.fullName??'', email: u.email??'', password: '', phone: u.phone??'', role: u.role?.toLowerCase()??'customer' });
    setFormErrors({}); setShowPwd(false); setShowModal(true);
  };

  const validateForm = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Vui lòng nhập họ và tên.';
    if (!form.email.trim()) e.email = 'Vui lòng nhập email.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email không hợp lệ.';
    if (!editing) {
      if (!form.password.trim()) e.password = 'Vui lòng nhập mật khẩu.';
      else if (form.password.length < 6) e.password = 'Mật khẩu phải từ 6 ký tự.';
    }
    if (form.phone && !/^0[3-9]\d{8}$/.test(form.phone.replace(/[\s.\-]/g, '')))
      e.phone = 'Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số).';
    return e;
  };

  const handleSave = () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSaveConfirm(editing
      ? { fullName: form.fullName, phone: form.phone, role: form.role }
      : { ...form }
    );
  };
  const doSave = async (payload) => {
    setSaveConfirm(null);
    try {
      setSaving(true);
      if (editing) {
        const res = await adminAPI.updateUser(editing, payload);
        const updated = res?.data ?? res;
        setUsers(prev => prev.map(u => (u.userId??u.id)===editing ? {...u,...updated} : u));
      } else {
        const res = await adminAPI.createUser(payload);
        setUsers(prev => [res?.data??res, ...prev]);
      }
      setShowModal(false);
      toast.success(editing ? 'Đã cập nhật tài khoản!' : 'Đã tạo tài khoản!');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await adminAPI.deleteUser(deleteId);
      setUsers(prev => prev.filter(u => (u.userId??u.id) !== deleteId));
      setDeleteId(null);
      toast.success('Đã xóa tài khoản.');
    } catch (err) { toast.error('Lỗi xóa: ' + err.message); }
    finally { setDeleting(false); }
  };

  const handleToggleLock = async (id) => {
    try {
      setToggling(id);
      const res = await adminAPI.toggleLock(id);
      const updated = res?.data ?? res;
      // Cập nhật cả enabled lẫn isActive để `locked` không bị stale
      const nowActive = updated.enabled ?? updated.isActive ?? true;
      setUsers(prev => prev.map(u =>
        (u.userId??u.id)===id ? { ...u, enabled: nowActive, isActive: nowActive } : u
      ));
      toast.success(nowActive ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setToggling(null); }
  };

  /* ── Địa chỉ: mở modal ───────────────────────────────── */
  const openAddrModal = async (userId, userName) => {
    setAddrModal({ userId, userName });
    setAddrFormMode(null);
    setDeleteAddrId(null);
    setAddrLoading(true);
    setAddresses([]);
    try {
      const res = await addressAPI.adminGetByUser(userId);
      setAddresses(res?.data ?? res ?? []);
    } catch { setAddresses([]); }
    finally { setAddrLoading(false); }
  };

  const closeAddrModal = () => {
    setAddrModal(null);
    setAddresses([]);
    setAddrFormMode(null);
    setDeleteAddrId(null);
  };

  /* ── Địa chỉ: thêm mới ───────────────────────────────── */
  const handleAddrCreate = async (formData) => {
    if (!addrModal) return;
    setAddrSaving(true);
    try {
      const res = await addressAPI.adminCreate(addrModal.userId, formData);
      const created = res?.data ?? res;
      setAddresses(prev => [...prev, created]);
      setAddrFormMode(null);
      toast.success('Đã thêm địa chỉ!');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setAddrSaving(false); }
  };

  /* ── Địa chỉ: cập nhật ───────────────────────────────── */
  const handleAddrUpdate = async (formData) => {
    if (!addrModal || !addrFormMode?.id) return;
    setAddrSaving(true);
    try {
      const res = await addressAPI.adminUpdate(addrModal.userId, addrFormMode.id, formData);
      const updated = res?.data ?? res;
      setAddresses(prev => prev.map(a => (a.id??a.addressId)===addrFormMode.id ? {...a,...updated} : a));
      setAddrFormMode(null);
      toast.success('Đã cập nhật địa chỉ!');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setAddrSaving(false); }
  };

  /* ── Địa chỉ: xóa ────────────────────────────────────── */
  const handleAddrDelete = async () => {
    if (!addrModal || !deleteAddrId) return;
    setDeletingAddr(true);
    try {
      await addressAPI.adminDelete(addrModal.userId, deleteAddrId);
      setAddresses(prev => prev.filter(a => (a.id??a.addressId) !== deleteAddrId));
      setDeleteAddrId(null);
      toast.success('Đã xóa địa chỉ.');
    } catch (err) { toast.error('Lỗi xóa: ' + err.message); }
    finally { setDeletingAddr(false); }
  };

  /* ── Địa chỉ: đặt mặc định ───────────────────────────── */
  const handleAddrSetDefault = async (addrId) => {
    if (!addrModal) return;
    setSettingDefault(addrId);
    try {
      await addressAPI.adminSetDefault(addrModal.userId, addrId);
      setAddresses(prev => prev.map(a => ({...a, isDefault: (a.id??a.addressId) === addrId})));
      toast.success('Đã đặt làm địa chỉ mặc định.');
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    finally { setSettingDefault(null); }
  };

  /* ── Loading / Error ─────────────────────────────────── */
  if (loading) return <div className="admin-page admin-center"><Loader size={32} className="spin"/><p>Đang tải...</p></div>;
  if (error)   return <div className="admin-page admin-center"><ErrorState message={error} onRetry={fetchUsers} /></div>;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="admin-page">

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1>Quản lý tài khoản</h1>
          <p className="ap-subtitle">
            {isAdmin ? `${users.length} tài khoản trong hệ thống` : `${users.length} khách hàng`}
          </p>
        </div>
        {isAdmin && (
          <button className="admin-btn-primary" onClick={openAdd}>
            <Plus size={17}/> Thêm tài khoản
          </button>
        )}
      </div>

      {/* Thẻ thống kê vai trò — staff chỉ thấy khách hàng */}
      <div className="au-role-stats">
        {(isAdmin ? Object.entries(roleConfig) : [['customer', roleConfig.customer]]).map(([key, cfg]) => {
          const count = byRole(key).length;
          const Icon  = cfg.icon;
          return (
            <div key={key} className={`au-role-card ${tab===key?'active':''}`}
              style={{'--rc':cfg.color,'--rb':cfg.bg, cursor: isAdmin ? 'pointer' : 'default'}}
              onClick={() => isAdmin && changeTab(tab===key?'all':key)}>
              <div className="au-role-icon"><Icon size={20}/></div>
              <div className="au-role-info"><strong>{count}</strong><span>{cfg.label}</span></div>
            </div>
          );
        })}
      </div>

      {/* Tabs — ẩn với staff vì họ chỉ xem customer */}
      {isAdmin && (
        <div className="ap-tabs" style={{marginBottom:'1.25rem'}}>
          {TABS.map(t => (
            <button key={t.id} className={`ap-tab ${tab===t.id?'active':''}`} onClick={()=>changeTab(t.id)}>
              {t.label}
              <span className="ap-tab-badge" style={{opacity:tab===t.id?1:0.6}}>
                {t.id==='all' ? users.length : byRole(t.id).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17}/>
          <input placeholder="Tìm tên, email..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <span className="admin-count">{filtered.length} kết quả</span>
      </div>

      {/* Bảng */}
      <div className="admin-card">
        {tab !== 'all' && (
          <div className="au-table-header" style={{'--rc':roleConfig[tab]?.color,'--rb':roleConfig[tab]?.bg}}>
            {roleConfig[tab]?.label} ({filtered.length})
          </div>
        )}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Số điện thoại</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tham gia</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-light text-center">Không có tài khoản</td></tr>
            ) : filtered.map(u => {
              const id     = u.userId ?? u.id;
              const name   = u.fullName ?? 'Không rõ';
              const role   = roleConfig[u.role?.toLowerCase()] ?? roleConfig.customer;
              const Icon   = role.icon;
              const locked = u.isActive === false || u.enabled === false;
              return (
                <tr key={id}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="au-avatar" style={{background:role.bg,color:role.color}}>
                        {name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div><strong>{name}</strong></div>
                        <div className="text-light">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-light">{u.phone ?? '—'}</td>
                  <td>
                    <span className="admin-badge" style={{color:role.color,background:role.bg}}>
                      <Icon size={11} style={{marginRight:3}}/>{role.label}
                    </span>
                  </td>
                  <td>
                    {/* Staff chỉ thấy toggle cho customer, admin thấy tất cả */}
                    {(isAdmin || u.role?.toLowerCase() === 'customer') ? (
                      <button
                        className={`au-status-toggle ${!locked?'active':''}`}
                        onClick={()=>setLockConfirmId(id)}
                        disabled={toggling===id}
                        title={locked?'Click để kích hoạt':'Click để khoá'}
                        aria-label={locked?'Kích hoạt tài khoản':'Khoá tài khoản'}
                      >
                        <span className="au-toggle-track"><span className="au-toggle-thumb"/></span>
                        <span className="au-status-label">
                          {toggling===id ? <Loader size={11} className="spin"/> : locked?'Bị khoá':'Hoạt động'}
                        </span>
                      </button>
                    ) : (
                      <span className="au-status-label" style={{color:'var(--text-light)',fontSize:'0.78rem'}}>
                        {locked ? 'Bị khoá' : 'Hoạt động'}
                      </span>
                    )}
                  </td>
                  <td className="text-light">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td>
                    <div className="admin-actions">
                      {isAdmin && (
                        <button className="admin-action-btn edit" title="Sửa" onClick={()=>openEdit(u)}>
                          <Edit2 size={14}/>
                        </button>
                      )}
                      {/* Menu 3 chấm — dùng position:fixed để thoát overflow:hidden của card */}
                      <div>
                        <button
                          className="admin-action-btn"
                          title="Thêm thao tác"
                          style={{background:'var(--bg-gray)',color:'var(--secondary)'}}
                          onClick={e => {
                            e.stopPropagation();
                            if (openMenu === id) { setOpenMenu(null); return; }
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                            setOpenMenu(id);
                          }}
                        >
                          <MoreVertical size={14}/>
                        </button>
                        {openMenu===id && (
                          <div
                            className="au-action-dropdown"
                            style={{ position:'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                            onClick={e=>e.stopPropagation()}
                          >
                            {/* Staff chỉ quản lý địa chỉ của customer */}
                            {(isAdmin || u.role?.toLowerCase() === 'customer') && (
                              <button className="au-dd-item" onClick={()=>{openAddrModal(id,name);setOpenMenu(null);}}>
                                <MapPin size={13}/> Quản lý địa chỉ
                              </button>
                            )}
                            {(isAdmin || u.role?.toLowerCase()==='customer') && (
                              <button
                                className={`au-dd-item ${locked?'success':'warn'}`}
                                onClick={()=>{setLockConfirmId(id);setOpenMenu(null);}}
                                disabled={toggling===id}
                              >
                                {toggling===id ? <Loader size={13} className="spin"/> : locked?<Unlock size={13}/>:<Lock size={13}/>}
                                {locked?'Mở khoá':'Khoá tài khoản'}
                              </button>
                            )}
                            {isAdmin && (
                              <button className="au-dd-item danger" onClick={()=>{setDeleteId(id);setOpenMenu(null);}}>
                                <Trash2 size={13}/> Xoá tài khoản
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ Modal thêm / sửa user ══ */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal au-user-modal-v2" onClick={e => e.stopPropagation()}>

            <div className="admin-modal-header">
              <h2>{editing ? <><Edit2 size={17}/> Sửa tài khoản</> : <><Plus size={17}/> Thêm tài khoản</>}</h2>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>

            <div className="admin-modal-body au-v2-body">

              {/* ── Nhóm 1: Thông tin đăng nhập ── */}
              <div className="au-v2-section">
                <div className="au-v2-section-label">Thông tin đăng nhập</div>

                <div className="au-v2-field">
                  <label>Họ và tên <span className="au-v2-req">*</span></label>
                  <input
                    className={`au-v2-input${formErrors.fullName ? ' is-error' : ''}`}
                    value={form.fullName}
                    onChange={e => { setForm({...form, fullName: e.target.value}); setFormErrors(p => ({...p, fullName: ''})); }}
                    placeholder="Nguyễn Văn A"
                  />
                  {formErrors.fullName && <span className="admin-field-err">{formErrors.fullName}</span>}
                </div>

                <div className="au-v2-field">
                  <label>Email <span className="au-v2-req">*</span></label>
                  <input
                    className={`au-v2-input${formErrors.email ? ' is-error' : ''}`}
                    type="email"
                    value={form.email}
                    onChange={e => { setForm({...form, email: e.target.value}); setFormErrors(p => ({...p, email: ''})); }}
                    placeholder="email@example.com"
                    disabled={!!editing}
                    style={editing ? {background:'var(--bg-gray)', cursor:'not-allowed', opacity:0.7} : {}}
                  />
                  {formErrors.email && <span className="admin-field-err">{formErrors.email}</span>}
                </div>

                {!editing && (
                  <div className="au-v2-field">
                    <label>Mật khẩu <span className="au-v2-req">*</span></label>
                    <div className="au-v2-input-wrap">
                      <input
                        className={`au-v2-input${formErrors.password ? ' is-error' : ''}`}
                        type={showPwd ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => { setForm({...form, password: e.target.value}); setFormErrors(p => ({...p, password: ''})); }}
                        placeholder="Tối thiểu 6 ký tự"
                      />
                      <button type="button" className="au-v2-pwd-btn" tabIndex={-1}
                        onClick={() => setShowPwd(v => !v)}>
                        {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                    {formErrors.password && <span className="admin-field-err">{formErrors.password}</span>}
                  </div>
                )}
              </div>

              {/* ── Nhóm 2: Thông tin tài khoản ── */}
              <div className="au-v2-section" style={{marginBottom: 0}}>
                <div className="au-v2-section-label">Thông tin tài khoản</div>

                <div className="au-v2-field">
                  <label>Số điện thoại</label>
                  <input
                    className={`au-v2-input${formErrors.phone ? ' is-error' : ''}`}
                    value={form.phone}
                    onChange={e => { setForm({...form, phone: e.target.value}); setFormErrors(p => ({...p, phone: ''})); }}
                    placeholder="0912 345 678"
                    maxLength={11}
                  />
                  {formErrors.phone && <span className="admin-field-err">{formErrors.phone}</span>}
                </div>

                <div className="au-v2-field">
                  <label>Vai trò</label>
                  <div className="au-v2-role-picker">
                    {Object.entries(roleConfig).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button key={key} type="button"
                          className={`au-v2-role-btn${form.role === key ? ' active' : ''}`}
                          style={{'--rc': cfg.color, '--rb': cfg.bg}}
                          onClick={() => setForm({...form, role: key})}>
                          <Icon size={15}/>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`au-v2-role-hint au-v2-role-hint--${form.role}`}>
                  {form.role === 'admin' && <ShieldCheck size={14} style={{flexShrink: 0}}/>}
                  <span>
                    {form.role === 'admin'
                      ? 'Có toàn quyền quản trị hệ thống. Chỉ cấp cho người thực sự phụ trách.'
                      : form.role === 'staff'
                        ? 'Có thể xử lý đơn hàng, đánh giá và thông tin khách hàng theo phân quyền.'
                        : 'Chỉ có quyền mua hàng, quản lý đơn và địa chỉ cá nhân.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn-ghost" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader size={15} className="spin"/> Đang lưu...</>
                  : <><Save size={15}/> {editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal quản lý địa chỉ ══ */}
      {addrModal && (
        <div className="admin-modal-overlay" onClick={closeAddrModal}>
          <div className="admin-modal au-addr-modal" onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div className="admin-modal-header">
              <h2><MapPin size={17}/> Địa chỉ — <span style={{color:'var(--primary)'}}>{addrModal.userName}</span></h2>
              <button onClick={closeAddrModal}><X size={20}/></button>
            </div>

            <div className="admin-modal-body">

              {/* Loading */}
              {addrLoading ? (
                <div className="admin-center" style={{padding:'2.5rem'}}>
                  <Loader size={28} className="spin"/>
                </div>
              ) : (
                <>
                  {/* Danh sách địa chỉ */}
                  {addresses.length === 0 && !addrFormMode ? (
                    <div className="admin-center" style={{padding:'2rem',flexDirection:'column',gap:'0.6rem',color:'var(--text-light)'}}>
                      <MapPin size={36} color="#d1d5db"/>
                      <p style={{fontSize:'0.9rem'}}>Tài khoản chưa có địa chỉ nào</p>
                    </div>
                  ) : (
                    <div className="au-addr-list">
                      {addresses.map((a, idx) => {
                        const aid      = a.id ?? a.addressId;
                        const fullAddr = formatFullAddr(a);
                        const isDef    = a.isDefault ?? a['default'] ?? false;
                        const isEditing = addrFormMode?.id === aid;
                        const isDeleting = deleteAddrId === aid;

                        return (
                          <div key={aid} className={`au-addr-card ${isDef?'au-addr-card--default':''}`}>

                            {/* ── Inline edit form ── */}
                            {isEditing ? (
                              <div className="au-addr-card-inner">
                                <div className="au-addr-card-title">
                                  <Edit2 size={13} color="var(--primary)"/>
                                  <span style={{fontWeight:600,fontSize:'0.84rem',color:'var(--primary)'}}>Sửa địa chỉ {idx+1}</span>
                                </div>
                                <AddrForm
                                  initial={addrFormMode.data}
                                  onSave={handleAddrUpdate}
                                  onCancel={()=>setAddrFormMode(null)}
                                  saving={addrSaving}
                                />
                              </div>
                            ) : isDeleting ? (
                              /* ── Xác nhận xóa inline ── */
                              <div className="au-addr-card-inner au-addr-delete-confirm">
                                <p>Xóa địa chỉ này của <strong>{a.fullName}</strong>?<br/>
                                <span style={{fontSize:'0.8rem',color:'var(--text-light)'}}>{fullAddr}</span></p>
                                <div style={{display:'flex',gap:'0.5rem',marginTop:'0.65rem'}}>
                                  <button className="admin-btn-ghost" style={{flex:1}} onClick={()=>setDeleteAddrId(null)}>Huỷ</button>
                                  <button className="admin-btn-danger" style={{flex:1}} onClick={handleAddrDelete} disabled={deletingAddr}>
                                    {deletingAddr?<Loader size={13} className="spin"/>:<Trash2 size={13}/>} Xóa
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Hiển thị bình thường ── */
                              <div className="au-addr-card-inner">
                                {/* Icon + thứ tự + badge */}
                                <div className="au-addr-card-top">
                                  <div className="au-addr-card-left">
                                    {isDef
                                      ? <Home size={18} color="var(--primary)"/>
                                      : <MapPin size={18} color="#9ca3af"/>}
                                    <span className="au-addr-order">Địa chỉ {idx+1}</span>
                                    {isDef && <span className="au-addr-default-badge"><Star size={10} fill="currentColor"/> Mặc định</span>}
                                  </div>
                                  {/* Actions */}
                                  <div className="au-addr-actions">
                                    {!isDef && (
                                      <button
                                        className="au-addr-action-btn"
                                        title="Đặt làm mặc định"
                                        onClick={()=>handleAddrSetDefault(aid)}
                                        disabled={settingDefault===aid}
                                      >
                                        {settingDefault===aid
                                          ? <Loader size={12} className="spin"/>
                                          : <CheckCircle size={13}/>}
                                        Mặc định
                                      </button>
                                    )}
                                    <button
                                      className="au-addr-action-btn au-addr-action-edit"
                                      title="Sửa địa chỉ"
                                      onClick={()=>setAddrFormMode({id: aid, data: {
                                        fullName: a.fullName ?? '',
                                        phone:    a.phone    ?? '',
                                        street:   a.street   ?? a.addressLine ?? '',
                                        ward:     a.ward     ?? '',
                                        district: a.district ?? '',
                                        province: a.province ?? a.city ?? '',
                                        isDefault: isDef,
                                      }})}
                                    >
                                      <Edit2 size={13}/> Sửa
                                    </button>
                                    <button
                                      className="au-addr-action-btn au-addr-action-del"
                                      title="Xóa địa chỉ"
                                      onClick={()=>setDeleteAddrId(aid)}
                                    >
                                      <Trash2 size={13}/> Xóa
                                    </button>
                                  </div>
                                </div>

                                {/* Nội dung */}
                                <div className="au-addr-card-body">
                                  <div className="au-addr-name">
                                    <strong>{a.fullName}</strong>
                                    <span className="au-addr-phone">{a.phone}</span>
                                  </div>
                                  <div className="au-addr-text">{fullAddr || <em style={{color:'var(--text-light)'}}>Chưa có địa chỉ chi tiết</em>}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Form thêm mới — hiện bên dưới danh sách */}
                  {addrFormMode === 'add' && (
                    <div className="au-addr-card au-addr-card--add">
                      <div className="au-addr-card-inner">
                        <div className="au-addr-card-title">
                          <Plus size={13} color="var(--primary)"/>
                          <span style={{fontWeight:600,fontSize:'0.84rem',color:'var(--primary)'}}>Thêm địa chỉ mới</span>
                        </div>
                        <AddrForm
                          initial={null}
                          onSave={handleAddrCreate}
                          onCancel={()=>setAddrFormMode(null)}
                          saving={addrSaving}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="admin-modal-footer">
              {addrFormMode !== 'add' && (
                <button
                  className="admin-btn-primary"
                  onClick={()=>{setAddrFormMode('add');setDeleteAddrId(null);}}
                  style={{marginRight:'auto'}}
                >
                  <Plus size={15}/> Thêm địa chỉ
                </button>
              )}
              <button className="admin-btn-ghost" onClick={closeAddrModal}>Đóng lại</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saveConfirm}
        danger={false}
        icon={Save}
        title={editing ? 'Lưu thay đổi tài khoản?' : 'Tạo tài khoản mới?'}
        message={editing ? 'Thông tin tài khoản sẽ được cập nhật.' : 'Tài khoản mới sẽ được tạo trong hệ thống.'}
        confirmLabel={editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
        onConfirm={() => doSave(saveConfirm)}
        onCancel={() => setSaveConfirm(null)}
        loading={saving}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Xóa tài khoản"
        message="Tài khoản sẽ bị xóa vĩnh viễn cùng toàn bộ dữ liệu liên quan.<br/>Hành động này <strong>không thể hoàn tác</strong>."
        confirmLabel="Xóa tài khoản"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />

      {/* Xác nhận khoá / mở khoá tài khoản */}
      <ConfirmModal
        open={!!lockConfirmId}
        title={(() => { const u = users.find(u => (u.userId??u.id) === lockConfirmId); const locked = !(u?.enabled ?? u?.isActive ?? true); return locked ? 'Kích hoạt tài khoản' : 'Khoá tài khoản'; })()}
        message={(() => { const u = users.find(u => (u.userId??u.id) === lockConfirmId); const locked = !(u?.enabled ?? u?.isActive ?? true); return locked ? 'Tài khoản sẽ được kích hoạt trở lại và có thể đăng nhập bình thường.' : 'Tài khoản sẽ bị khoá, người dùng không thể đăng nhập cho đến khi được mở khoá.'; })()}
        confirmLabel={(() => { const u = users.find(u => (u.userId??u.id) === lockConfirmId); const locked = !(u?.enabled ?? u?.isActive ?? true); return locked ? 'Kích hoạt' : 'Khoá tài khoản'; })()}
        danger={(() => { const u = users.find(u => (u.userId??u.id) === lockConfirmId); return !(u?.enabled ?? u?.isActive ?? true) ? false : true; })()}
        onConfirm={() => { handleToggleLock(lockConfirmId); setLockConfirmId(null); }}
        onCancel={() => setLockConfirmId(null)}
        loading={toggling === lockConfirmId}
      />
    </div>
  );
};

export default AdminUsers;
