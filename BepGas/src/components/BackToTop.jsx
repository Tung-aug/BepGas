// Nút cuộn về đầu trang, chỉ xuất hiện khi người dùng đã cuộn xuống hơn 400px.
// Lắng nghe sự kiện scroll với passive: true để không block thread chính của trình duyệt.

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

const BackToTop = () => {
  // visible là true khi vị trí cuộn vượt quá 400px tính từ đầu trang.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Không render gì khi chưa cuộn đủ xa để tránh hiện nút quá sớm.
  if (!visible) return null;

  return (
    <button
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Về đầu trang"
      aria-label="Về đầu trang"
    >
      <ChevronUp size={22} />
    </button>
  );
};

export default BackToTop;
