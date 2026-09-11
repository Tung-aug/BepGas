// Dialog xác nhận đăng xuất — dạng overlay toàn màn hình, click ra ngoài sẽ đóng lại.
// Component này không giữ state, mọi logic mở/đóng do component cha quản lý qua prop open.

import { LogOut } from 'lucide-react';

// Props:
//   open      — true thì hiện dialog, false thì return null để tháo khỏi DOM hoàn toàn
//   onCancel  — gọi khi click overlay phía sau hoặc nút Hủy
//   onConfirm — gọi khi click nút Đăng xuất, thường dispatch logout action rồi redirect
const LogoutDialog = ({ open, onCancel, onConfirm }) => {
  // Không render gì khi chưa cần hiện, giúp tránh chiếm DOM khi ẩn.
  if (!open) return null;
  return (
    // Click vào overlay mờ phía sau sẽ gọi onCancel để đóng dialog.
    <div className="ld-overlay" onClick={onCancel}>
      {/* stopPropagation để click trong box không lan ra overlay phía ngoài. */}
      <div className="ld-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ld-icon-wrap">
          <LogOut size={28} strokeWidth={2} />
        </div>
        <h3 className="ld-title">Đăng xuất?</h3>
        <p className="ld-desc">Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?</p>
        <div className="ld-actions">
          <button className="ld-btn-cancel" onClick={onCancel}>Hủy</button>
          <button className="ld-btn-confirm" onClick={onConfirm}>
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutDialog;
