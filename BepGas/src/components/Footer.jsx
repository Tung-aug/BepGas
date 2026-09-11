// Footer hiển thị ở cuối mọi trang khách hàng, không hiện trong khu vực admin.
// Gồm 4 cột: thương hiệu + mạng xã hội, danh mục lấy từ API, hỗ trợ khách hàng, liên hệ.

import { Flame, Phone, Mail, MapPin, Share2, Play, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCategories } from '../context/CategoryContext';

const Footer = () => {
  const { rootCategories } = useCategories();
  // Chỉ lấy tối đa 6 danh mục gốc để footer không quá dài trên màn hình nhỏ.
  const cats = rootCategories.slice(0, 6);

  return (
    <footer className="footer">
      <div className="container footer-grid">

        {/* Cột 1: Logo + mô tả + mạng xã hội */}
        <div className="footer-brand">
          <Link to="/" className="logo footer-logo">
            <Flame size={24} color="#e85d04" />
            <span>BếpGas<strong>VN</strong></span>
          </Link>
          <p>Chuyên cung cấp thiết bị nhà bếp cao cấp, chính hãng với giá tốt nhất thị trường. Bảo hành chính hãng — giao hàng toàn quốc.</p>
          <div className="footer-social">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Share2 size={18} />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <Play size={18} />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Camera size={18} />
            </a>
          </div>
        </div>

        {/* Cột 2: Danh mục lấy từ API, fallback sang danh sách tĩnh nếu API chưa trả về. */}
        <div className="footer-col">
          <h4>Danh mục sản phẩm</h4>
          {cats.length > 0
            ? cats.map(c => (
                <Link key={c.categoryId ?? c.id} to={`/products?category=${c.slug ?? (c.categoryId ?? c.id)}`}>
                  {c.categoryName ?? c.name}
                </Link>
              ))
            : <>
                <Link to="/products?category=bep-gas">Bếp gas & bếp từ</Link>
                <Link to="/products?category=noi-chao">Nồi & Chảo</Link>
                <Link to="/products?category=lo-nuong">Lò nướng</Link>
                <Link to="/products?category=phu-kien">Phụ kiện nhà bếp</Link>
              </>}
          <Link to="/products" className="footer-see-all">Xem tất cả →</Link>
        </div>

        {/* Cột 3: Hỗ trợ */}
        <div className="footer-col">
          <h4>Hỗ trợ khách hàng</h4>
          <Link to="/account" state={{ tab: 'orders' }}>Theo dõi đơn hàng</Link>
          <Link to="/policy/doi-tra">Chính sách đổi trả</Link>
          <Link to="/policy/bao-hanh">Chính sách bảo hành</Link>
          <Link to="/policy/mua-hang">Hướng dẫn mua hàng</Link>
          <Link to="/policy/faq">Câu hỏi thường gặp</Link>
          <Link to="/blog">Cẩm nang nhà bếp</Link>
        </div>

        {/* Cột 4: Liên hệ */}
        <div className="footer-col">
          <h4>Liên hệ</h4>
          <div className="contact-item"><MapPin size={15} /><span>23 Du Nội, Đông Anh, TP. Hà Nội</span></div>
          <div className="contact-item"><Phone size={15} /><span>1800 1234 (Miễn phí)</span></div>
          <div className="contact-item"><Mail size={15} /><span>support@bepgasvn.com</span></div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.75rem' }}>
            Giờ làm việc: 8:00 – 22:00 (T2–CN)
          </p>
        </div>
      </div>

      {/* Phương thức thanh toán */}
      <div className="footer-payment">
        <div className="container">
          <span className="fp-label">Thanh toán an toàn:</span>
          <div className="fp-logos">
            <span className="fp-badge fp-cod">COD</span>
            <span className="fp-badge fp-vnpay">VNPAY</span>
            <span className="fp-badge fp-visa">VISA</span>
            <span className="fp-badge fp-master">Mastercard</span>
            <span className="fp-badge fp-momo">MoMo</span>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="footer-bottom">
        <div className="container">
          <p>© 2026 BếpGasVN. Tất cả quyền được bảo lưu.</p>
          <div className="footer-bottom-links">
            <Link to="/policy/dieu-khoan">Điều khoản sử dụng</Link>
            <Link to="/policy/bao-mat">Chính sách bảo mật</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
