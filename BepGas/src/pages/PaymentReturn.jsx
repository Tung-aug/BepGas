// Trang kết quả sau khi VNPay redirect về, đọc query params để biết giao dịch thành công hay thất bại.
// Thành công: xoá dữ liệu tạm session storage, hiện thông báo và mã đơn hàng.
// Thất bại/huỷ: backend đã xoá đơn và hoàn tồn kho tự động, frontend chỉ cần
// khôi phục giỏ hàng từ backup đã lưu trước khi chuyển sang trang VNPay.

import { useEffect, useState } from 'react';

// useSearchParams để đọc các query param VNPay gửi về như ?status=success&code=00.
// useNavigate để chuyển trang khi người dùng nhấn nút thử lại hoặc về giỏ hàng.
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

// CheckCircle cho giao dịch thành công, XCircle cho thất bại.
// RotateCcw là icon thử lại, Loader là spinner trong lúc đang khôi phục giỏ hàng.
import { CheckCircle, XCircle, RotateCcw, ShoppingCart, Loader } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { cartAPI } from '../services/api';

// VNPAY_CODES ánh xạ mã lỗi từ VNPay sang thông báo tiếng Việt dễ hiểu cho người dùng.
// Mã này do VNPay định nghĩa, không phải do backend tự đặt.
const VNPAY_CODES = {
  '07': 'Giao dịch nghi ngờ gian lận.',
  '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ InternetBanking.',
  '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.',
  '11': 'Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch.',
  '12': 'Thẻ/tài khoản bị khóa.',
  '13': 'Nhập sai mật khẩu OTP. Vui lòng thực hiện lại giao dịch.',
  '24': 'Khách hàng hủy giao dịch.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản vượt hạn mức giao dịch trong ngày.',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần.',
};

const PaymentReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // fetchCart làm mới giỏ hàng trong context sau khi khôi phục từ backup.
  const { fetchCart } = useCart();

  // Đọc status và code từ query params do backend gắn vào URL redirect.
  const status    = searchParams.get('status');
  const vnpayCode = searchParams.get('code');
  const isSuccess = status === 'success';

  // Lấy mã đơn hàng đã lưu trước khi redirect sang VNPay để hiển thị lại sau khi thành công.
  // Dùng lazy initializer để chỉ đọc sessionStorage một lần khi mount, không đọc lại mỗi render.
  const [pendingOrderCode] = useState(() => sessionStorage.getItem('vnpay_pending_order_code'));

  // restoring là true khi đang chờ khôi phục giỏ hàng sau thất bại, dùng để disable các nút.
  const [restoring, setRestoring] = useState(!isSuccess);

  useEffect(() => {
    // Dọn các key tạm trong session storage vì đã không còn cần thiết sau khi về trang này.
    sessionStorage.removeItem('vnpay_pending_order_id');
    sessionStorage.removeItem('vnpay_pending_order_code');

    if (isSuccess) {
      // Thanh toán thành công: backend đã clear cart khi tạo đơn, chỉ cần xoá backup là đủ.
      sessionStorage.removeItem('vnpay_cart_backup');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoring(false);
      return;
    }

    // Thanh toán thất bại hoặc bị huỷ: backend đã DELETE đơn và hoàn tồn kho tự động.
    // Frontend chỉ cần lấy backup giỏ hàng đã lưu trước khi redirect, rồi add lại từng item.
    const restore = async () => {
      const backup = JSON.parse(sessionStorage.getItem('vnpay_cart_backup') || '[]');
      sessionStorage.removeItem('vnpay_cart_backup');

      if (backup.length > 0) {
        try {
          // Phải clear cart trước rồi mới add lại — vì cartAPI.add CỘNG DỒN vào số lượng hiện có,
          // nếu không clear trước thì số lượng sẽ bị nhân đôi.
          await cartAPI.clear();
          await Promise.allSettled(
            backup.map(i => cartAPI.add(i.productId, i.quantity))
          );
        } catch { /* bỏ qua lỗi, không làm crash trang */ }
      }

      // Làm mới giỏ hàng trong context để UI cập nhật đúng số lượng sau khi khôi phục.
      await fetchCart().catch(() => {});
      setRestoring(false);
    };

    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // failureMessage chọn thông báo phù hợp theo status và mã lỗi VNPay gửi về.
  // Ưu tiên: chữ ký không hợp lệ > lỗi hệ thống > mã lỗi VNPay biết > thông báo mặc định.
  const failureMessage =
    status === 'invalid' ? 'Chữ ký không hợp lệ. Vui lòng liên hệ hỗ trợ.' :
    status === 'error'   ? 'Lỗi hệ thống. Vui lòng liên hệ hỗ trợ.' :
    (vnpayCode && VNPAY_CODES[vnpayCode]) ? VNPAY_CODES[vnpayCode] :
    'Giao dịch bị huỷ hoặc thất bại. Vui lòng thử lại.';

  return (
    <main className="checkout-success">
      <div className="success-card">

        {/* Hiện hai giao diện khác nhau tuỳ vào kết quả giao dịch. */}
        {isSuccess ? (
          <>
            {/* Giao diện khi thanh toán thành công: icon xanh, mã đơn và nút xem đơn. */}
            <div className="success-icon"><CheckCircle size={64} color="#10b981" /></div>
            <h1>Thanh toán thành công!</h1>
            <p>Cảm ơn bạn đã mua hàng tại <strong>BếpGas</strong>.<br/>Đơn hàng đang được xử lý.</p>

            {/* Hiện mã đơn hàng nếu có lưu trong session trước khi redirect, giúp khách tra cứu. */}
            {pendingOrderCode && (
              <div className="order-code">Mã đơn hàng: <strong>{pendingOrderCode}</strong></div>
            )}
            <div className="success-btns">
              <Link to="/account" state={{ tab: 'orders' }} className="btn btn-primary">Xem đơn hàng</Link>
              <Link to="/products" className="btn btn-outline">Tiếp tục mua sắm</Link>
            </div>
          </>
        ) : (
          <>
            {/* Giao diện khi thanh toán thất bại: icon đỏ, lý do thất bại và mã lỗi VNPay. */}
            <div className="success-icon"><XCircle size={64} color="#ef4444" /></div>
            <h1 style={{ color: '#ef4444' }}>Thanh toán thất bại</h1>
            <p>{failureMessage}</p>

            {/* Hiện mã lỗi VNPay nếu mã đó nằm trong danh sách VNPAY_CODES, để khách nắm rõ nguyên nhân. */}
            {vnpayCode && VNPAY_CODES[vnpayCode] && (
              <div className="order-code" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.85rem' }}>
                Mã lỗi VNPay: <strong>{vnpayCode}</strong>
              </div>
            )}

            {/* Hai nút hành động chính: thử lại thanh toán hoặc về giỏ hàng để xem lại.
                Disable trong lúc restoring để tránh người dùng chuyển trang khi giỏ chưa khôi phục xong. */}
            <div className="payment-fail-actions">
              <button className="btn btn-primary" onClick={() => navigate('/checkout')} disabled={restoring}>
                <RotateCcw size={16}/> Thử lại thanh toán
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/cart')} disabled={restoring}>
                {restoring
                  ? <><Loader size={16} className="spin"/> Đang khôi phục giỏ hàng...</>
                  : <><ShoppingCart size={16}/> Về giỏ hàng</>}
              </button>
            </div>

            {/* Lựa chọn phụ: về trang chủ hoặc tiếp tục mua sắm dù giao dịch thất bại. */}
            <div className="success-btns" style={{ marginTop: '0.75rem' }}>
              <Link to="/" className="btn btn-ghost-sm">Về trang chủ</Link>
              <Link to="/products" className="btn btn-ghost-sm">Tiếp tục mua sắm</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default PaymentReturn;
