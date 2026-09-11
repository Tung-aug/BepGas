// Trang đăng nhập dành riêng cho admin và nhân viên, dùng layout chia đôi màn hình.
// Bên trái là panel thương hiệu màu tối, bên phải là form đăng nhập.

// useState để lưu dữ liệu form, trạng thái hiện mật khẩu và thông báo lỗi.
import { useState } from 'react';

// useNavigate dùng để chuyển trang sau khi đăng nhập thành công.
// useLocation giúp lấy trang người dùng định vào trước khi bị chặn lại để đăng nhập.
// Navigate dùng để redirect ngay trong JSX khi đã có session đăng nhập rồi.
// Link để tạo liên kết quay lại trang chủ.
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';

// Các icon minh hoạ cho form: Flame là logo bếp, Mail và Lock cho các trường nhập liệu,
// Eye và EyeOff để toggle hiện/ẩn mật khẩu, ShieldCheck cho badge bảo mật,
// AlertCircle cho thông báo lỗi, LogIn cho nút đăng nhập.
import { Flame, Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminLogin = () => {
  // Lấy hàm loginAdmin để gọi API và các flag kiểm tra quyền từ context xác thực.
  const { loginAdmin, isLoggedIn, isManager, isStaff } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // from lưu trang người dùng đang định truy cập trước khi bị RequireAuth chặn lại,
  // dùng để redirect về đúng trang sau khi đăng nhập thành công.
  const from = location.state?.from?.pathname || null;

  // Tất cả hook phải khai báo trước bất kỳ câu lệnh return nào, đây là yêu cầu bắt buộc của React.
  const [form, setForm]                 = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false); // toggle hiện/ẩn mật khẩu
  const [error, setError]               = useState('');    // thông báo lỗi hiển thị dưới form
  const [loading, setLoading]           = useState(false); // đang gọi API đăng nhập

  // Nếu người dùng đã đăng nhập và có quyền quản trị thì không cần vào trang này nữa,
  // redirect luôn về trang phù hợp theo role: staff chỉ vào được trang đơn hàng.
  if (isLoggedIn && isManager) {
    return <Navigate to={isStaff ? '/admin/orders' : '/admin'} replace />;
  }

  // handleSubmit xử lý khi người dùng nhấn nút đăng nhập.
  // Kiểm tra đủ thông tin trước, sau đó gọi loginAdmin và xử lý kết quả trả về.
  const handleSubmit = async (e) => {
    e.preventDefault(); // ngăn form reload trang theo mặc định của trình duyệt
    if (!form.email || !form.password) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    setLoading(true);
    const result = await loginAdmin(form.email, form.password);
    setLoading(false);

    if (result.success) {
      // Chuẩn hoá role từ backend, ví dụ "ROLE_STAFF" thành "STAFF".
      const role = (result.user?.role || '').replace('ROLE_', '').toUpperCase();
      // Ưu tiên về trang người dùng định vào trước, nếu không có thì về trang mặc định theo role.
      const dest = from || (role === 'STAFF' ? '/admin/orders' : '/admin');
      navigate(dest, { replace: true });
    } else {
      // Phân tích nội dung lỗi từ backend để hiện thông báo thân thiện hơn với người dùng.
      const msg = (result.message || '').toLowerCase();
      setError(
        msg.includes('quyền') || msg.includes('quản trị')
          ? result.message
          : msg.includes('khóa') || msg.includes('locked')
          ? 'Tài khoản đã bị tạm khóa. Vui lòng thử lại sau.'
          : msg.includes('bad credentials') || msg.includes('incorrect') || msg.includes('sai')
          ? 'Email hoặc mật khẩu không đúng.'
          : msg.includes('không tồn tại') || msg.includes('not found')
          ? 'Tài khoản không tồn tại.'
          : 'Đăng nhập thất bại. Vui lòng thử lại.'
      );
    }
  };

  return (
    <div className="admin-login-page">

      {/* Panel bên trái hiển thị tên thương hiệu và thông tin hệ thống.
          Chỉ dành cho trang trí, không có tương tác người dùng. */}
      <div className="admin-login-brand">
        <div className="admin-brand-content">
          <div className="admin-brand-icon-wrap">
            <Flame size={40} color="#fff" />
          </div>
          <h1>BếpGas<span style={{ color: 'var(--primary)' }}>VN</span></h1>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '1.25rem 0' }} />
          <p>
            Hệ thống quản trị nội bộ<br />
            Chỉ dành cho nhân viên được cấp phép
          </p>
          <p className="admin-brand-version">Admin Panel v2.0</p>
        </div>
      </div>

      {/* Panel bên phải chứa form đăng nhập với logo, badge bảo mật và các trường nhập liệu. */}
      <div className="admin-login-right">
        <div className="admin-login-card-v2">

          {/* Logo nhỏ và badge "Khu vực quản trị nội bộ" đặt ở trên cùng form. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Flame size={22} color="var(--primary)" />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              BếpGas<span style={{ color: 'var(--primary)' }}>VN</span>
            </span>
          </div>

          <div className="admin-security-badge">
            <ShieldCheck size={13} /> Khu vực quản trị nội bộ
          </div>

          <h2>Đăng nhập</h2>
          <p className="admin-login-desc">Dành cho quản trị viên và nhân viên được cấp quyền</p>

          {/* Khối thông báo lỗi chỉ xuất hiện khi biến error có nội dung.
              Tự động ẩn khi người dùng bắt đầu gõ lại vào các trường nhập liệu. */}
          {error && (
            <div className="admin-login-error">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Trường email với icon bưu phẩm bên trái.
                autoComplete="email" giúp trình duyệt gợi ý email đã lưu. */}
            <div className="form-group">
              <label>Email quản trị</label>
              <div className="input-wrap">
                <Mail size={17} className="input-icon" />
                <input
                  type="email"
                  placeholder="admin@bepgas.com"
                  value={form.email}
                  autoComplete="email"
                  onChange={e => { setForm({ ...form, email: e.target.value }); setError(''); }}
                />
              </div>
            </div>

            {/* Trường mật khẩu với nút toggle hiện/ẩn ở bên phải.
                Khi showPassword là true thì type="text" để hiện chữ thật, ngược lại type="password". */}
            <div className="form-group">
              <label>Mật khẩu</label>
              <div className="input-wrap">
                <Lock size={17} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={form.password}
                  autoComplete="current-password"
                  onChange={e => { setForm({ ...form, password: e.target.value }); setError(''); }}
                />
                <button type="button" className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Nút đăng nhập: khi đang gọi API thì hiện spinner và văn bản chờ,
                khi bình thường thì hiện icon LogIn và chữ Đăng nhập. */}
            <button type="submit" className="admin-auth-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spin" style={{ display: 'inline-block', width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Đang xác thực...
                </>
              ) : (
                <><LogIn size={17} /> Đăng nhập</>
              )}
            </button>
          </form>

          {/* Liên kết quay lại trang chủ dành cho người dùng vào nhầm trang admin. */}
          <Link to="/" className="admin-login-back-v2">← Quay lại trang chủ</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
