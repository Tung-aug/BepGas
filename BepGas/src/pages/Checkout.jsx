// Trang thanh toán 3 bước: Thông tin giao hàng → Phương thức thanh toán → Xác nhận đơn.
// checkoutItems nhận từ navigate state (Cart.jsx) hoặc sessionStorage nếu người dùng reload trang.
// VNPay: lưu backup giỏ hàng vào sessionStorage trước khi redirect — PaymentReturn.jsx sẽ khôi phục nếu thất bại.
// Coupon được revalidate ngay khi vào trang để tránh dùng mã đã hết hạn hoặc vượt giới hạn lượt dùng.
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Phone, User, ChevronRight, CreditCard, Truck, CheckCircle, ArrowLeft,
         ShoppingBag, Loader, Tag, Wrench, X, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderAPI, paymentAPI, couponAPI, addressAPI } from '../services/api';
import { provinces } from '../constants/provinces';
import WardCombobox from '../components/WardCombobox';
import { fmt } from '../utils/formatters';
import ProvinceCombobox from '../components/ProvinceCombobox';

const INSTALLATION_FEE = 150000;
const STEPS = ['Thông tin', 'Thanh toán', 'Xác nhận'];

const Checkout = () => {
  const { items: allCartItems, fetchCart } = useCart();
  const { user } = useAuth();
  const location  = useLocation();

  /* Bug #3: Khôi phục checkoutItems từ sessionStorage nếu mất state (reload / link trực tiếp) */
  const _checkoutItems = location.state?.checkoutItems ?? (() => {
    try {
      const backup = JSON.parse(sessionStorage.getItem('checkout_items') ?? 'null');
      return Array.isArray(backup) && backup.length > 0 ? backup : null;
    } catch { return null; }
  })() ?? null;

  /* Nếu checkoutItems là một phần giỏ — dùng nó; nếu không dùng toàn bộ */
  const items = _checkoutItems ?? allCartItems;

  /* Tổng tiền tính lại từ items thực tế được chọn */
  const totalPrice = items.reduce((s, i) => s + Number(i.price ?? 0) * i.quantity, 0);

  /* Coupon có thể được truyền sang từ trang Giỏ hàng qua navigate state */
  const _initCode     = location.state?.couponCode     || '';
  const _initDiscount = location.state?.couponDiscount || 0;

  const [step,      setStep]      = useState(0);
  const [info,      setInfo]      = useState({ name: user?.name||'', phone: user?.phone||'', province: '', commune: '', address: '', note: '' });
  const [payMethod, setPayMethod] = useState('cod');
  const [errors,    setErrors]    = useState({});
  const [orderCode, setOrderCode] = useState('');
  const [orderId,     setOrderId]     = useState(null);
  const [vnpayLoading, setVnpayLoading] = useState(false);
  const [placing,   setPlacing]   = useState(false);

  /* Lắp đặt: mặc định bật cho tất cả sản phẩm cần lắp đặt, khách có thể tắt */
  const itemKey = (i) => `${i.productId}-${i.variantId ?? ''}`;
  const [installOpt, setInstallOpt] = useState(
    () => new Set(items.filter(i => i.requiresInstallation).map(itemKey))
  );
  const toggleInstall = (i) => setInstallOpt(prev => {
    const next = new Set(prev);
    next.has(itemKey(i)) ? next.delete(itemKey(i)) : next.add(itemKey(i));
    return next;
  });

  const [savedAddrs,     setSavedAddrs]     = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [addrLoaded,     setAddrLoaded]     = useState(false);
  const [addrLoading,    setAddrLoading]    = useState(false);

  /* Khớp city (địa chỉ cũ) → tên tỉnh mới trong dropdown */
  const matchProvince = (city = '') => {
    const c = city.trim().toLowerCase();
    if (!c) return '';
    const exact = provinces.find(p => p.toLowerCase() === c);
    if (exact) return exact;
    const partial = provinces.find(p =>
      c.includes(p.toLowerCase()) || p.toLowerCase().includes(c)
    );
    if (partial) return partial;
    const LEGACY = {
      'bình dương': 'Hồ Chí Minh', 'bà rịa': 'Hồ Chí Minh', 'vũng tàu': 'Hồ Chí Minh',
      'bà rịa - vũng tàu': 'Hồ Chí Minh', 'tp. hồ chí minh': 'Hồ Chí Minh', 'tp hcm': 'Hồ Chí Minh',
      'hải dương': 'Hải Phòng', 'bắc giang': 'Bắc Ninh', 'thái bình': 'Hưng Yên',
      'hà nam': 'Ninh Bình', 'nam định': 'Ninh Bình',
      'vĩnh phúc': 'Phú Thọ', 'hòa bình': 'Phú Thọ',
      'hà giang': 'Tuyên Quang', 'yên bái': 'Lào Cai', 'bắc kạn': 'Thái Nguyên',
      'quảng bình': 'Quảng Trị', 'quảng nam': 'Đà Nẵng',
      'bình định': 'Gia Lai', 'kon tum': 'Gia Lai',
      'phú yên': 'Đắk Lắk', 'đắk nông': 'Lâm Đồng', 'bình thuận': 'Lâm Đồng',
      'ninh thuận': 'Khánh Hòa', 'bình phước': 'Đồng Nai',
      'long an': 'Tây Ninh', 'hậu giang': 'Cần Thơ', 'sóc trăng': 'Cần Thơ',
      'kiên giang': 'An Giang', 'bến tre': 'Vĩnh Long', 'trà vinh': 'Vĩnh Long',
      'tiền giang': 'Đồng Tháp', 'bạc liêu': 'Cà Mau',
      'thừa thiên huế': 'Huế', 'thừa thiên - huế': 'Huế',
    };
    return LEGACY[c] ?? '';
  };

  /* Load địa chỉ đã lưu, tự điền mặc định */
  useEffect(() => {
    if (!user || addrLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddrLoaded(true);
    setAddrLoading(true);
    addressAPI.getAll()
      .then(res => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setSavedAddrs(list);
        const def = list.find(a => a.isDefault) ?? list[0];
        if (def) {
          setSelectedAddrId(def.addressId ?? def.id);
          setInfo(prev => ({
            ...prev,
            name:     def.fullName    ?? prev.name,
            phone:    def.phone       ?? prev.phone,
            address:  def.addressLine ?? '',
            commune:  def.ward        ?? def.district ?? '',
            province: matchProvince(def.city ?? ''),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setAddrLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const applyAddr = (a) => {
    setSelectedAddrId(a.addressId ?? a.id);
    setInfo(prev => ({
      ...prev,
      name:     a.fullName    ?? prev.name,
      phone:    a.phone       ?? prev.phone,
      address:  a.addressLine ?? '',
      commune:  a.ward        ?? a.district ?? '',
      province: matchProvince(a.city ?? ''),
    }));
  };

  /* Auto-dismiss lỗi đặt hàng sau 7 giây */
  useEffect(() => {
    if (!errors.submit) return;
    const t = setTimeout(() => setErrors(e => ({ ...e, submit: '' })), 7000);
    return () => clearTimeout(t);
  }, [errors.submit]);

  // Coupon — khởi tạo từ state truyền qua từ trang Giỏ hàng (nếu có)
  const [couponInput,    setCouponInput]    = useState(_initCode);
  const [couponApplied,  setCouponApplied]  = useState(_initCode);
  const [couponDiscount, setCouponDiscount] = useState(_initDiscount);
  const [couponLoading,  setCouponLoading]  = useState(false);
  const [couponError,    setCouponError]    = useState('');

  /* Bug #2: Revalidate coupon ngay khi vào trang — phòng giá/số lượng thay đổi */
  useEffect(() => {
    if (!_initCode || !totalPrice) return;
    couponAPI.validate(_initCode, totalPrice)
      .then(res => {
        const discount = Number(res?.data ?? 0);
        setCouponDiscount(discount);
        setCouponApplied(_initCode);
      })
      .catch(() => {
        // Coupon không còn hợp lệ — gỡ nhẹ không báo lỗi to
        setCouponDiscount(0);
        setCouponApplied('');
        setCouponInput('');
        setCouponError('Mã giảm giá không còn áp dụng được, vui lòng kiểm tra lại.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tính phí
  const installItems    = items.filter(i => i.requiresInstallation && installOpt.has(itemKey(i)));
  const installationFee = installItems.reduce((sum, i) => sum + (i.installationFee ?? INSTALLATION_FEE), 0);
  const shipping                = totalPrice >= 500000 ? 0 : 30000;
  const effectiveCouponDiscount = Math.min(couponDiscount, totalPrice);
  const finalTotal              = totalPrice - effectiveCouponDiscount + shipping + installationFee;

  if (items.length === 0 && step !== 2) return (
    <main className="container cart-empty">
      <ShoppingBag size={72} color="#d1d5db" />
      <h2>Giỏ hàng trống</h2>
      <p>Vui lòng thêm sản phẩm trước khi thanh toán</p>
      <Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>
    </main>
  );

  const validateInfo = () => {
    const e = {};
    if (!info.name.trim())   e.name    = 'Vui lòng nhập họ tên.';
    if (!info.phone.trim())  e.phone   = 'Vui lòng nhập số điện thoại.';
    else if (!/^0[3-9]\d{8}$/.test(info.phone.replace(/[\s.\-]/g, ''))) e.phone = 'Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số).';
    if (!info.province)      e.province = 'Vui lòng chọn tỉnh/thành phố.';
    if (!info.address.trim()) e.address = 'Vui lòng nhập địa chỉ cụ thể.';
    return e;
  };

  const handleNextStep = () => {
    if (step === 0) {
      const e = validateInfo();
      if (Object.keys(e).length) { setErrors(e); return; }
      setErrors({});
    }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res      = await couponAPI.validate(couponInput.trim(), totalPrice);
      const discount = Number(res?.data ?? 0);
      setCouponDiscount(discount);
      setCouponApplied(couponInput.trim());
      setCouponError('');
    } catch (err) {
      setCouponError(err.message || 'Mã giảm giá không hợp lệ');
      setCouponDiscount(0);
      setCouponApplied('');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput('');
    setCouponApplied('');
    setCouponDiscount(0);
    setCouponError('');
  };

  // COD: tạo đơn xong thì chuyển sang step 2 (màn hình xác nhận).
  // VNPay: tạo đơn → lấy URL thanh toán → redirect. Lưu backup giỏ hàng trước khi redirect
  // để PaymentReturn.jsx có thể khôi phục lại giỏ nếu thanh toán thất bại hoặc người dùng quay lại.
  const handlePlaceOrder = async () => {
    setPlacing(true);
    try {
      // Lưu backup cart chỉ khi chọn VNPay (cần khôi phục nếu thất bại)
      if (payMethod === 'vnpay') {
        sessionStorage.setItem('vnpay_cart_backup', JSON.stringify(
          items.map(({ productId, quantity, variantId }) => ({
            productId, quantity, variantId: variantId ?? null,
          }))
        ));
      }

      const payload = {
        subtotal:        totalPrice,
        shippingFee:     shipping,
        discountAmount:  effectiveCouponDiscount,
        installationFee: installationFee,
        totalAmount:     finalTotal,
        couponCode:      couponApplied || null,
        paymentMethod:   payMethod === 'vnpay' ? 'vnpay' : 'cod',
        shippingName:    info.name,
        shippingPhone:   info.phone.replace(/[\s.-]/g, ''),
        shippingAddress: [info.address, info.commune, info.province].filter(Boolean).join(', '),
        note:            info.note,
        items: items.map(item => ({
          productId:            item.productId,
          variantId:            item.variantId ?? null,
          productName:          item.name,
          productImage:         item.image ?? '',
          variantName:          item.variantName ?? '',
          quantity:             item.quantity,
          unitPrice:            item.price,
          requiresInstallation: item.requiresInstallation ?? false,
        })),
      };

      const res     = await orderAPI.create(payload);
      const order   = res?.data ?? res;
      const code    = order?.orderCode ?? order?.code ?? '';
      const orderId = order?.orderId ?? order?.id;

      // VNPay → lấy URL và redirect
      if (payMethod === 'vnpay') {
        if (!orderId) throw new Error('Server không trả về mã đơn hàng. Vui lòng thử lại.');
        setVnpayLoading(true); // hiện overlay "Đang chuyển sang VNPay"
        const payRes = await paymentAPI.createVNPay(orderId);
        const payUrl = typeof payRes === 'string' ? payRes
          : payRes?.data ?? payRes?.url ?? payRes?.paymentUrl ?? null;
        if (!payUrl || typeof payUrl !== 'string') {
          setVnpayLoading(false);
          throw new Error('Không lấy được URL thanh toán VNPay. Vui lòng thử lại.');
        }
        sessionStorage.setItem('vnpay_pending_order_id',   String(orderId));
        sessionStorage.setItem('vnpay_pending_order_code', code || '');
        sessionStorage.removeItem('checkout_items');
        window.location.href = payUrl;
        return;
      }

      // COD → hiện màn hình thành công
      setOrderCode(code);
      setOrderId(orderId);
      // Bug #1: backend đã xóa đúng item đã order → sync lại từ server thay vì clearCart()
      await fetchCart().catch(() => {});
      sessionStorage.removeItem('checkout_items');
      setStep(2);
      window.scrollTo(0, 0);
    } catch (err) {
      const msg = err.message || 'Đặt hàng thất bại';
      const friendly = msg.includes('tồn kho') ? msg
        : msg.includes('401') || msg.includes('đăng nhập') ? 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.'
        : msg.includes('sản phẩm') ? msg
        : msg.includes('coupon') || msg.includes('Coupon') ? msg + ' Vui lòng bỏ mã giảm giá và thử lại.'
        : 'Đặt hàng thất bại. Vui lòng thử lại.';
      setErrors({ submit: friendly });
      // Mã giảm giá vừa hết lượt giữa lúc đặt hàng — gỡ mã khỏi UI để khách đặt lại không bị lặp lỗi
      if (msg.includes('coupon') || msg.includes('Coupon')) {
        setCouponApplied(''); setCouponDiscount(0); setCouponInput('');
      }
      window.scrollTo(0, 0);
    } finally {
      setPlacing(false);
    }
  };

  if (step === 2) return (
    <main className="checkout-success">
      <div className="success-card">
        <div className="success-icon"><CheckCircle size={64} color="#10b981" /></div>
        <h1>Đặt hàng thành công!</h1>
        <p>Cảm ơn bạn đã mua hàng tại <strong>BếpGas</strong>.<br />Đơn hàng đang được xử lý.</p>
        <div className="order-code">Mã đơn hàng: <strong>{orderCode || 'Đang cập nhật...'}</strong></div>
        <div className="success-info">
          <div><MapPin size={16} /><span>{[info.address, info.commune, info.province].filter(Boolean).join(', ')}</span></div>
          <div><Phone size={16} /><span>{info.phone.replace(/[\s.-]/g, '')}</span></div>
          <div><Truck size={16} /><span>{payMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Đã thanh toán qua VNPay'}</span></div>
          <div><CheckCircle size={16} color="#10b981" /><span>Tổng thanh toán: <strong style={{ color: 'var(--primary)' }}>{fmt(finalTotal)}</strong></span></div>
        </div>
        <div className="success-btns">
          {orderId
            ? <Link to={`/account/orders/${orderId}`} className="btn btn-primary">Xem chi tiết đơn hàng</Link>
            : <Link to="/account" state={{ tab: 'orders' }} className="btn btn-primary">Xem đơn hàng</Link>
          }
          <Link to="/products" className="btn btn-outline">Tiếp tục mua sắm</Link>
        </div>
      </div>
    </main>
  );

  /* VNPay redirect overlay */
  if (vnpayLoading) return (
    <div className="vnpay-redirect-overlay">
      <div className="vnpay-redirect-card">
        <Loader size={40} className="spin" color="#0066B3"/>
        <h3>Đang chuyển đến VNPay...</h3>
        <p>Vui lòng không tắt trang hoặc bấm nút quay lại</p>
      </div>
    </div>
  );

  return (
    <main className="checkout-page">
      {errors.submit && (
        <div className="checkout-toast-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{errors.submit}</span>
          <button
            onClick={() => setErrors(e => ({ ...e, submit: '' }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 2, flexShrink: 0 }}
          ><X size={16}/></button>
        </div>
      )}
      <div className="container">
        {/* Mobile: hiện label bước hiện tại thay vì chỉ số */}
        <div className="checkout-step-indicator">
          Bước {step + 1}/{STEPS.length}: <strong>{STEPS[step]}</strong>
        </div>
        <div className="checkout-steps">
          {STEPS.map((label, i) => (
            <div key={i} className={`checkout-step ${i <= step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="step-circle">{i < step ? '✓' : i + 1}</div>
              <span>{label}</span>
              {i < STEPS.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>

        <div className="checkout-layout">
          <div className="checkout-main">
            {/* Bước 0: Thông tin */}
            {step === 0 && (
              <div className="checkout-card">
                <h2><MapPin size={20} /> Thông tin giao hàng</h2>

                {addrLoading && (
                  <div className="saved-addr-loading">
                    <Loader size={14} className="spin"/> Đang tải địa chỉ đã lưu...
                  </div>
                )}
                {!addrLoading && savedAddrs.length > 0 && (
                  <div className="saved-addr-section">
                    <div className="saved-addr-label">📍 Địa chỉ đã lưu</div>
                    <div className="saved-addr-list">
                      {savedAddrs.map(a => {
                        const aid = a.addressId ?? a.id;
                        const sel = selectedAddrId === aid;
                        return (
                          <button key={aid} type="button"
                            className={`saved-addr-chip${sel ? ' sac-selected' : ''}`}
                            onClick={() => applyAddr(a)}
                          >
                            {a.isDefault && <span className="sac-badge">Mặc định</span>}
                            <div className="sac-name">{a.fullName}</div>
                            <div className="sac-detail">{a.addressLine}{a.district ? `, ${a.district}` : ''}</div>
                            <div className="sac-city">{a.city}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="saved-addr-divider">hoặc nhập địa chỉ mới bên dưới</div>
                  </div>
                )}

                <div className="checkout-form">
                  <div className="form-group">
                    <label>Họ và tên <span className="required">*</span></label>
                    <div className={`input-wrap${errors.name ? ' input-wrap-error' : ''}`}>
                      <User size={17} className="input-icon" />
                      <input type="text" placeholder="Nguyễn Văn A" value={info.name}
                        onChange={e => { setInfo({...info, name: e.target.value}); if (errors.name) setErrors(p => ({...p, name: ''})); }} />
                    </div>
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại <span className="required">*</span></label>
                    <div className={`input-wrap${errors.phone ? ' input-wrap-error' : ''}`}>
                      <Phone size={17} className="input-icon" />
                      <input type="tel" placeholder="0912 345 678" value={info.phone}
                        onChange={e => { setInfo({...info, phone: e.target.value}); if (errors.phone) setErrors(p => ({...p, phone: ''})); }} />
                    </div>
                    {errors.phone && <span className="field-error">{errors.phone}</span>}
                  </div>
                  <div className="form-group">
                    <label>Tỉnh / Thành phố <span className="required">*</span></label>
                    <ProvinceCombobox
                      value={info.province}
                      onChange={p => { setInfo({ ...info, province: p }); setSelectedAddrId(null); }}
                      className={errors.province ? 'input-error' : ''}
                    />
                    {errors.province && <span className="field-error">{errors.province}</span>}
                  </div>
                  <div className="form-group">
                    <label>Phường / Xã / Thị trấn</label>
                    <WardCombobox
                      province={info.province}
                      value={info.commune}
                      onChange={v => setInfo({ ...info, commune: v })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Số nhà, tên đường <span className="required">*</span></label>
                    <div className={`input-wrap${errors.address ? ' input-wrap-error' : ''}`}>
                      <MapPin size={17} className="input-icon" />
                      <input type="text" placeholder="VD: 123 Đường Nguyễn Huệ" value={info.address}
                        onChange={e => { setInfo({ ...info, address: e.target.value }); if (errors.address) setErrors(p => ({...p, address: ''})); }} />
                    </div>
                    {errors.address && <span className="field-error">{errors.address}</span>}
                  </div>
                  <div className="form-group full-width">
                    <label>Ghi chú đơn hàng</label>
                    <textarea placeholder="Ghi chú cho người giao hàng (không bắt buộc)" value={info.note} onChange={e => setInfo({...info, note: e.target.value})} rows={3} />
                  </div>
                </div>
              </div>
            )}

            {/* Bước 1: Thanh toán */}
            {step === 1 && (
              <div className="checkout-card">
                <h2><CreditCard size={20} /> Phương thức thanh toán</h2>
                <div className="pay-methods">
                  {[
                    { id: 'cod',   icon: <Truck size={24}/>, title: 'Thanh toán khi nhận hàng (COD)', sub: 'Trả tiền mặt khi nhận được hàng' },
                    { id: 'vnpay', icon: <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#0066B3',color:'#fff',fontWeight:900,fontSize:'12px',letterSpacing:'1.5px',padding:'2px 10px',borderRadius:'4px',height:24,boxSizing:'border-box',flexShrink:0}}>VNPAY</span>, title: 'Thanh toán qua VNPay', sub: 'ATM nội địa • Thẻ quốc tế • QR Code' },
                  ].map(m => (
                    <label key={m.id} className={`pay-option ${payMethod === m.id ? 'pay-selected' : ''}`}>
                      <input type="radio" name="pay" value={m.id} checked={payMethod === m.id} onChange={() => setPayMethod(m.id)} />
                      <div className={`pay-icon ${m.id}`}>{m.icon}</div>
                      <div className="pay-info"><strong>{m.title}</strong><span>{m.sub}</span></div>
                      {payMethod === m.id && <CheckCircle size={20} color="#10b981" className="pay-check" />}
                    </label>
                  ))}
                </div>

                <div className="delivery-summary">
                  <h4>Giao đến</h4>
                  <p><User size={15} /> {info.name} — {info.phone}</p>
                  <p><MapPin size={15} /> {[info.address, info.commune, info.province].filter(Boolean).join(', ')}</p>
                  {info.note && <p>📝 {info.note}</p>}
                  <button className="change-address" onClick={() => setStep(0)}>Thay đổi địa chỉ</button>
                </div>
              </div>
            )}

            <div className="checkout-nav">
              {step > 0
                ? <button className="btn btn-outline" onClick={() => setStep(s => s-1)}><ArrowLeft size={16}/> Quay lại</button>
                : <Link to="/cart" className="btn btn-outline"><ArrowLeft size={16}/> Giỏ hàng</Link>}
              {step < 1
                ? <button className="btn btn-primary" onClick={handleNextStep}>Tiếp tục <ChevronRight size={16}/></button>
                : <button className="btn btn-primary btn-order" onClick={handlePlaceOrder} disabled={placing}>
                    {placing ? <Loader size={18} className="spin" /> : <CheckCircle size={18}/>}
                    {placing ? 'Đang xử lý...' : `Đặt hàng (${fmt(finalTotal)})`}
                  </button>}
            </div>
          </div>

          {/* Tóm tắt đơn hàng */}
          <div className="checkout-summary">
            <h3>Đơn hàng ({items.length} sản phẩm)</h3>
            <div className="summary-items">
              {items.map(item => (
                <div key={`${item.id}-${item.variantId ?? ''}`} className="summary-item">
                  <div className="summary-item-img">
                    {item.image ? <img src={item.image} alt={item.name} /> : <ShoppingBag size={24} color="#d1d5db" />}
                    <span className="summary-qty">{item.quantity}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="summary-item-name">{item.name}</span>
                    {item.variantName && <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{item.variantName}</div>}
                    {item.requiresInstallation && (
                      <label className="ck-install-toggle" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={installOpt.has(itemKey(item))}
                          onChange={() => toggleInstall(item)}
                        />
                        <Wrench size={11}/>
                        <span>Lắp đặt (+{fmt(item.installationFee ?? INSTALLATION_FEE)})</span>
                      </label>
                    )}
                  </div>
                  <span className="summary-item-price">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <hr className="summary-divider" />
            <div className="coupon-section">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Tag size={15} color="var(--primary)" /> Mã giảm giá
              </label>
              {couponApplied ? (
                <div className="coupon-applied">
                  <span><Tag size={13}/> <strong>{couponApplied}</strong> — Giảm {fmt(effectiveCouponDiscount)}</span>
                  <button onClick={handleRemoveCoupon}><X size={14}/></button>
                </div>
              ) : (
                <div className="coupon-input-row">
                  <input type="text" placeholder="Nhập mã giảm giá" value={couponInput}
                    onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                  />
                  <button onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}>
                    {couponLoading ? <Loader size={14} className="spin"/> : 'Áp dụng'}
                  </button>
                </div>
              )}
              {couponError && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '0.3rem' }}>{couponError}</p>}
            </div>

            <hr className="summary-divider" />

            {/* Tổng tiền hàng (đã theo giá sale) */}
            <div className="summary-row"><span>Tổng tiền hàng</span><span>{fmt(totalPrice)}</span></div>

            {/* Voucher: tên trên 1 dòng, số giảm + mô tả trên dòng kế */}
            {effectiveCouponDiscount > 0 && (
              <>
                <div className="summary-row summary-voucher-name">
                  <span><Tag size={12}/> <strong>{couponApplied}</strong></span>
                </div>
                <div className="summary-row" style={{ color: '#10b981' }}>
                  <span style={{ paddingLeft: '1.1rem' }}>Voucher</span>
                  <span>-{fmt(effectiveCouponDiscount)}</span>
                </div>
                <hr className="summary-mini-divider"/>
                <div className="summary-row summary-after-discount">
                  <span>Tiền hàng sau giảm</span>
                  <span>{fmt(totalPrice - effectiveCouponDiscount)}</span>
                </div>
              </>
            )}

            {/* Phí lắp đặt */}
            {items.some(i => i.requiresInstallation) && (
              <div className="summary-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: installationFee > 0 ? 'inherit' : 'var(--text-light)' }}>
                  <Wrench size={13}/> Phí lắp đặt {installItems.length > 0 ? `(${installItems.length} sp)` : '(không dùng)'}
                </span>
                <span style={{ color: installationFee > 0 ? 'inherit' : 'var(--text-light)' }}>
                  {installationFee > 0 ? fmt(installationFee) : '0 đ'}
                </span>
              </div>
            )}

            {/* Phí vận chuyển */}
            <div className="summary-row">
              <span>Phí vận chuyển</span>
              <span className={shipping === 0 ? 'free-shipping' : ''}>
                {shipping === 0 ? 'Miễn phí' : fmt(shipping)}
              </span>
            </div>
            {shipping > 0 && <p className="shipping-note">Mua thêm {fmt(500000 - totalPrice)} để miễn phí ship</p>}

            <hr className="summary-divider" />
            <div className="summary-total"><span>Thành tiền</span><span>{fmt(finalTotal)}</span></div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Checkout;