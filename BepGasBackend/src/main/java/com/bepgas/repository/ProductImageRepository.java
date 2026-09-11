package com.bepgas.repository;

import com.bepgas.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    // Lấy ảnh theo sortOrder tăng dần — dùng trong toResponse() để build gallery đúng thứ tự
    List<ProductImage> findByProductIdOrderBySortOrderAsc(Long productId);

    // Xóa toàn bộ ảnh của sản phẩm — dùng khi xóa sản phẩm (cascade thủ công)
    void deleteByProductId(Long productId);
}
