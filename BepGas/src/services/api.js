// Lớp giao tiếp với Backend BepGas (Spring Boot - port 8080)
// Mọi request đến API đều đi qua file này
import axios from 'axios';

// URL gốc của backend — đọc từ .env, fallback về localhost khi dev
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

// Tạo instance axios với cấu hình mặc định
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ── INTERCEPTOR REQUEST ──────────────────────────────────
// Tự động gắn JWT token vào header Authorization trước mỗi request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bepgas_token') || sessionStorage.getItem('bepgas_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── INTERCEPTOR RESPONSE ─────────────────────────────────
// Xử lý lỗi tập trung: 401 → tự đăng xuất, các lỗi khác → ném ra thông báo rõ ràng
api.interceptors.response.use(
  (response) => response.data, // Trả về trực tiếp phần data
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ → xóa cả hai storage và reload
      ['bepgas_token', 'bepgas_user'].forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
      window.location.href = '/login';
    }
    const message = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
    return Promise.reject(new Error(message));
  }
);

// ══════════════════════════════════════════════════════════
//  AUTH — Đăng nhập / Đăng ký
// ══════════════════════════════════════════════════════════
export const authAPI = {
  // POST /api/auth/login — dùng email + password
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  // POST /api/auth/register
  register: (name, phone, email, password) =>
    api.post('/auth/register', { fullName: name, phone, email, password }),
};

// ══════════════════════════════════════════════════════════
//  PRODUCTS — Sản phẩm
// ══════════════════════════════════════════════════════════
export const productAPI = {
  // GET /api/products?page=0&size=12
  getAll: (page = 0, size = 12) =>
    api.get(`/products?page=${page}&size=${size}`),

  // GET /api/products/{id}
  getById: (id) =>
    api.get(`/products/${id}`),

  // GET /api/products/slug/{slug}
  getBySlug: (slug) =>
    api.get(`/products/slug/${slug}`),

  // GET /api/products/search?keyword=...
  search: (keyword, page = 0, size = 12) =>
    api.get(`/products/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`),

  // GET /api/products/category/{categoryId}
  getByCategory: (categoryId, page = 0, size = 12) =>
    api.get(`/products/category/${categoryId}?page=${page}&size=${size}`),

  // GET /api/products/category/{categoryId}/tree — cha + toàn bộ con
  getByCategoryTree: (categoryId, page = 0, size = 200) =>
    api.get(`/products/category/${categoryId}/tree?page=${page}&size=${size}`),

  // GET /api/products/brand/{brandId}
  getByBrand: (brandId, page = 0, size = 12) =>
    api.get(`/products/brand/${brandId}?page=${page}&size=${size}`),

  // POST /api/products (ADMIN)
  create: (data) =>
    api.post('/products', data),

  // PUT /api/products/{id} (ADMIN)
  update: (id, data) =>
    api.put(`/products/${id}`, data),

  // DELETE /api/products/{id} (ADMIN)
  delete: (id) =>
    api.delete(`/products/${id}`),

  // GET /api/products/{id}/images
  getImages: (id) =>
    api.get(`/products/${id}/images`),

  // POST /api/products/{id}/images — multipart/form-data
  // timeout riêng 30s vì backend phải base64-encode rồi gửi tiếp lên ImgBB (round-trip thứ 2),
  // ảnh vài MB có thể vượt quá timeout mặc định 10s của axios gây lỗi "timeout" chung khó hiểu.
  uploadImages: (id, formData) =>
    api.post(`/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }),

  // DELETE /api/products/images/{imageId}
  deleteImage: (imageId) =>
    api.delete(`/products/images/${imageId}`),

  // PUT /api/products/images/{imageId}/primary
  setPrimaryImage: (imageId) =>
    api.put(`/products/images/${imageId}/primary`),
};

// ══════════════════════════════════════════════════════════
//  CATEGORIES — Danh mục
// ══════════════════════════════════════════════════════════
export const categoryAPI = {
  getAll:      ()          => api.get('/categories'),
  getChildren: (parentId)  => api.get(`/categories/${parentId}/children`),
};

// ══════════════════════════════════════════════════════════
//  ORDERS — Đơn hàng
// ══════════════════════════════════════════════════════════
export const orderAPI = {
  // POST /api/orders — đặt hàng
  create: (orderData) =>
    api.post('/orders', orderData),

  // GET /api/orders — đơn hàng của tôi, mới nhất trước (backend ép sort, param này là fallback)
  getMy: (page = 0, size = 20) =>
    api.get(`/orders?page=${page}&size=${size}&sort=createdAt,desc`),

  // GET /api/orders/{id} — chi tiết đơn hàng
  getById: (id) =>
    api.get(`/orders/${id}`),

  // PUT /api/orders/{id}/cancel — hủy đơn hàng (reason tùy chọn)
  cancel: (id, reason) =>
    api.put(`/orders/${id}/cancel`, reason ? { reason } : undefined),

  // POST /api/orders/{id}/return-request — khách yêu cầu hoàn trả từng sản phẩm
  // data = { reason, images: [...], items: [{ orderItemId, qty }, ...] }
  requestReturn: (id, data) =>
    api.post(`/orders/${id}/return-request`, data),
};

// ══════════════════════════════════════════════════════════
//  CART — Giỏ hàng (server-side)
// ══════════════════════════════════════════════════════════
export const cartAPI = {
  get:    ()               => api.get('/cart'),
  add:    (productId, qty) => api.post('/cart', { productId, quantity: qty }),
  update: (itemId, qty)    => api.put(`/cart/${itemId}`, { quantity: qty }),
  remove: (itemId)         => api.delete(`/cart/${itemId}`),
  clear:  ()               => api.delete('/cart'),
};

// ══════════════════════════════════════════════════════════
//  ADMIN — Quản trị (yêu cầu role ADMIN)
// ══════════════════════════════════════════════════════════
export const adminAPI = {
  // GET /api/admin/dashboard?fromDate=yyyy-MM-dd&toDate=yyyy-MM-dd
  getStats: (fromDate = '', toDate = '') => {
    const p = new URLSearchParams();
    if (fromDate) p.set('fromDate', fromDate);
    if (toDate)   p.set('toDate',   toDate);
    const qs = p.toString();
    return api.get(`/admin/dashboard${qs ? '?' + qs : ''}`);
  },

  // Chi tiết danh sách đơn đóng góp vào 1 chỉ số doanh thu — type: actual | cod-unpaid | estimated | refunded
  getRevenueDetail: (type, fromDate = '', toDate = '') => {
    const p = new URLSearchParams({ type });
    if (fromDate) p.set('fromDate', fromDate);
    if (toDate)   p.set('toDate',   toDate);
    return api.get(`/admin/dashboard/revenue-detail?${p}`);
  },

  // Top sản phẩm bán chạy từ đơn đã giao trong khoảng thời gian
  getTopProducts: (limit = 5, from = '', to = '') => {
    const p = new URLSearchParams({ limit });
    if (from) p.set('from', from);
    if (to)   p.set('to',   to);
    return api.get(`/admin/products/top-selling-orders?${p}`);
  },

  // Sản phẩm sắp hết hàng — Fix #4: từ toàn bộ DB, sort stockQty asc
  getLowStockProducts: (limit = 8, maxStock = 5) =>
    api.get(`/admin/products/low-stock?limit=${limit}&maxStock=${maxStock}`),

  // ── Sản phẩm (admin) — dùng /admin/products để thấy cả inactive/out_of_stock ──
  getProducts: (page = 0, size = 100, search = '', status = '') => {
    const params = new URLSearchParams({ page, size });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    return api.get(`/admin/products?${params}`);
  },

  createProduct: (data) =>
    api.post('/products', data),

  updateProduct: (id, data) =>
    api.put(`/products/${id}`, data),

  deleteProduct: (id) =>
    api.delete(`/products/${id}`),

  // ── Đơn hàng ──────────────────────────────────────────
  getOrders: (page = 0, size = 20, status = '', fromDate = '', toDate = '', paymentStatus = '', paymentMethod = '') => {
    const p = new URLSearchParams({ page, size });
    if (status)        p.set('status',        status);
    if (fromDate)      p.set('fromDate',      fromDate);
    if (toDate)        p.set('toDate',        toDate);
    if (paymentStatus) p.set('paymentStatus', paymentStatus);
    if (paymentMethod) p.set('paymentMethod', paymentMethod);
    return api.get(`/admin/orders?${p}`);
  },

  getOrderDetail: (id) =>
    api.get(`/admin/orders/${id}`),

  confirmPayment: (id) =>
    api.put(`/admin/orders/${id}/confirm-payment`),

  updateOrderStatus: (id, status, reason) =>
    api.put(`/admin/orders/${id}/status`, reason ? { status, reason } : { status }),

  // ── Tài khoản ──────────────────────────────────────────
  getUsers: (page = 0, size = 200) =>
    api.get(`/admin/users?page=${page}&size=${size}`),

  createUser: (data) =>
    api.post('/admin/users', data),

  updateUser: (id, data) =>
    api.put(`/admin/users/${id}`, data),

  deleteUser: (id) =>
    api.delete(`/admin/users/${id}`),

  toggleLock: (id) =>
    api.put(`/admin/users/${id}/toggle-lock`),

  // ── Đơn hàng (xóa) ───────────────────────────────────
  deleteOrder: (id) =>
    api.delete(`/admin/orders/${id}`),

  // ── Hoàn trả từng sản phẩm (theo reqCode) ─────────────
  approveReturn: (orderId, reqCode, restoreStock, refunded) =>
    api.put('/admin/returns/approve', { orderId, reqCode, restoreStock, refunded }),

  rejectReturn: (orderId, reqCode, reason) =>
    api.put('/admin/returns/reject', { orderId, reqCode, reason }),

  // Xác nhận đã hoàn tiền cho yêu cầu ĐÃ DUYỆT trước đó nhưng chưa tick hoàn tiền lúc duyệt
  confirmReturnRefund: (orderId, reqCode) =>
    api.put('/admin/returns/confirm-refund', { orderId, reqCode }),

  // ── Hủy đơn (admin) — kèm lý do ──────────────────────
  cancelOrder: (id, reason) =>
    api.put(`/admin/orders/${id}/status`, { status: 'cancelled', reason: reason || '' }),

  // ── Upload biên lai chuyển khoản hoàn tiền cho khách ──────
  // timeout riêng 30s — backend phải gửi tiếp ảnh lên ImgBB, có thể vượt 10s mặc định
  uploadRefundReceipt: (orderId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/orders/${orderId}/refund-receipt`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },

  deleteRefundReceipt: (orderId) =>
    api.delete(`/admin/orders/${orderId}/refund-receipt`),

  // Xác nhận đã hoàn tiền thủ công cho đơn bị hủy sau khi thanh toán VNPay
  confirmCancelRefund: (orderId) =>
    api.put(`/admin/orders/${orderId}/confirm-cancel-refund`),
};

// ══════════════════════════════════════════════════════════
//  BRANDS — Thương hiệu
// ══════════════════════════════════════════════════════════
export const brandAPI = {
  getAll:  (page = 0, size = 100) => api.get(`/brands?page=${page}&size=${size}`),
  create:  (data) => api.post('/brands', data),
  update:  (id, data) => api.put(`/brands/${id}`, data),
  delete:  (id) => api.delete(`/brands/${id}`),
  // Upload logo lên ImgBB (dùng lại endpoint banner) — timeout riêng 30s, xem lý do ở uploadRefundReceipt
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/banners/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
};

// ══════════════════════════════════════════════════════════
//  CATEGORIES — Danh mục (Admin CRUD)
// ══════════════════════════════════════════════════════════
export const adminCategoryAPI = {
  getAll:   ()           => api.get('/categories/all'),
  create:   (data)       => api.post('/categories', data),
  update:   (id, data)   => api.put(`/categories/${id}`, data),
  delete:   (id)         => api.delete(`/categories/${id}`),
  // items = [{id, sortOrder}, ...]
  reorder:  (items)      => api.put('/categories/reorder', items),
  // Upload icon lên ImgBB qua backend (dùng chung endpoint banner) — timeout riêng 30s
  uploadIcon: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/banners/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
};

// ══════════════════════════════════════════════════════════
//  BANNERS — Quảng cáo (Admin CRUD)
// ══════════════════════════════════════════════════════════
export const bannerAPI = {
  getActive: () => api.get('/banners'),
  getAll:    () => api.get('/banners/all'),       // admin
  create:  (data) => api.post('/banners', data),
  update:  (id, data) => api.put(`/banners/${id}`, data),
  delete:  (id) => api.delete(`/banners/${id}`),
  // Upload ảnh banner lên ImgBB qua backend — timeout riêng 30s
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/banners/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
};

// ══════════════════════════════════════════════════════════
//  COUPONS — Khuyến mãi (Admin CRUD)
// ══════════════════════════════════════════════════════════
export const couponAPI = {
  getAll:  () => api.get('/coupons'),
  create:  (data) => api.post('/coupons', data),
  update:  (id, data) => api.put(`/coupons/${id}`, data),
  delete:  (id) => api.delete(`/coupons/${id}`),
  // POST /api/coupons/validate — kiểm tra coupon, trả về số tiền giảm
  validate: (code, orderTotal) => api.post('/coupons/validate', { code, orderTotal: String(orderTotal) }),
};

// ══════════════════════════════════════════════════════════
//  REVIEWS — Đánh giá sản phẩm
// ══════════════════════════════════════════════════════════
export const reviewAPI = {
  getByProduct: (productId, page = 0, size = 100) =>
    api.get(`/reviews/product/${productId}?page=${page}&size=${size}`),
  // data = { rating, comment, imageUrl? }
  create: (productId, data) =>
    api.post(`/reviews/product/${productId}`, data),
  // Upload ảnh đính kèm review lên ImgBB — timeout riêng 30s
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/uploads/image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
  delete: (reviewId) =>
    api.delete(`/reviews/${reviewId}`),
  getMyReviewedProductIds: () =>
    api.get('/reviews/reviewed-product-ids'),

  // Admin
  adminGetAll:      (page = 0, size = 50) => api.get(`/admin/reviews?page=${page}&size=${size}`),
  adminToggleVisible: (id) => api.put(`/admin/reviews/${id}/toggle-visible`),
  adminDelete:      (id)   => api.delete(`/admin/reviews/${id}`),
  adminReply:       (id, text) => api.put(`/admin/reviews/${id}/reply`, { adminReply: text }),
};

// ══════════════════════════════════════════════════════════
//  UPLOADS — Upload ảnh cho khách hàng (đánh giá, hoàn trả)
// ══════════════════════════════════════════════════════════
export const uploadAPI = {
  // POST /api/uploads/image — yêu cầu đăng nhập, dùng cho review và return — timeout riêng 30s
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/uploads/image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
};

// ══════════════════════════════════════════════════════════
//  PAYMENT — Thanh toán
// ══════════════════════════════════════════════════════════
export const paymentAPI = {
  // POST /api/payment/vnpay/create/{orderId} → trả về URL redirect VNPay
  createVNPay: (orderId) =>
    api.post(`/payment/vnpay/create/${orderId}`),

  // GET /api/payment/status/{orderId} → kiểm tra trạng thái thanh toán
  getStatus: (orderId) =>
    api.get(`/payment/status/${orderId}`),
};

// ══════════════════════════════════════════════════════════
//  USER — Tài khoản người dùng
// ══════════════════════════════════════════════════════════
export const userAPI = {
  // GET /api/users/me — thông tin cá nhân
  getMe: () => api.get('/users/me'),

  // PUT /api/users/me — cập nhật thông tin
  updateMe: (data) => api.put('/users/me', data),

  // PUT /api/users/me/password — đổi mật khẩu
  changePassword: (data) => api.put('/users/me/password', data),
};

// ══════════════════════════════════════════════════════════
//  ADDRESSES — Địa chỉ người dùng
// ══════════════════════════════════════════════════════════
export const addressAPI = {
  // GET /api/addresses — danh sách địa chỉ của tôi
  getAll: () => api.get('/addresses'),

  // POST /api/addresses — thêm địa chỉ mới
  create: (data) => api.post('/addresses', data),

  // PUT /api/addresses/{id} — cập nhật địa chỉ
  update: (id, data) => api.put(`/addresses/${id}`, data),

  // DELETE /api/addresses/{id} — xóa địa chỉ
  delete: (id) => api.delete(`/addresses/${id}`),

  // PUT /api/addresses/{id}/default — đặt làm mặc định
  setDefault: (id) => api.put(`/addresses/${id}/default`),

  // Admin: xem địa chỉ của user cụ thể
  adminGetByUser:  (userId)              => api.get(`/admin/users/${userId}/addresses`),
  // Admin: thêm địa chỉ hộ user
  adminCreate:     (userId, data)        => api.post(`/admin/users/${userId}/addresses`, data),
  // Admin: cập nhật địa chỉ của user
  adminUpdate:     (userId, addrId, data)=> api.put(`/admin/users/${userId}/addresses/${addrId}`, data),
  // Admin: xóa địa chỉ của user
  adminDelete:     (userId, addrId)      => api.delete(`/admin/users/${userId}/addresses/${addrId}`),
  // Admin: đặt mặc định địa chỉ của user
  adminSetDefault: (userId, addrId)      => api.put(`/admin/users/${userId}/addresses/${addrId}/default`),
};

// ══════════════════════════════════════════════════════════
//  WISHLIST — Danh sách yêu thích
// ══════════════════════════════════════════════════════════
export const wishlistAPI = {
  // GET /api/wishlist
  get: () => api.get('/wishlist'),

  // POST /api/wishlist/{productId}
  add: (productId) => api.post(`/wishlist/${productId}`),

  // DELETE /api/wishlist/{productId}
  remove: (productId) => api.delete(`/wishlist/${productId}`),
};

export default api;
