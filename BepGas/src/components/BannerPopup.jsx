// Popup banner hiển thị khi người dùng vào trang lần đầu trong mỗi phiên trình duyệt.
// Dùng sessionStorage để đảm bảo chỉ hiện 1 lần — mở tab mới sẽ hiện lại nhưng refresh thì không.

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { bannerAPI } from '../services/api';

const SESSION_KEY = 'bepgas_popup_shown';

const BannerPopup = () => {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    // Nếu đã hiện trong phiên này rồi thì bỏ qua, không gọi API nữa.
    if (sessionStorage.getItem(SESSION_KEY)) return;
    bannerAPI.getActive()
      .then(res => {
        const list = res?.data ?? res ?? [];
        // Lọc ra chỉ lấy banner có position='popup' và đang kích hoạt.
        const popups = Array.isArray(list)
          ? list.filter(b => b.position === 'popup' && b.isActive !== false)
          : [];
        // Chỉ hiện popup đầu tiên trong danh sách — admin thường chỉ tạo 1 popup cùng lúc.
        if (popups.length > 0) {
          setBanner(popups[0]);
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      })
      .catch(() => {});
  }, []);

  if (!banner) return null;

  const handleClose = () => setBanner(null);

  return (
    <div className="popup-overlay" onClick={handleClose}>
      <div className="popup-modal" onClick={e => e.stopPropagation()}>
        {/* Nút đóng */}
        <button className="popup-close" onClick={handleClose} title="Đóng">
          <X size={18} />
        </button>

        {/* Ảnh banner — có link nếu được cài */}
        {banner.linkUrl ? (
          <a href={banner.linkUrl}>
            <img src={banner.imageUrl} alt={banner.bannerTitle || 'Khuyến mãi'} />
          </a>
        ) : (
          <img src={banner.imageUrl} alt={banner.bannerTitle || 'Khuyến mãi'} />
        )}

        {/* Tiêu đề (nếu có) */}
        {banner.bannerTitle && (
          <div className="popup-footer">
            <p>{banner.bannerTitle}</p>
            {banner.linkUrl && (
              <a href={banner.linkUrl} className="popup-cta">Xem ngay →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerPopup;