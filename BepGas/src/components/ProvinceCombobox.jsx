import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { provinces } from '../constants/provinces';

// Combobox tỉnh/thành phố có thể tìm kiếm, hỗ trợ điều hướng bàn phím (ArrowUp/Down, Enter, Escape).
// query là văn bản đang gõ trong ô tìm kiếm, còn value là tỉnh đã được chọn và xác nhận.
// Props:
//   value       — tỉnh/thành phố đang được chọn (chuỗi tên)
//   onChange    — callback khi người dùng chọn tỉnh mới
//   className   — class thêm vào wrapper, ví dụ 'input-error' khi validate thất bại
//   placeholder — ghi đè placeholder mặc định nếu cần
const ProvinceCombobox = ({
  value = '',
  onChange,
  className = '',
  placeholder = 'Gõ để tìm tỉnh / thành phố...',
}) => {
  const [query,  setQuery]  = useState('');   // văn bản đang gõ khi dropdown mở
  const [open,   setOpen]   = useState(false);
  const [cursor, setCursor] = useState(-1);   // index item đang được highlight bằng bàn phím, -1 là không có

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // Khi dropdown mở, query dùng để lọc danh sách; khi đóng, hiển thị value đã chọn.

  // Lọc tỉnh theo query, không phân biệt chữ hoa/thường. Hiện tất cả nếu query rỗng.
  const filtered = query.trim()
    ? provinces.filter(p =>
        p.toLowerCase().includes(query.toLowerCase().trim())
      )
    : provinces;

  // Đóng dropdown khi click ra ngoài và hủy query chưa xác nhận.
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cuộn item đang được highlight vào vùng hiển thị khi điều hướng bằng bàn phím.
  useEffect(() => {
    if (!listRef.current || cursor < 0) return;
    const item = listRef.current.querySelectorAll('.pcb-item')[cursor];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const openDropdown = () => {
    // Pre-fill query với value hiện tại để người dùng chỉnh sửa thay vì gõ lại từ đầu.
    setQuery(value || '');
    setOpen(true);
    setCursor(-1);
    // setTimeout 0 để input render ra DOM trước khi gọi select().
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const selectProvince = (p) => {
    onChange(p);
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
          selectProvince(filtered[cursor]);
        } else if (filtered.length === 1) {
          selectProvince(filtered[0]);
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
      {/* ── Input row — chỉ mở khi đang đóng; đang mở thì để input nhận click bình thường ── */}
      <div className="pcb-input-row" onClick={() => { if (!open) openDropdown(); }}>
        {open ? (
          <input
            ref={inputRef}
            className="pcb-input"
            type="text"
            value={query}
            placeholder={placeholder}
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

      {/* ── Dropdown list ── */}
      {open && (
        <ul ref={listRef} className="pcb-list" role="listbox">
          {filtered.length > 0 ? (
            filtered.map((p, i) => (
              <li
                key={p}
                role="option"
                aria-selected={p === value}
                className={`pcb-item${p === value ? ' pcb-item-selected' : ''}${i === cursor ? ' pcb-item-cursor' : ''}`}
                // e.preventDefault() ngăn blur event trên input xảy ra trước khi click được xử lý.
              onMouseDown={e => { e.preventDefault(); selectProvince(p); }}
                onMouseEnter={() => setCursor(i)}
              >
                {p}
                {p === value && <span className="pcb-tick">✓</span>}
              </li>
            ))
          ) : (
            <li className="pcb-empty">Không tìm thấy tỉnh / thành phố</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ProvinceCombobox;