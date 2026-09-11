package com.bepgas.repository;

import com.bepgas.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    /* Lấy giỏ hàng — JOIN FETCH để tránh LazyInitializationException khi serialize JSON */
    @Query("""
           SELECT ci FROM CartItem ci
           JOIN FETCH ci.product p
           LEFT JOIN FETCH p.images
           LEFT JOIN FETCH p.category
           LEFT JOIN FETCH p.brand
           WHERE ci.user.id = :userId
           """)
    List<CartItem> findByUserId(@Param("userId") Long userId);

    /* Kiểm tra item tồn tại khi thêm vào giỏ (không cần fetch detail) */
    Optional<CartItem> findByUserIdAndProductId(Long userId, Long productId);

    /* Lấy 1 item kèm đầy đủ association — dùng sau save() để trả về response */
    @Query("""
           SELECT ci FROM CartItem ci
           JOIN FETCH ci.product p
           LEFT JOIN FETCH p.images
           LEFT JOIN FETCH p.category
           LEFT JOIN FETCH p.brand
           WHERE ci.id = :id
           """)
    Optional<CartItem> findByIdWithDetails(@Param("id") Long id);

    void deleteByUserId(Long userId);
}