// Trang báo cáo doanh số cho Admin — xem top sản phẩm bán chạy và doanh thu theo khoảng thời gian.
// Có thể chọn preset (hôm nay, 7 ngày, tháng này) hoặc tùy chỉnh ngày bắt đầu/kết thúc.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Package, Search, X, Loader, RefreshCw, AlertTriangle, ExternalLink, ChevronLeft } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { fmt } from '../../utils/formatters';

const today     = () => new Date().toISOString().slice(0, 10);
const nDaysAgo  = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const monthStart= () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };

const PRESETS = [
  { key:'all',    label:'Tất cả',    from:()=>'',          to:()=>''        },
  { key:'today',  label:'Hôm nay',   from:()=>today(),     to:()=>today()   },
  { key:'7days',  label:'7 ngày',    from:()=>nDaysAgo(6), to:()=>today()   },
  { key:'month',  label:'Tháng này', from:()=>monthStart(),to:()=>today()   },
];

const STATUS_LABEL = {
  active:       { text:'Đang bán',  cls:'badge-green' },
  out_of_stock: { text:'Hết hàng',  cls:'badge-red'   },
  inactive:     { text:'Ngừng bán', cls:'badge-gray'  },
  deleted:      { text:'Đã xóa',   cls:'badge-gray'  },
};

export default function AdminSales() {
  const [preset,     setPreset]     = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [search,     setSearch]     = useState('');
  const [statusF,    setStatusF]    = useState('all');
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const getRange = useCallback(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    const p = PRESETS.find(x => x.key === preset);
    return { from: p.from(), to: p.to() };
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async (from, to) => {
    setLoading(true); setError('');
    try {
      const res = await adminAPI.getTopProducts(200, from, to);
      setProducts(res?.data ?? res ?? []);
    } catch (e) {
      setError(e.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { from, to } = getRange();
    fetchData(from, to);
  }, [getRange, fetchData]);

  const applyPreset = (key) => {
    setPreset(key);
    if (key !== 'custom') {
      const p = PRESETS.find(x => x.key === key);
      fetchData(p.from(), p.to());
    }
  };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.productName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusF === 'all' || p.status === statusF;
    return matchSearch && matchStatus;
  });

  const totalQty      = filtered.reduce((s, p) => s + (p.totalQty ?? 0), 0);
  const totalRevenue  = filtered.reduce((s, p) => s + Number(p.totalRevenue ?? 0), 0);

  const periodLabel = preset === 'custom'
    ? `${customFrom || '...'} → ${customTo || '...'}`
    : PRESETS.find(x => x.key === preset)?.label ?? preset;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <Link to="/admin" className="admin-btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:4, marginBottom:'0.5rem', fontSize:'0.85rem' }}>
            <ChevronLeft size={15}/> Dashboard
          </Link>
          <h1>Doanh số sản phẩm</h1>
          <p className="ap-subtitle">Tổng hợp từ đơn đã giao · {periodLabel}</p>
        </div>
        <button className="admin-btn-ghost" onClick={() => { const {from,to}=getRange(); fetchData(from,to); }}>
          <RefreshCw size={15}/> Làm mới
        </button>
      </div>

      {/* Bộ lọc thời gian */}
      <div className="admin-card" style={{ marginBottom:'1rem', padding:'0.85rem 1rem' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', alignItems:'center' }}>
          {PRESETS.map(p => (
            <button key={p.key}
              className={`dash-tf-btn${preset === p.key ? ' active' : ''}`}
              onClick={() => applyPreset(p.key)}>
              {p.label}
            </button>
          ))}
          <button className={`dash-tf-btn${preset === 'custom' ? ' active' : ''}`}
            onClick={() => setPreset('custom')}>
            Tùy chọn
          </button>
          {preset === 'custom' && (
            <>
              <input type="date" className="admin-select" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ width:'auto', height:'34px', padding:'0 0.6rem' }}/>
              <span style={{ color:'var(--text-light)' }}>→</span>
              <input type="date" className="admin-select" value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ width:'auto', height:'34px', padding:'0 0.6rem' }}/>
              <button className="admin-btn-primary" style={{ height:'34px', padding:'0 0.85rem', fontSize:'0.85rem' }}
                onClick={() => fetchData(customFrom, customTo)}>
                Áp dụng
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar tìm + lọc */}
      <div className="admin-toolbar">
        <div className="admin-search" style={{ flex:1, maxWidth:360 }}>
          <Search size={16}/>
          <input placeholder="Tìm tên sản phẩm..." value={search}
            onChange={e => setSearch(e.target.value)}/>
          {search && <button className="search-clear-btn" onClick={() => setSearch('')}><X size={13}/></button>}
        </div>
        <select className="admin-select" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang bán</option>
          <option value="out_of_stock">Hết hàng</option>
          <option value="inactive">Ngừng bán</option>
        </select>
        <span className="admin-count">{filtered.length} sản phẩm</span>
      </div>

      {/* Tổng nhanh */}
      {!loading && filtered.length > 0 && (
        <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
          <div className="admin-card" style={{ padding:'0.75rem 1.25rem', flex:'1 1 160px', minWidth:0 }}>
            <p style={{ margin:0, fontSize:'0.78rem', color:'var(--text-light)' }}>Tổng sản phẩm bán</p>
            <p style={{ margin:0, fontSize:'1.4rem', fontWeight:700, color:'var(--secondary)' }}>
              {totalQty.toLocaleString()}
            </p>
          </div>
          {/* Card "Doanh thu (đơn đã giao)" — đang tạm ẩn theo yêu cầu.
          <div className="admin-card" style={{ padding:'0.75rem 1.25rem', flex:'1 1 160px', minWidth:0 }}>
            <p style={{ margin:0, fontSize:'0.78rem', color:'var(--text-light)' }}>Doanh thu (đơn đã giao)</p>
            <p style={{ margin:0, fontSize:'1.4rem', fontWeight:700, color:'var(--primary)' }}>
              {fmt(totalRevenue)}
            </p>
          </div>
          */}
        </div>
      )}

      {/* Bảng */}
      <div className="admin-card">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'2.5rem' }}>
            <Loader size={28} className="spin"/>
          </div>
        ) : error ? (
          <p style={{ padding:'2rem', color:'#ef4444', textAlign:'center' }}>{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-light text-center">
            {products.length === 0
              ? 'Chưa có sản phẩm bán trong khoảng này.'
              : 'Không có sản phẩm khớp với bộ lọc.'}
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width:40 }}>#</th>
                <th>Sản phẩm</th>
                <th style={{ width:130, whiteSpace:'nowrap' }}>Trạng thái</th>
                <th style={{ width:110, textAlign:'right', whiteSpace:'nowrap' }}>Đã bán</th>
                {/* Cột "Doanh thu" — đang tạm ẩn theo yêu cầu. Giữ whiteSpace:'nowrap' sẵn để
                    khi bật lại không bị xuống dòng như "Trạng thái" từng bị.
                <th style={{ width:140, textAlign:'right', whiteSpace:'nowrap' }}>Doanh thu</th>
                */}
                {/* Cột nút "Xem sản phẩm" (mở trong cửa sổ mới) — đang tạm ẩn theo yêu cầu.
                <th style={{ width:70 }}></th>
                */}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.deleted;
                const needRestock = p.status === 'out_of_stock' && (p.totalQty ?? 0) >= 3;
                return (
                  <tr key={p.productId ?? i}
                    style={needRestock ? { background:'#fff9f9' } : undefined}>
                    <td style={{ color:'var(--text-light)', fontWeight:600 }}>{i + 1}</td>
                    <td>
                      <div className="admin-user-cell">
                        {p.productImage
                          ? <img src={p.productImage} alt={p.productName}
                              style={{ width:36, height:36, objectFit:'cover', borderRadius:4, border:'1px solid var(--border)', flexShrink:0 }}/>
                          : <div style={{ width:36, height:36, background:'var(--bg-gray)', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Package size={16} color="#9ca3af"/>
                            </div>}
                        <div style={{ minWidth:0 }}>
                          <span style={{ display:'block', fontWeight:600, fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {p.productName}
                          </span>
                          {needRestock && (
                            <span style={{ fontSize:'0.72rem', color:'#ef4444', display:'flex', alignItems:'center', gap:3 }}>
                              <AlertTriangle size={11}/> Hết hàng — cân nhắc nhập thêm
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge ${st.cls}`}>{st.text}</span>
                    </td>
                    <td style={{ textAlign:'right', fontWeight:700, fontSize:'0.95rem' }}>
                      {(p.totalQty ?? 0).toLocaleString()}
                    </td>
                    {/* Cột "Doanh thu" và nút "Xem sản phẩm" — đang tạm ẩn theo yêu cầu.
                    <td style={{ textAlign:'right', color:'var(--primary)', fontWeight:600 }}>
                      {fmt(p.totalRevenue ?? 0)}
                    </td>
                    <td>
                      <Link to="/admin/products" className="admin-action-btn edit" title="Xem sản phẩm">
                        <ExternalLink size={14}/>
                      </Link>
                    </td>
                    */}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
