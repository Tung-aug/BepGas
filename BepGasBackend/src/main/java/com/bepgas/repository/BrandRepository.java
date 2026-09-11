package com.bepgas.repository;

import com.bepgas.entity.Brand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BrandRepository extends JpaRepository<Brand, Long> {

    // Tìm thương hiệu theo slug — dùng cho filter sản phẩm theo thương hiệu qua URL
    Optional<Brand> findBySlug(String slug);

    // Kiểm tra slug đã tồn tại — dùng khi tạo/cập nhật để tránh trùng
    boolean existsBySlug(String slug);
}
