// Component toggle switch dùng chung cho các chỗ cần bật/tắt trạng thái trong admin.
// Dùng cùng CSS class au-status-toggle với trang AdminReviews để đồng nhất giao diện.
// Parent tự gọi API và cập nhật state khi onChange được trigger, component này chỉ hiển thị.
// Props:
//   checked  — trạng thái hiện tại (bật hay tắt)
//   onChange — hàm callback khi người dùng click toggle
//   labelOn  — nhãn hiển thị khi đang bật (mặc định 'Kích hoạt')
//   labelOff — nhãn hiển thị khi đang tắt (mặc định 'Tắt')
//   loading  — true khi đang gọi API, hiện dấu '…' và disable nút

const Switch = ({ checked, onChange, labelOn = 'Kích hoạt', labelOff = 'Tắt', loading = false }) => (
  <button
    type="button"
    className={`au-status-toggle ${checked ? 'active' : ''}`}
    onClick={onChange}
    disabled={loading}
    title={checked ? 'Click để tắt' : 'Click để bật'}
  >
    <span className="au-toggle-track">
      <span className="au-toggle-thumb" />
    </span>
    <span className="au-status-label">
      {loading ? '…' : checked ? labelOn : labelOff}
    </span>
  </button>
);

export default Switch;
