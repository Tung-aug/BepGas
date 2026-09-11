/**
 * Singleton Toast Emitter
 * Gọi được từ bất kỳ đâu — kể cả Context, util, không cần React
 *
 * Usage:
 *   import { toast } from '../utils/toast';
 *   toast.success('Đã thêm vào giỏ hàng!');
 *   toast.error('Sản phẩm không đủ tồn kho');
 *   toast.warn('Vui lòng nhập tên sản phẩm');
 *   toast.info('Đang xử lý...');
 */

let _id = 0;
let _listeners = [];

const _emit = (toast) => {
  const t = { ...toast, id: ++_id };
  _listeners.forEach(fn => fn(t));
};

export const toast = {
  success: (msg, duration = 3000) => _emit({ type: 'success', msg, duration }),
  error:   (msg, duration = 4000) => _emit({ type: 'error',   msg, duration }),
  warn:    (msg, duration = 3500) => _emit({ type: 'warn',    msg, duration }),
  info:    (msg, duration = 3000) => _emit({ type: 'info',    msg, duration }),
};

/** Nội bộ — dùng bởi ToastContainer */
export const _subscribe = (fn) => {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
};