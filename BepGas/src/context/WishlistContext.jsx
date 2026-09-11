// Context quản lý danh sách yêu thích — dùng Set để kiểm tra isWishlisted O(1).
// Toggle debounce 400ms và optimistic update: UI cập nhật ngay, rollback nếu API thất bại.

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { wishlistAPI } from '../services/api';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const pendingRef = useRef({}); // debounce map: productId → timeout
  // Lưu Set các productId đã yêu thích — tra cứu O(1)
  const [wishlisted, setWishlisted] = useState(new Set());
  const [loading,    setLoading]    = useState(false);

  // Load danh sách yêu thích khi đăng nhập
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isLoggedIn) { setWishlisted(new Set()); return; }
    setLoading(true);
    wishlistAPI.get()
      .then(res => {
        const list = res?.data ?? res ?? [];
        // Backend trả WishlistResponse DTO: { productId, productName, ... }
        const ids  = list.map(w => w.productId ?? w.product?.id).filter(Boolean);
        setWishlisted(new Set(ids));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  const isWishlisted = useCallback((productId) => wishlisted.has(productId), [wishlisted]);

  // isWishlistedRef giữ bản sao ref của Set để closure trong toggle không bị stale value.
  const isWishlistedRef = useRef(wishlisted);
  useEffect(() => { isWishlistedRef.current = wishlisted; }, [wishlisted]);

  const toggle = useCallback((productId) => {
    if (!isLoggedIn) return false;

    const alreadyIn = isWishlistedRef.current.has(productId);

    // Optimistic update ngay
    setWishlisted(prev => {
      const next = new Set(prev);
      alreadyIn ? next.delete(productId) : next.add(productId);
      return next;
    });

    // Debounce 400ms — tránh spam click
    if (pendingRef.current[productId]) clearTimeout(pendingRef.current[productId]);
    pendingRef.current[productId] = setTimeout(async () => {
      delete pendingRef.current[productId];
      try {
        if (alreadyIn) await wishlistAPI.remove(productId);
        else           await wishlistAPI.add(productId);
      } catch (err) {
        console.error('[Wishlist] toggle error:', err);
        setWishlisted(prev => {
          const next = new Set(prev);
          alreadyIn ? next.add(productId) : next.delete(productId);
          return next;
        });
      }
    }, 400);
    return true;
  }, [isLoggedIn]);

  return (
    <WishlistContext.Provider value={{ isWishlisted, toggle, loading, count: wishlisted.size }}>
      {children}
    </WishlistContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWishlist = () => useContext(WishlistContext);