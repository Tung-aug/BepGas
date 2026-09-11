package com.bepgas.repository;

import com.bepgas.entity.Product;
import com.bepgas.entity.ProductStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findBySlug(String slug);

    // Public API — active + out_of_stock (inactive bị ẩn hoàn toàn)
    Page<Product> findByStatusIn(List<ProductStatus> statuses, Pageable pageable);
    Page<Product> findByCategoryIdAndStatusIn(Long categoryId, List<ProductStatus> statuses, Pageable pageable);
    Page<Product> findByBrandIdAndStatusIn(Long brandId, List<ProductStatus> statuses, Pageable pageable);
    Page<Product> findByProductNameContainingIgnoreCaseAndStatusIn(String keyword, List<ProductStatus> statuses, Pageable pageable);

    // Public API — nhiều categoryId (dùng cho /category/{id}/tree)
    Page<Product> findByCategoryIdInAndStatusIn(List<Long> categoryIds, List<ProductStatus> statuses, Pageable pageable);

    // Admin API — lọc theo status đơn
    Page<Product> findByStatus(ProductStatus status, Pageable pageable);
    Page<Product> findByProductNameContainingIgnoreCaseAndStatus(String keyword, ProductStatus status, Pageable pageable);

    // Admin — tất cả status
    Page<Product> findByCategoryId(Long categoryId, Pageable pageable);
    Page<Product> findByBrandId(Long brandId, Pageable pageable);
    Page<Product> findByProductNameContainingIgnoreCase(String keyword, Pageable pageable);

    // Đếm sản phẩm sắp hết hàng (stockQty <= threshold, bao gồm cả bằng ngưỡng)
    long countByStockQtyLessThanEqualAndStatus(int threshold, ProductStatus status);

    // ── JOIN FETCH để tránh LazyInitializationException với Brand/Category ──
    // Dùng @Query + JOIN FETCH thay vì @EntityGraph để đảm bảo load eagerly
    // bất kể session state hay Hibernate version

    /** Top bán chạy — không lọc status để bao gồm cả sp đã inactive trong lịch sử bán */
    @Query("SELECT p FROM Product p " +
           "LEFT JOIN FETCH p.brand " +
           "LEFT JOIN FETCH p.category " +
           "WHERE p.soldQty > :minSold " +
           "ORDER BY p.soldQty DESC")
    List<Product> findTopSelling(@Param("minSold") int minSold,
                                  Pageable pageable);

    /** Sắp hết hàng — dùng <= để bao gồm sp tồn kho đúng bằng ngưỡng */
    @Query("SELECT p FROM Product p " +
           "LEFT JOIN FETCH p.brand " +
           "LEFT JOIN FETCH p.category " +
           "WHERE p.status = :status AND p.stockQty <= :maxStock " +
           "ORDER BY p.stockQty ASC")
    List<Product> findLowStock(@Param("status") ProductStatus status,
                                @Param("maxStock") int maxStock,
                                Pageable pageable);

    /** Admin: tất cả sản phẩm — JOIN FETCH brand + category */
    @Query("SELECT p FROM Product p " +
           "LEFT JOIN FETCH p.brand " +
           "LEFT JOIN FETCH p.category")
    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findAllWithRelations(Pageable pageable);

    /** Admin: tìm theo tên — JOIN FETCH brand + category */
    @Query("SELECT p FROM Product p " +
           "LEFT JOIN FETCH p.brand " +
           "LEFT JOIN FETCH p.category " +
           "WHERE LOWER(p.productName) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<Product> findByNameContaining(@Param("keyword") String keyword, Pageable pageable);

    boolean existsBySlug(String slug);
    boolean existsByCategoryId(Long categoryId);
    long countByCategoryId(Long categoryId);

    // SELECT FOR UPDATE — ngăn race condition khi nhiều đơn hàng cùng trừ kho
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);
}
