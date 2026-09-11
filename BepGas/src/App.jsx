// Điểm routing trung tâm của ứng dụng BepGasVN.
// Tất cả page được lazy-load (React.lazy + Suspense) để giảm bundle tải lần đầu.
// Provider context bọc ngoài theo thứ tự: Auth → Category → Wishlist → Cart → AuthModal.
// Thứ tự này quan trọng vì Cart và Wishlist phụ thuộc vào Auth, Category phải có trước Header.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import { CategoryProvider } from './context/CategoryContext';
import { AuthModalProvider } from './context/AuthModalContext';
import { RequireAuth, RequireAdmin } from './components/RequireAuth';
import { ToastContainer } from './components/ToastContainer';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import BannerPopup from './components/BannerPopup';
import BottomNav from './components/BottomNav';
import BackToTop from './components/BackToTop';
import './index.css';

// Trang khách hàng — lazy-load để code splitting tự động theo route.
const Home          = lazy(() => import('./pages/Home'));
const Products      = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart          = lazy(() => import('./pages/Cart'));
const Login         = lazy(() => import('./pages/Login'));
const Register      = lazy(() => import('./pages/Register'));
const Checkout      = lazy(() => import('./pages/Checkout'));
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'));
const Account       = lazy(() => import('./pages/Account'));
const OrderDetail   = lazy(() => import('./pages/OrderDetail'));
const Wishlist      = lazy(() => import('./pages/Wishlist'));
const Brands        = lazy(() => import('./pages/Brands'));
const Policy        = lazy(() => import('./pages/Policy'));
const Blog          = lazy(() => import('./pages/Blog'));

// Trang quản trị — chỉ tải khi người dùng thực sự vào /admin để không làm nặng bundle khách hàng.
const AdminLayout     = lazy(() => import('./pages/admin/AdminLayout'));
const AdminLogin      = lazy(() => import('./pages/admin/AdminLogin'));
const Dashboard       = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts   = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders     = lazy(() => import('./pages/admin/AdminOrders'));
const AdminUsers      = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminBrands     = lazy(() => import('./pages/admin/AdminBrands'));
const AdminBanners    = lazy(() => import('./pages/admin/AdminBanners'));
const AdminCoupons    = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminReviews    = lazy(() => import('./pages/admin/AdminReviews'));
const AdminSales      = lazy(() => import('./pages/admin/AdminSales'));
const DashboardRevenueDetail = lazy(() => import('./pages/admin/DashboardRevenueDetail'));
const InvoicePrint          = lazy(() => import('./pages/admin/InvoicePrint'));
const ReturnReceiptPrint    = lazy(() => import('./pages/admin/ReturnReceiptPrint'));
const DashboardReport       = lazy(() => import('./pages/admin/DashboardReport'));
const ReturnReceiptClient   = lazy(() => import('./pages/ReturnReceiptClient'));

// Spinner hiển thị trong khi lazy-load page chunk đang tải về.
const PageLoader = () => (
  <div className="page-loader" aria-label="Đang tải...">
    <div className="page-loader-spinner" />
  </div>
);

const NotFound = () => (
  <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>404</div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Trang không tồn tại</h2>
    <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
    <a href="/" className="btn btn-primary">Về trang chủ</a>
  </div>
);

const MainLayout = () => (
  <div className="app">
    <ScrollToTop />
    <BannerPopup />
    <Header />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/home"               element={<Home />} />
        <Route path="/products"       element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/cart"           element={<Cart />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/checkout"       element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="/payment/return" element={<PaymentReturn />} />
        <Route path="/account"           element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/account/orders/:id" element={<RequireAuth><Suspense fallback={<PageLoader />}><OrderDetail /></Suspense></RequireAuth>} />
        <Route path="/account/orders/:id/return-receipt" element={<RequireAuth><Suspense fallback={<PageLoader />}><ReturnReceiptClient /></Suspense></RequireAuth>} />
        <Route path="/wishlist"        element={<RequireAuth><Wishlist /></RequireAuth>} />
        <Route path="/brands"         element={<Brands />} />
        <Route path="/blog"           element={<Blog />} />
        <Route path="/blog/:slug"     element={<Blog />} />
        <Route path="/policy/:slug"   element={<Policy />} />
        <Route path="/policy"         element={<Policy />} />
        <Route path="*"               element={<NotFound />} />
      </Routes>
    </Suspense>
    <Footer />
    <BottomNav />
    <BackToTop />
  </div>
);

const App = () => (
  <BrowserRouter>
    <ToastContainer />
    <AuthProvider>
      <CategoryProvider>
      <WishlistProvider>
      <CartProvider>
      <AuthModalProvider>
        <Routes>
          <Route path="/admin/login" element={
            <Suspense fallback={<PageLoader />}><AdminLogin /></Suspense>
          } />

          <Route path="/admin" element={
            <RequireAdmin>
              <Suspense fallback={<PageLoader />}><AdminLayout /></Suspense>
            </RequireAdmin>
          }>
            <Route index           element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="products"   element={<Suspense fallback={<PageLoader />}><AdminProducts /></Suspense>} />
            <Route path="orders"     element={<Suspense fallback={<PageLoader />}><AdminOrders /></Suspense>} />
            <Route path="users"      element={<Suspense fallback={<PageLoader />}><AdminUsers /></Suspense>} />
            <Route path="categories" element={<Suspense fallback={<PageLoader />}><AdminCategories /></Suspense>} />
            <Route path="brands"     element={<Suspense fallback={<PageLoader />}><AdminBrands /></Suspense>} />
            <Route path="banners"    element={<Suspense fallback={<PageLoader />}><AdminBanners /></Suspense>} />
            <Route path="coupons"    element={<Suspense fallback={<PageLoader />}><AdminCoupons /></Suspense>} />
            <Route path="reviews"    element={<Suspense fallback={<PageLoader />}><AdminReviews /></Suspense>} />
            <Route path="sales"      element={<Suspense fallback={<PageLoader />}><AdminSales /></Suspense>} />
            <Route path="dashboard/revenue-detail" element={<Suspense fallback={<PageLoader />}><DashboardRevenueDetail /></Suspense>} />
          </Route>

          <Route path="/admin/orders/:id/invoice" element={
            <RequireAdmin>
              <Suspense fallback={<PageLoader />}><InvoicePrint /></Suspense>
            </RequireAdmin>
          } />
          <Route path="/admin/orders/:id/return-receipt" element={
            <RequireAdmin>
              <Suspense fallback={<PageLoader />}><ReturnReceiptPrint /></Suspense>
            </RequireAdmin>
          } />
          <Route path="/admin/dashboard/report" element={
            <RequireAdmin>
              <Suspense fallback={<PageLoader />}><DashboardReport /></Suspense>
            </RequireAdmin>
          } />

          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </AuthModalProvider>
      </CartProvider>
      </WishlistProvider>
      </CategoryProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
