// Trang đăng nhập dành cho khách hàng, dùng layout chia đôi màn hình.
// Bên trái là panel thương hiệu giới thiệu lợi ích mua hàng, bên phải là form đăng nhập.
// Sau khi đăng nhập thành công, người dùng được redirect về trang họ định vào trước đó.

import { useState } from 'react';

// useNavigate để chuyển trang sau khi đăng nhập thành công.
// useLocation để lấy trang người dùng định vào trước khi bị chặn để đăng nhập.
import { Link, useNavigate, useLocation } from 'react-router-dom';

// Flame là logo thương hiệu, Mail và Lock là icon trường nhập liệu,
// Eye/EyeOff toggle hiện/ẩn mật khẩu, CheckCircle xác nhận email hợp lệ,
// các icon còn lại dùng trong danh sách lợi ích mua hàng ở panel trái.
import {
  Mail, Lock, Eye, EyeOff, Flame,
  ShieldCheck, Truck, RotateCcw, Star, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/toast';

// PERKS là danh sách lợi ích hiển thị trên panel trái để thuyết phục người dùng đăng ký/đăng nhập.
// Đặt ngoài component để không tạo lại mảng mỗi lần render.
const PERKS = [
  { icon: <ShieldCheck size={16} />, text: 'Hàng chính hãng 100% — bảo hành đầy đủ' },
  { icon: <Truck size={16} />,       text: 'Miễn phí vận chuyển đơn từ 500.000đ' },
  { icon: <RotateCcw size={16} />,   text: 'Đổi trả dễ dàng trong 30 ngày' },
  { icon: <Star size={16} />,        text: 'Hơn 10.000 khách hàng tin dùng' },
];

const Login = () => {
  // Lấy hàm login từ context xác thực để gọi API đăng nhập.
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  // from là trang người dùng định vào trước khi bị RequireAuth chặn lại để đăng nhập.
  // Nếu không có thì về trang chủ sau khi đăng nhập thành công.
  const from = location.state?.from ?? '/';

  const [form, setForm]                 = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false); // toggle ẩn/hiện mật khẩu
  const [rememberMe, setRememberMe]     = useState(false); // ghi nhớ đăng nhập
  const [error, setError]               = useState('');    // thông báo lỗi dưới form
  const [loading, setLoading]           = useState(false); // đang gọi API đăng nhập

  // handleChange cập nhật từng trường trong form và xoá thông báo lỗi cũ khi người dùng gõ lại.
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // handleSubmit kiểm tra dữ liệu trống, gọi API đăng nhập và xử lý kết quả.
  // Nếu thành công thì redirect, nếu thất bại thì phân tích lỗi từ backend để hiện thông báo phù hợp.
  const handleSubmit = async (e) => {
    e.preventDefault(); // ngăn trình duyệt reload trang khi submit form
    if (!form.email || !form.password) { setError('Vui lòng điền đầy đủ thông tin.'); return; }

    setLoading(true);
    const result = await login(form.email, form.password, rememberMe);
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      // Phân tích message lỗi từ backend để chuyển thành câu thông báo thân thiện hơn với người dùng.
      const msg = (result.message || '').toLowerCase();
      setError(
        msg.includes('bad credentials') || msg.includes('incorrect') || msg.includes('unauthorized')
          ? 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.'
          : msg.includes('not found') || msg.includes('không tồn tại')
          ? 'Tài khoản không tồn tại.'
          : msg.includes('locked') || msg.includes('khóa')
          ? 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.'
          : 'Đăng nhập thất bại. Vui lòng thử lại.'
      );
    }
  };

  return (
    <main className="auth-split">

      {/* Panel trái hiển thị thương hiệu, tagline và danh sách lợi ích mua hàng.
          Panel này bị ẩn trên màn hình nhỏ (mobile), thay bằng logo nhỏ trong form. */}
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-logo-wrap">
            <Flame size={34} color="#e85d04" />
            <span>BếpGas<strong>VN</strong></span>
          </div>
          <h2 className="auth-brand-tagline">
            Khám phá thế giới<br />thiết bị nhà bếp cao cấp
          </h2>
          <p className="auth-brand-desc">
            Hàng ngàn sản phẩm từ Rinnai, Sunhouse, Bosch, Electrolux —
            bảo hành chính hãng, giao hàng toàn quốc.
          </p>
          {/* Danh sách lợi ích với icon nhỏ, mỗi mục là một điểm thuyết phục người dùng tin tưởng. */}
          <ul className="auth-brand-perks">
            {PERKS.map((p, i) => (
              <li key={i}>{p.icon} {p.text}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Panel phải chứa form đăng nhập thực sự. */}
      <div className="auth-form-panel">
        <div className="auth-form-box">

          {/* Logo nhỏ chỉ hiện trên mobile khi panel trái bị ẩn, để người dùng vẫn nhận ra thương hiệu. */}
          <div className="auth-logo auth-logo-mobile">
            <Flame size={28} color="#e85d04" />
            <span>BếpGas<strong>VN</strong></span>
          </div>

          <h1>Đăng nhập</h1>
          <p className="auth-subtitle">Chào mừng bạn quay trở lại!</p>

          <form onSubmit={handleSubmit} className="auth-form">

            {/* Trường email: icon Mail bên trái, checkmark xanh hiện khi email đúng định dạng.
                Regex kiểm tra định dạng email cơ bản để hiện checkmark ngay lập tức khi gõ. */}
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <div className="input-wrap">
                <Mail size={18} className="input-icon" />
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                {form.email && /\S+@\S+\.\S+/.test(form.email) && (
                  <span className="input-valid-icon"><CheckCircle size={16} color="#10b981" /></span>
                )}
              </div>
            </div>

            {/* Trường mật khẩu với nút toggle hiện/ẩn bên phải.
                type thay đổi giữa "text" và "password" tuỳ thuộc vào showPassword. */}
            <div className="form-group">
              <label htmlFor="login-password">Mật khẩu</label>
              <div className="input-wrap">
                <Lock size={18} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Nhập mật khẩu"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Thông báo lỗi chỉ hiển thị khi có lỗi, tự ẩn khi người dùng gõ lại. */}
            {error && <p className="auth-error">{error}</p>}

            {/* Checkbox "ghi nhớ đăng nhập". Link "Quên mật khẩu?" đang tạm ẩn vì chưa có
                tính năng reset mật khẩu qua email — bật lại bằng cách bỏ comment bên dưới. */}
            <div className="form-extras">
              <label className="checkbox-label">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Ghi nhớ đăng nhập
              </label>
              {/* <a href="#" className="forgot-link" onClick={e => { e.preventDefault(); toast.info('Vui lòng liên hệ quản trị viên để được hỗ trợ đặt lại mật khẩu.'); }}>Quên mật khẩu?</a> */}
            </div>

            {/* Nút đăng nhập disable trong lúc đang gọi API để tránh submit nhiều lần. */}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Link chuyển sang trang đăng ký cho người dùng chưa có tài khoản. */}
          <p className="auth-switch">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default Login;
