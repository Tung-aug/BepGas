// Tự động cuộn lên đầu trang mỗi khi chuyển sang route mới
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]); // Chạy lại mỗi khi URL thay đổi

  return null; // Component này không render gì cả
};

export default ScrollToTop;
