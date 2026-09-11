package com.bepgas.repository;

import com.bepgas.entity.Banner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BannerRepository extends JpaRepository<Banner, Long> {

    // Lấy banner đang active, sắp theo sortOrder tăng dần — dùng cho Admin (không lọc ngày)
    List<Banner> findByIsActiveTrueOrderBySortOrderAsc();

    // Public API trang chủ: chỉ trả banner active VÀ đang trong khoảng startDate/endDate
    // (null = không giới hạn) — hết endDate thì banner tự ẩn, không cần admin tắt tay
    @Query("SELECT b FROM Banner b WHERE b.isActive = true " +
           "AND (b.startDate IS NULL OR b.startDate <= :now) " +
           "AND (b.endDate IS NULL OR b.endDate >= :now) " +
           "ORDER BY b.sortOrder ASC")
    List<Banner> findVisibleBanners(@Param("now") LocalDateTime now);
}
