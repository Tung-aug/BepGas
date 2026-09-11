// Trang chính sách hỗ trợ khách hàng với layout sidebar + nội dung.
// Sidebar bên trái liệt kê tất cả các chính sách, bên phải hiện nội dung chính sách đang chọn.
// useParams lấy slug từ URL để biết đang xem chính sách nào, mặc định là 'doi-tra' nếu không có slug.

import { useParams, Link } from 'react-router-dom';

// Các icon đại diện cho từng loại chính sách để người dùng nhận ra nhanh bằng hình ảnh.
import { ChevronRight, ShieldCheck, RotateCcw, Truck, HelpCircle, FileText, Lock } from 'lucide-react';

// POLICIES chứa toàn bộ nội dung chính sách, khoá là slug dùng trong URL.
// Mỗi chính sách có icon, tiêu đề và mảng sections — mỗi section là một phần nội dung với heading và body.
// Dùng whiteSpace: pre-line khi render body để giữ nguyên xuống dòng và dấu bullet.
const POLICIES = {
  'doi-tra': {
    icon: <RotateCcw size={28} color="#e85d04" />,
    title: 'Chính sách đổi trả',
    sections: [
      { heading: 'Thời hạn đổi trả', body: 'Khách hàng có thể đổi trả sản phẩm trong vòng 30 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tem, nhãn, bao bì và chưa qua sử dụng.' },
      { heading: 'Điều kiện đổi trả', body: '• Sản phẩm bị lỗi kỹ thuật do nhà sản xuất.\n• Sản phẩm không đúng mô tả, sai mẫu mã, màu sắc.\n• Sản phẩm bị hư hỏng trong quá trình vận chuyển.' },
      { heading: 'Quy trình đổi trả', body: '1. Liên hệ hotline 1800 1234 hoặc email support@bepgasvn.com.\n2. Cung cấp mã đơn hàng và mô tả lý do đổi trả.\n3. Gửi sản phẩm về địa chỉ kho hàng theo hướng dẫn.\n4. BếpGasVN kiểm tra và xử lý trong 3–5 ngày làm việc.' },
      { heading: 'Trường hợp không áp dụng', body: '• Sản phẩm đã qua sử dụng, trầy xước do người dùng.\n• Sản phẩm hết thời hạn đổi trả 30 ngày.\n• Sản phẩm thuộc danh mục hàng tiêu hao (vật tư, phụ kiện nhỏ).' },
    ],
  },
  'bao-hanh': {
    icon: <ShieldCheck size={28} color="#e85d04" />,
    title: 'Chính sách bảo hành',
    sections: [
      { heading: 'Thời hạn bảo hành', body: 'Tất cả sản phẩm tại BếpGasVN đều được bảo hành chính hãng từ 12 đến 24 tháng tùy loại sản phẩm. Thời hạn cụ thể được ghi trên phiếu bảo hành kèm theo.' },
      { heading: 'Phạm vi bảo hành', body: '• Lỗi kỹ thuật do nhà sản xuất trong điều kiện sử dụng bình thường.\n• Hỏng hóc phần điện tử, linh kiện chính.' },
      { heading: 'Không áp dụng bảo hành', body: '• Hư hỏng do va đập, rơi vỡ, ngập nước.\n• Sử dụng không đúng hướng dẫn.\n• Tự ý sửa chữa hoặc can thiệp linh kiện.' },
      { heading: 'Trung tâm bảo hành', body: 'Mang sản phẩm đến bất kỳ trung tâm bảo hành ủy quyền của thương hiệu hoặc liên hệ BếpGasVN để được hỗ trợ đặt lịch bảo hành tận nơi.' },
    ],
  },
  'mua-hang': {
    icon: <Truck size={28} color="#e85d04" />,
    title: 'Hướng dẫn mua hàng',
    sections: [
      { heading: 'Bước 1: Chọn sản phẩm', body: 'Duyệt qua danh mục hoặc sử dụng thanh tìm kiếm để tìm sản phẩm phù hợp. Nhấn vào sản phẩm để xem chi tiết, thông số kỹ thuật và đánh giá của khách hàng.' },
      { heading: 'Bước 2: Thêm vào giỏ hàng', body: 'Chọn số lượng và nhấn "Thêm vào giỏ hàng". Bạn có thể tiếp tục mua sắm hoặc tiến hành thanh toán ngay.' },
      { heading: 'Bước 3: Thanh toán', body: 'Điền thông tin giao hàng, chọn phương thức thanh toán (COD, VNPAY, VISA, MoMo) và xác nhận đơn hàng.' },
      { heading: 'Bước 4: Nhận hàng', body: 'Đơn hàng sẽ được xử lý trong 1–2 giờ và giao đến bạn trong 2–5 ngày làm việc tùy khu vực. Bạn sẽ nhận được SMS/email thông báo khi hàng được giao.' },
    ],
  },
  'faq': {
    icon: <HelpCircle size={28} color="#e85d04" />,
    title: 'Câu hỏi thường gặp',
    sections: [
      { heading: 'Tôi có thể mua hàng mà không cần tài khoản không?', body: 'Có, bạn có thể thêm sản phẩm vào giỏ và xem giỏ hàng mà không cần đăng nhập. Tuy nhiên để thanh toán bạn cần tạo tài khoản để chúng tôi có thể xác nhận và theo dõi đơn hàng.' },
      { heading: 'Thời gian giao hàng là bao lâu?', body: 'Nội thành Hà Nội và TP.HCM: 1–2 ngày làm việc.\nCác tỉnh thành khác: 3–5 ngày làm việc.\nVùng sâu, vùng xa: 5–7 ngày làm việc.' },
      { heading: 'Tôi có thể hủy đơn hàng không?', body: 'Bạn có thể hủy đơn hàng trong vòng 1 giờ kể từ khi đặt hàng thành công, trước khi đơn được xác nhận. Sau đó vui lòng liên hệ hotline để được hỗ trợ.' },
      { heading: 'Sản phẩm có đúng hàng chính hãng không?', body: 'Tất cả sản phẩm tại BếpGasVN đều 100% chính hãng, có tem bảo hành và hóa đơn VAT đầy đủ. Chúng tôi cam kết hoàn tiền nếu sản phẩm không phải hàng chính hãng.' },
    ],
  },
  'dieu-khoan': {
    icon: <FileText size={28} color="#e85d04" />,
    title: 'Điều khoản sử dụng',
    sections: [
      { heading: 'Chấp nhận điều khoản', body: 'Khi sử dụng website BếpGasVN, bạn đồng ý tuân thủ các điều khoản và điều kiện sau đây.' },
      { heading: 'Quyền sở hữu trí tuệ', body: 'Toàn bộ nội dung, hình ảnh, logo và thương hiệu trên website thuộc quyền sở hữu của BếpGasVN. Nghiêm cấm sao chép, phân phối mà không có sự cho phép.' },
      { heading: 'Giới hạn trách nhiệm', body: 'BếpGasVN không chịu trách nhiệm cho các thiệt hại gián tiếp phát sinh từ việc sử dụng website hoặc sản phẩm không đúng hướng dẫn.' },
      { heading: 'Thay đổi điều khoản', body: 'BếpGasVN có quyền thay đổi điều khoản sử dụng bất kỳ lúc nào. Thay đổi sẽ có hiệu lực ngay khi được đăng tải lên website.' },
    ],
  },
  'bao-mat': {
    icon: <Lock size={28} color="#e85d04" />,
    title: 'Chính sách bảo mật',
    sections: [
      { heading: 'Thu thập thông tin', body: 'Chúng tôi thu thập tên, email, số điện thoại và địa chỉ khi bạn đặt hàng để phục vụ giao hàng và chăm sóc khách hàng.' },
      { heading: 'Sử dụng thông tin', body: 'Thông tin của bạn chỉ được dùng để xử lý đơn hàng, cải thiện dịch vụ và gửi thông tin khuyến mãi (nếu bạn đồng ý). Chúng tôi không bán dữ liệu cho bên thứ ba.' },
      { heading: 'Bảo vệ thông tin', body: 'Dữ liệu được mã hóa SSL và lưu trữ trên server bảo mật. Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ thông tin của bạn.' },
      { heading: 'Quyền của bạn', body: 'Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân bất kỳ lúc nào bằng cách liên hệ support@bepgasvn.com.' },
    ],
  },
};

// MENU là danh sách hiển thị sidebar, thứ tự ở đây là thứ tự xuất hiện trong sidebar.
// slug phải khớp với khoá trong POLICIES để Link điều hướng đúng trang.
const MENU = [
  { slug: 'doi-tra',    label: 'Chính sách đổi trả' },
  { slug: 'bao-hanh',  label: 'Chính sách bảo hành' },
  { slug: 'mua-hang',  label: 'Hướng dẫn mua hàng' },
  { slug: 'faq',       label: 'Câu hỏi thường gặp' },
  { slug: 'dieu-khoan',label: 'Điều khoản sử dụng' },
  { slug: 'bao-mat',   label: 'Chính sách bảo mật' },
];

const Policy = () => {
  // Lấy slug từ URL để xác định trang đang xem.
  // Nếu slug không hợp lệ hoặc không có, dùng 'doi-tra' làm mặc định để tránh trang trắng.
  const { slug } = useParams();
  const page = POLICIES[slug] ?? POLICIES['doi-tra'];

  return (
    <main className="policy-page">
      <div className="container policy-layout">

        {/* Sidebar trái liệt kê tất cả chính sách, mục đang xem được đánh dấu bằng class active. */}
        <aside className="policy-sidebar">
          <h3>Hỗ trợ khách hàng</h3>
          {MENU.map(m => (
            <Link
              key={m.slug}
              to={`/policy/${m.slug}`}
              className={`policy-menu-item ${slug === m.slug ? 'active' : ''}`}
            >
              {m.label} <ChevronRight size={14} />
            </Link>
          ))}
        </aside>

        {/* Cột nội dung bên phải hiện breadcrumb, tiêu đề và từng phần nội dung của chính sách. */}
        <div className="policy-content">

          {/* Breadcrumb giúp người dùng biết đang ở đâu và quay lại trang chủ dễ dàng. */}
          <nav className="cart-breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <Link to="/">Trang chủ</Link>
            <ChevronRight size={14} />
            <span>{page.title}</span>
          </nav>

          {/* Tiêu đề kèm icon lớn để nhận diện nhanh đây là chính sách gì. */}
          <div className="policy-title">
            {page.icon}
            <h1>{page.title}</h1>
          </div>

          {/* Duyệt qua từng phần nội dung, whiteSpace: pre-line giữ nguyên xuống dòng trong body. */}
          {page.sections.map((s, i) => (
            <div key={i} className="policy-section">
              <h2>{s.heading}</h2>
              <p style={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{s.body}</p>
            </div>
          ))}

          {/* Khung liên hệ cố định ở cuối mỗi trang chính sách để khách hàng dễ tìm số hotline. */}
          <div className="policy-contact">
            <p>Cần hỗ trợ thêm? Liên hệ chúng tôi:</p>
            <p>📞 <strong>1800 1234</strong> (Miễn phí · 8:00–22:00 T2–CN)</p>
            <p>✉️ <strong>support@bepgasvn.com</strong></p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Policy;
