package com.bepgas.repository;

import com.bepgas.entity.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {
    Optional<Coupon> findByCode(String code);
    List<Coupon> findByIsActiveTrue();
    boolean existsByCode(String code);

    /** Tăng usedCount một cách nguyên tử — chỉ tăng khi còn lượt (tránh race condition) */
    @Modifying
    @Query("UPDATE Coupon c SET c.usedCount = c.usedCount + 1 " +
           "WHERE c.id = :id AND (c.usageLimit IS NULL OR c.usedCount < c.usageLimit)")
    int incrementUsedCountIfAvailable(@Param("id") Long id);

    /** Giảm usedCount một cách nguyên tử (dùng khi hủy/xóa đơn) */
    @Modifying
    @Query("UPDATE Coupon c SET c.usedCount = c.usedCount - 1 WHERE c.id = :id AND c.usedCount > 0")
    void decrementUsedCount(@Param("id") Long id);
}
