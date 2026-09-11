// Context quản lý giỏ hàng với optimistic update — badge số lượng nhảy ngay, không chờ API phản hồi.
// Khi người dùng chưa đăng nhập, giỏ hàng lưu vào localStorage (GUEST_KEY).
// Sau khi đăng nhập, giỏ hàng guest được merge vào giỏ tài khoản rồi xóa khỏi localStorage.
// Cross-tab sync: khi tab khác thêm/xóa hàng, tab này tự cập nhật qua storage event.
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { toast } from '../utils/toast';

const GUEST_KEY = 'bepgas_cart';
const CartContext = createContext();

// Chuẩn hóa CartItem từ backend về shape thống nhất dùng trong toàn bộ frontend.
const normalize = (item) => {
  const p   = item.product ?? {};
  const img = p.images?.find(i => i.isPrimary)?.imageUrl
           ?? p.images?.[0]?.imageUrl
           ?? p.productImage ?? '';
  const origPrice = Number(p.price ?? 0);
  const salePrice = p.salePrice != null ? Number(p.salePrice) : origPrice;
  return {
    id:                   item.id,
    productId:            p.id ?? item.productId,
    name:                 p.productName ?? p.name ?? '',
    image:                img,
    price:                salePrice,
    originalPrice:        origPrice,
    quantity:             item.quantity ?? 1,
    slug:                 p.slug ?? '',
    variantId:            item.variantId   ?? null,
    variantName:          item.variantName ?? '',
    stockQty:             p.stockQty ?? 999,
    requiresInstallation: p.requiresInstallation ?? false,
  };
};

// Helper đọc/ghi/xóa giỏ hàng khách chưa đăng nhập trong localStorage.
const loadGuest  = () => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY))?.items ?? []; }
  catch { return []; }
};
const saveGuest  = (items) =>
  localStorage.setItem(GUEST_KEY, JSON.stringify({ items }));
const clearGuest = () => localStorage.removeItem(GUEST_KEY);

export const CartProvider = ({ children }) => {
  const { isLoggedIn } = useAuth();

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);

  const prevLoggedIn   = useRef(isLoggedIn);
  const updateTimers   = useRef({});   // debounce timers cho updateQuantity

  // Fetch toàn bộ giỏ từ backend — dùng sau addItem để lấy cartItemId thật, và khi rollback.
  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await cartAPI.get();
      const raw  = res?.data ?? res ?? [];
      const list = Array.isArray(raw) ? raw : (raw.items ?? raw.content ?? []);
      setItems(list.map(normalize));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Xử lý khi trạng thái đăng nhập thay đổi ─────────── */
  useEffect(() => {
    const wasLoggedIn    = prevLoggedIn.current;
    prevLoggedIn.current = isLoggedIn;

    if (isLoggedIn && !wasLoggedIn) {
      /* Vừa đăng nhập → merge guest cart rồi fetch
       * Chỉ thêm sản phẩm chưa có trong giỏ tài khoản — tránh cộng dồn số lượng */
      const mergeAndFetch = async () => {
        const guestItems = loadGuest();
        if (guestItems.length > 0) {
          // Lấy danh sách productId đang có trong giỏ tài khoản
          let existingProductIds = new Set();
          try {
            const res  = await cartAPI.get();
            const raw  = res?.data ?? res ?? [];
            const list = Array.isArray(raw) ? raw : (raw.items ?? raw.content ?? []);
            existingProductIds = new Set(
              list.map(i => i.product?.id ?? i.productId).filter(Boolean)
            );
          } catch { /* nếu fetch lỗi, thêm tất cả guest items */ }

          for (const item of guestItems) {
            const pid = item.productId ?? item.id;
            if (existingProductIds.has(pid)) continue; // bỏ qua nếu đã có trong giỏ
            try { await cartAPI.add(pid, item.quantity); }
            catch { /* bỏ qua từng item lỗi */ }
          }
          clearGuest();
        }
        await fetchCart();
      };
      mergeAndFetch();

    } else if (!isLoggedIn && wasLoggedIn) {
      /* Vừa đăng xuất → xóa giỏ hàng (không dùng lại guest cart cũ) */
      clearGuest();
      setItems([]);

    } else if (isLoggedIn) {
      /* App khởi động đã đăng nhập → fetch 1 lần */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCart();

    } else {
      /* App khởi động chưa đăng nhập → load localStorage */
      setItems(loadGuest());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  /* Lưu guest cart khi items thay đổi */
  useEffect(() => {
    if (!isLoggedIn) saveGuest(items);
  }, [items, isLoggedIn]);

  /* Cross-tab sync: tab khác thêm/xóa hàng → tab này cập nhật */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === GUEST_KEY && !isLoggedIn) {
        setItems(loadGuest());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isLoggedIn]);

  // addItem cập nhật UI ngay lập tức rồi mới gọi API — nếu lỗi thì fetchCart để rollback.
  const addItem = useCallback(async (product) => {
    const qty = product.quantity ?? 1;
    const pid = product.productId ?? product.id;

    if (!isLoggedIn) {
      /* Guest: cập nhật state + localStorage ngay */
      setItems(prev => {
        const ex = prev.find(i => (i.productId ?? i.id) === pid);
        if (ex) return prev.map(i =>
          (i.productId ?? i.id) === pid
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
        return [...prev, { ...product, id: `guest_${Date.now()}`, productId: pid, quantity: qty }];
      });
      return;
    }

    /* Đã đăng nhập:
     * 1. Optimistic → badge nhảy ngay lập tức
     * 2. Gọi API → sau đó fetchCart để lấy cartItemId thật
     * 3. Lỗi → rollback bằng fetchCart */
    setItems(prev => {
      const ex = prev.find(i => i.productId === pid);
      if (ex) {
        return prev.map(i =>
          i.productId === pid ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      /* Thêm temp item — có id = null (chưa có backend id) */
      return [...prev, {
        id:            null,
        productId:     pid,
        name:          product.name          ?? '',
        image:         product.image         ?? '',
        price:         product.price         ?? 0,
        originalPrice: product.originalPrice ?? product.price ?? 0,
        quantity:      qty,
        slug:          product.slug          ?? '',
        variantId:     product.variantId     ?? null,
        variantName:   product.variantName   ?? '',
        stockQty:      product.stockQty      ?? 999,
        requiresInstallation: product.requiresInstallation ?? false,
      }];
    });

    try {
      await cartAPI.add(pid, qty);
      /* Fetch để lấy cartItemId thật từ backend */
      await fetchCart();
      toast.success('✓ Đã thêm vào giỏ hàng!');
    } catch (err) {
      /* Rollback: lấy lại trạng thái thật từ backend */
      await fetchCart();
      toast.error('✕ ' + (err.message ?? 'Thêm thất bại, vui lòng thử lại'));
    }
  }, [isLoggedIn, fetchCart]);

  // Xóa sản phẩm khỏi giỏ — optimistic, rollback bằng fetchCart nếu API thất bại.
  const removeItem = useCallback(async (id) => {
    setItems(prev => prev.filter(i => i.id !== id)); // optimistic
    if (!isLoggedIn) return;
    try {
      await cartAPI.remove(id);
    } catch {
      await fetchCart(); // rollback
    }
  }, [isLoggedIn, fetchCart]);

  // Cập nhật số lượng với debounce 400ms để tránh gọi API liên tục khi người dùng click nhanh.
  const updateQuantity = useCallback((id, quantity) => {
    if (quantity <= 0) { removeItem(id); return; }

    /* Optimistic update ngay lập tức */
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));

    if (!isLoggedIn) return;

    /* Debounce: huỷ timer cũ, đặt timer mới 400ms */
    if (updateTimers.current[id]) clearTimeout(updateTimers.current[id]);
    updateTimers.current[id] = setTimeout(async () => {
      try {
        await cartAPI.update(id, quantity);
      } catch {
        await fetchCart(); // rollback nếu API thất bại
      }
    }, 400);
  }, [isLoggedIn, removeItem, fetchCart]);

  // Xóa toàn bộ giỏ hàng — optimistic, rollback nếu API lỗi.
  const clearCart = useCallback(async () => {
    setItems([]);
    if (!isLoggedIn) return;
    try {
      await cartAPI.clear();
    } catch {
      await fetchCart();
    }
  }, [isLoggedIn, fetchCart]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + Number(i.price ?? 0) * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, loading,
      addItem, removeItem, updateQuantity, clearCart,
      totalItems, totalPrice,
      fetchCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);