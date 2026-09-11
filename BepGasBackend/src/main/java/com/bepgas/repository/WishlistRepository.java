package com.bepgas.repository;

import com.bepgas.entity.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {

    // Lấy toàn bộ wishlist của user — EAGER load product nên không cần JOIN FETCH riêng
    List<Wishlist> findByUserId(Long userId);

    // Tìm item cụ thể — dùng để kiểm tra trùng và để xóa
    Optional<Wishlist> findByUserIdAndProductId(Long userId, Long productId);

    // Kiểm tra sản phẩm đã có trong wishlist chưa — tránh thêm trùng
    boolean existsByUserIdAndProductId(Long userId, Long productId);

    // Xóa theo cặp (userId, productId) — không cần load entity trước khi xóa
    void deleteByUserIdAndProductId(Long userId, Long productId);
}
