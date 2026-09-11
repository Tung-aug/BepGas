import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { getWards } from '../constants/wards';

// Combobox phường/xã/thị trấn có tìm kiếm — lọc danh sách theo tỉnh đang được chọn.
// Khác với ProvinceCombobox, combobox này cho phép nhập tự do nếu phường/xã chưa có trong dữ liệu.
// Khi tỉnh thay đổi, tự động reset giá trị để tránh phường của tỉnh cũ còn lại.
// Props:
//   value       — phường/xã đang được chọn (chuỗi tên)
//   onChange    — callback khi chọn phường mới hoặc nhập tự do
//   province    — tỉnh/thành đang chọn, dùng để tra danh sách phường tương ứng
//   options     — truyền trực tiếp danh sách tùy chọn thay vì dùng province (dùng trong Checkout)
//   className   — class bổ sung, ví dụ 'input-error'
//   placeholder — ghi đè placeholder mặc định
const WardCombobox = ({
  value = '',
  onChange,
  province = '',
  options: optionsProp = null, // nếu truyền vào thì dùng trực tiếp, bỏ qua province
  className = '',
  placeholder = 'Gõ để tìm phường / xã / thị trấn...',
}) => {
  const [query,  setQuery]  = useState('');
  const [open,   setOpen]   = useState(false);
  const [cursor, setCursor] = useState(-1);

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  const wards    = optionsProp ?? getWards(province);
  const hasWards = wards.length > 0;

  // Reset giá trị khi tỉnh thay đổi — bỏ qua khi dùng optionsProp
  const prevProvince = useRef(province);
  useEffect(() => {
    if (optionsProp !== null) return;
    if (prevProvince.current !== province) {
      prevProvince.current = province;
      onChange('');
      setQuery('');
      setOpen(false);
    }
  }, [province, onChange, optionsProp]);

  // Lọc danh sách theo query
  const filtered = query.trim()
    ? wards.filter(w => w.toLowerCase().includes(query.toLowerCase().trim()))
    : wards;

  // Đóng khi click ra ngoài — giữ text đã gõ nếu hợp lệ (nhập tự do)
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        if (open) {
          const trimmed = query.trim();
          if (trimmed && trimmed !== value) onChange(trimmed);
        }
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, query, value, onChange]);

  // Cuộn item được highlight vào view
  useEffect(() => {
    if (!listRef.current || cursor < 0) return;
    const item = listRef.current.querySelectorAll('.pcb-item')[cursor];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const openDropdown = () => {
    setQuery(value || '');
    setOpen(true);
    setCursor(-1);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const selectWard = (w) => {
    onChange(w);
    setQuery('');
    setOpen(false);
    setCursor(-1);
  };

  const clearValue = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCursor(c => Math.min(c + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCursor(c => Math.max(c - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (cursor >= 0 && filtered[cursor]) {
          selectWard(filtered[cursor]);
        } else if (filtered.length === 1) {
          selectWard(filtered[0]);
        } else if (query.trim()) {
          // Cho phép nhập tự do khi không có kết quả khớp
          selectWard(query.trim());
        }
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
      default:
        break;
    }
  };

  const showFreeEntry =
    query.trim() &&
    filtered.length > 0 &&
    !filtered.some(w => w.toLowerCase() === query.toLowerCase().trim());

  const emptyMsg = query.trim()
    ? `Không tìm thấy — nhấn Enter để dùng "${query.trim()}"`
    : optionsProp !== null
    ? 'Không có dữ liệu — gõ để nhập tự do'
    : province
    ? 'Không có dữ liệu — gõ tên phường/xã để nhập tự do'
    : 'Vui lòng chọn tỉnh / thành phố trước';

  // Bấm mũi tên: đóng nếu đang mở, mở nếu đang đóng — tách riêng khỏi onClick của cả dòng
  // để không bị reset query khi người dùng đang gõ tìm kiếm bên trong ô input.
  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); setQuery(''); }
    else openDropdown();
  };

  return (
    <div
      ref={wrapRef}
      className={`pcb-wrap${open ? ' pcb-open' : ''}${className ? ' ' + className : ''}`}
    >
      {/* Input row — chỉ mở khi đang đóng; đang mở thì để input nhận click bình thường */}
      <div className="pcb-input-row" onClick={() => { if (!open) openDropdown(); }}>
        {open ? (
          <input
            ref={inputRef}
            className="pcb-input"
            type="text"
            value={query}
            placeholder={hasWards ? placeholder : 'Nhập tên phường / xã / thị trấn...'}
            onChange={e => { setQuery(e.target.value); setCursor(-1); }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <span className={`pcb-value${!value ? ' pcb-placeholder' : ''}`}>
            {value || placeholder}
          </span>
        )}
        <div className="pcb-icons">
          {value && !open && (
            <button type="button" className="pcb-clear" onClick={clearValue} tabIndex={-1} aria-label="Xóa">
              <X size={14} />
            </button>
          )}
          <button type="button" className="pcb-chevron-btn" onClick={toggleDropdown} tabIndex={-1}
            aria-label={open ? 'Đóng danh sách' : 'Mở danh sách'}>
            <ChevronDown size={16} className={`pcb-chevron${open ? ' pcb-chevron-up' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <ul ref={listRef} className="pcb-list" role="listbox">
          {filtered.length > 0 ? (
            filtered.map((w, i) => (
              <li
                key={i}
                role="option"
                aria-selected={w === value}
                className={`pcb-item${w === value ? ' pcb-item-selected' : ''}${i === cursor ? ' pcb-item-cursor' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectWard(w); }}
                onMouseEnter={() => setCursor(i)}
              >
                {w}
                {w === value && <span className="pcb-tick">✓</span>}
              </li>
            ))
          ) : (
            <li className="pcb-empty">{emptyMsg}</li>
          )}
          {/* Tùy chọn nhập tự do khi text không khớp chính xác */}
          {showFreeEntry && (
            <li
              className="pcb-item pcb-free-entry"
              onMouseDown={e => { e.preventDefault(); selectWard(query.trim()); }}
            >
              Dùng: "<strong>{query.trim()}</strong>"
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default WardCombobox;
