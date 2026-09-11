package com.bepgas.repository;

import com.bepgas.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    Optional<Category> findBySlug(String slug);
    boolean existsBySlug(String slug);

    // Tất cả danh mục, sắp theo sort_order
    List<Category> findAllByOrderBySortOrderAsc();

    // Danh mục gốc (không có cha)
    List<Category> findByParentCategoryIdIsNullOrderBySortOrderAsc();

    // Danh mục con theo cha
    List<Category> findByParentCategoryIdOrderBySortOrderAsc(Long parentCategoryId);

    // Kiểm tra có danh mục con không (dùng khi xóa)
    boolean existsByParentCategoryId(Long parentCategoryId);

    // Public API — chỉ danh mục đang hiển thị
    List<Category> findByIsActiveTrueOrderBySortOrderAsc();
}
