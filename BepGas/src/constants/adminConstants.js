// Hằng số dùng chung cho toàn bộ trang Admin

// Màu text đã chọn đạt contrast ≥ 4.5:1 theo WCAG AA
export const ORDER_STATUS_CONFIG = {
  pending:         { label: 'Chờ xử lý',      color: '#b45309', bg: '#fef9c3' },
  confirmed:       { label: 'Đã xác nhận',    color: '#5b21b6', bg: '#ede9fe' },
  shipping:        { label: 'Đang giao',       color: '#0369a1', bg: '#e0f2fe' },
  delivered:       { label: 'Đã giao',         color: '#065f46', bg: '#d1fae5' },
  delivery_failed: { label: 'Giao thất bại',   color: '#be185d', bg: '#fce7f3' },
  cancelled:       { label: 'Đã huỷ',          color: '#991b1b', bg: '#fee2e2' },
  return_pending:  { label: 'Chờ duyệt hoàn trả',    color: '#9a3412', bg: '#fff7ed' },
  returned:        { label: 'Đã hoàn trả',     color: '#374151', bg: '#f3f4f6' },
};

// Trạng thái tiếp theo hợp lệ (admin quick-select) — phải khớp VALID_TRANSITIONS ở backend.
// return_pending → chỉ xử lý qua nút Chấp nhận/Từ chối trong modal chi tiết.
export const NEXT_STATUS = {
  pending:         ['confirmed', 'cancelled'],
  confirmed:       ['shipping',  'cancelled'],
  shipping:        ['delivered', 'delivery_failed'],
  delivery_failed: ['shipping',  'cancelled'],
  delivered:       [],
  cancelled:       [],
  return_pending:  [],
  returned:        [],
};

export const PAY_METHOD_LABEL = {
  cod:   'COD',
  vnpay: 'VNPay',
};

export const PAY_STATUS_CONFIG = {
  unpaid:             { label: 'Chưa thanh toán',  color: '#dc2626' },
  paid:               { label: 'Đã thanh toán',    color: '#10b981' },
  refund_pending:     { label: 'Chờ hoàn tiền',    color: '#f97316' },
  refunded:           { label: 'Đã hoàn',          color: '#6b7280' },
  partially_refunded: { label: 'Đã hoàn 1 phần',  color: '#f59e0b' },
};

export const PRODUCT_STATUS_MAP = {
  active:       { label: 'Đang bán',  cls: 'badge-green' },
  inactive:     { label: 'Ngừng bán', cls: 'badge-gray'  },
  out_of_stock: { label: 'Hết hàng',  cls: 'badge-red'   },
};