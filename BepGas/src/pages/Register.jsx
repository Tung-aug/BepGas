// Trang đăng ký tài khoản mới, dùng layout chia đôi màn hình giống trang đăng nhập.
// Sau khi đăng ký thành công, hiện màn hình chúc mừng và đếm ngược 3 giây rồi về trang chủ.
// Có thanh đo độ mạnh mật khẩu và checkmark xanh xác nhận từng field ngay khi gõ.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// User và Phone là icon cho trường nhập họ tên và số điện thoại.
// Các icon còn lại dùng chung với trang Login cho panel trái và trường mật khẩu.
import {
  Mail, Lock, Eye, EyeOff, User, Phone, Flame,
  ShieldCheck, Truck, RotateCcw, Star, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// PERKS là danh sách lợi ích hiển thị trên panel trái, đặt ngoài component để không tạo lại mỗi render.
const PERKS = [
  { icon: <ShieldCheck size={16} />, text: 'Hàng chính hãng 100% — bảo hành đầy đủ' },
  { icon: <Truck size={16} />,       text: 'Miễn phí vận chuyển đơn từ 500.000đ' },
  { icon: <RotateCcw size={16} />,   text: 'Đổi trả dễ dàng trong 30 ngày' },
  { icon: <Star size={16} />,        text: 'Hơn 10.000 khách hàng tin dùng' },
];

// getStrength tính điểm mật khẩu dựa trên độ dài và các loại ký tự có trong đó.
// Trả về level (1-4), % để fill thanh màu, màu sắc thanh và nhãn hiển thị cho người dùng.
const getStrength = (pw) => {
  if (!pw) return { level: 0, pct: '0%', color: '#e5e7eb', label: '' };
  let score = 0;
  if (pw.length >= 6)  score++;   // đủ dài cơ bản
  if (pw.length >= 10) score++;   // dài hơn thì cộng thêm
  if (/[A-Z]/.test(pw)) score++;  // có chữ hoa
  if (/[0-9]/.test(pw)) score++;  // có số
  if (/[^A-Za-z0-9]/.test(pw)) score++; // có ký tự đặc biệt
  if (score <= 1) return { level: 1, pct: '25%',  color: '#ef4444', label: 'Yếu' };
  if (score === 2) return { level: 2, pct: '50%',  color: '#f59e0b', label: 'Trung bình' };
  if (score === 3) return { level: 3, pct: '75%',  color: '#84cc16', label: 'Khá' };
  return              { level: 4, pct: '100%', color: '#10b981', label: 'Mạnh' };
};

const Register = () => {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form, setForm]                 = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]             = useState({});    // lỗi từng field riêng biệt + lỗi submit
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(false); // true khi đăng ký thành công, hiện màn hình chúc mừng
  const [countdown, setCountdown]       = useState(3);     // đếm ngược giây trước khi redirect

  // strength được tính lại mỗi khi mật khẩu thay đổi, dùng để hiển thị thanh đo độ mạnh.
  const strength = getStrength(form.password);

  // useEffect chạy đếm ngược sau khi đăng ký thành công.
  // Mỗi giây countdown giảm 1, khi về 0 thì navigate về trang chủ.
  // clearTimeout trong cleanup đảm bảo không bị memory leak nếu component unmount giữa chừng.
  useEffect(() => {
    if (!success) return;
    if (countdown === 0) { navigate('/'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [success, countdown, navigate]);

  // handleChange cập nhật field tương ứng và xoá lỗi của field đó khi người dùng gõ lại.
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  // validate kiểm tra từng field và trả về object chứa các lỗi nếu có.
  // Object rỗng nghĩa là form hợp lệ, có thể gửi đi.
  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name = 'Vui lòng nhập họ tên.';
    const phoneClean = form.phone.replace(/[\s.\-]/g, '');
    if (!phoneClean) e.phone = 'Vui lòng nhập số điện thoại.';
    else if (!/^0[3-9]\d{8}$/.test(phoneClean)) e.phone = 'Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số).';
    if (!form.email) e.email = 'Vui lòng nhập email.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email không hợp lệ.';
    if (!form.password) e.password = 'Vui lòng nhập mật khẩu.';
    else if (form.password.length < 6) e.password = 'Mật khẩu phải từ 6 ký tự.';
    if (form.password !== form.confirm) e.confirm = 'Mật khẩu xác nhận không khớp.';
    return e;
  };

  // handleSubmit validate trước, nếu có lỗi thì hiện lỗi và dừng.
  // Nếu hợp lệ thì gọi API đăng ký, thành công thì hiện màn hình chúc mừng.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setLoading(true);
    const result = await register(form.name, form.phone.replace(/[\s.\-]/g, ''), form.email, form.password);
    setLoading(false);
    if (result.success) setSuccess(true);
    else setErrors({ submit: result.message }); // lỗi từ API, ví dụ email đã tồn tại
  };

  // Các biến boolean tính sẵn để hiện checkmark xanh ngay khi field đạt tiêu chuẩn.
  // Dùng regex nhẹ để kiểm tra tức thì khi gõ, không cần submit mới biết.
  const validName    = form.name.trim().length > 1;
  const validPhone   = /^0[3-9]\d{8}$/.test(form.phone.replace(/[\s.\-]/g, ''));
  const validEmail   = /\S+@\S+\.\S+/.test(form.email);
  const validConfirm = form.confirm && form.confirm === form.password;

  return (
    <main className="auth-split">

      {/* Panel trái thương hiệu — ẩn trên mobile. */}
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-logo-wrap">
            <Flame size={34} color="#e85d04" />
            <span>BếpGas<strong>VN</strong></span>
          </div>
          <h2 className="auth-brand-tagline">
            Tạo tài khoản<br />mua sắm thông minh
          </h2>
          <p className="auth-brand-desc">
            Đăng ký để theo dõi đơn hàng, lưu sản phẩm yêu thích
            và nhận ưu đãi độc quyền cho thành viên.
          </p>
          <ul className="auth-brand-perks">
            {PERKS.map((p, i) => (
              <li key={i}>{p.icon} {p.text}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Panel phải: hiện màn hình chúc mừng sau khi đăng ký thành công, hoặc form đăng ký. */}
      <div className="auth-form-panel">
        <div className="auth-form-box">

          {success ? (
            // Màn hình chúc mừng với icon checkmark lớn và đếm ngược tự động về trang chủ.
            <div className="reg-success">
              <div className="reg-success-icon">
                <CheckCircle size={52} color="#10b981" strokeWidth={1.8}/>
              </div>
              <h2 className="reg-success-title">Đăng ký thành công!</h2>
              <p className="reg-success-name">Chào mừng <strong>{form.name}</strong> đến với BếpGasVN!</p>
              <p className="reg-success-hint">Đang chuyển về trang chủ sau <strong>{countdown}</strong> giây...</p>
              <button className="auth-btn" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>
                Về trang chủ ngay
              </button>
            </div>
          ) : (
            <>
              {/* Logo nhỏ chỉ hiện trên mobile khi panel trái bị ẩn. */}
              <div className="auth-logo auth-logo-mobile">
                <Flame size={28} color="#e85d04" />
                <span>BếpGas<strong>VN</strong></span>
              </div>

              <h1>Tạo tài khoản</h1>
              <p className="auth-subtitle">Đăng ký để mua sắm dễ dàng hơn!</p>

              {/* Lỗi từ API (ví dụ: email đã tồn tại) hiện ở đây phía trên form. */}
              {errors.submit && <p className="auth-error" style={{ marginBottom: '1rem' }}>{errors.submit}</p>}

              <form onSubmit={handleSubmit} className="auth-form">

                {/* Trường họ tên: checkmark xanh khi tên có hơn 1 ký tự. */}
                <div className="form-group">
                  <label htmlFor="reg-name">Họ và tên</label>
                  <div className="input-wrap">
                    <User size={18} className="input-icon" />
                    <input id="reg-name" type="text" name="name"
                      placeholder="Nguyễn Văn A"
                      value={form.name} onChange={handleChange} autoComplete="name" />
                    {validName && <span className="input-valid-icon"><CheckCircle size={16} color="#10b981" /></span>}
                  </div>
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>

                {/* Trường số điện thoại: checkmark khi đúng 10 chữ số. */}
                <div className="form-group">
                  <label htmlFor="reg-phone">Số điện thoại</label>
                  <div className="input-wrap">
                    <Phone size={18} className="input-icon" />
                    <input id="reg-phone" type="tel" name="phone"
                      placeholder="0912 345 678"
                      value={form.phone} onChange={handleChange} autoComplete="tel"
                      maxLength={11} />
                    {validPhone && <span className="input-valid-icon"><CheckCircle size={16} color="#10b981" /></span>}
                  </div>
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>

                {/* Trường email: checkmark khi đúng định dạng email. */}
                <div className="form-group">
                  <label htmlFor="reg-email">Email</label>
                  <div className="input-wrap">
                    <Mail size={18} className="input-icon" />
                    <input id="reg-email" type="email" name="email"
                      placeholder="example@email.com"
                      value={form.email} onChange={handleChange} autoComplete="email" />
                    {validEmail && <span className="input-valid-icon"><CheckCircle size={16} color="#10b981" /></span>}
                  </div>
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>

                {/* Trường mật khẩu với nút ẩn/hiện và thanh đo độ mạnh bên dưới.
                    Thanh chỉ hiện khi đã gõ mật khẩu, màu và % thay đổi theo điểm getStrength. */}
                <div className="form-group">
                  <label htmlFor="reg-password">Mật khẩu</label>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input id="reg-password"
                      type={showPassword ? 'text' : 'password'} name="password"
                      placeholder="Tối thiểu 6 ký tự"
                      value={form.password} onChange={handleChange}
                      autoComplete="new-password" />
                    <button type="button" className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="pwd-strength">
                      <div className="pwd-strength-bar">
                        <div className="pwd-strength-fill"
                          style={{ width: strength.pct, background: strength.color }} />
                      </div>
                      <span className="pwd-strength-text" style={{ color: strength.color }}>
                        Độ mạnh: {strength.label}
                      </span>
                    </div>
                  )}
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>

                {/* Trường xác nhận mật khẩu: checkmark xanh khi khớp với mật khẩu đã nhập. */}
                <div className="form-group">
                  <label htmlFor="reg-confirm">Xác nhận mật khẩu</label>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input id="reg-confirm"
                      type={showPassword ? 'text' : 'password'} name="confirm"
                      placeholder="Nhập lại mật khẩu"
                      value={form.confirm} onChange={handleChange}
                      autoComplete="new-password" />
                    {validConfirm && (
                      <span className="input-valid-icon"><CheckCircle size={16} color="#10b981" /></span>
                    )}
                  </div>
                  {errors.confirm && <span className="field-error">{errors.confirm}</span>}
                </div>

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                </button>
              </form>

              <p className="auth-switch">
                Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default Register;
