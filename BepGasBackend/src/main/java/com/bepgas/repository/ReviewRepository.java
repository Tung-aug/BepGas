package com.bepgas.repository;

import com.bepgas.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    // findById dùng cho toggle-visible, reply — cũng cần load để Jackson serialize được
    @Override
    @EntityGraph(attributePaths = {"user", "product"})
    Optional<Review> findById(Long id);

    // Admin list: load cả user + product trước khi session đóng (open-in-view=false)
    @Override
    @EntityGraph(attributePaths = {"user", "product"})
    Page<Review> findAll(Pageable pageable);

    // Public: chỉ trả về bình luận đang hiển thị (isVisible = true)
    @EntityGraph(attributePaths = {"user", "product"})
    Page<Review> findByProductIdAndIsVisibleTrue(Long productId, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "product"})
    Page<Review> findByProductIdAndIsVisibleTrueOrderByCreatedAtDesc(Long productId, Pageable pageable);

    Optional<Review> findByUserIdAndProductId(Long userId, Long productId);

    boolean existsByUserIdAndProductId(Long userId, Long productId);

    @Query("SELECT r.product.id FROM Review r WHERE r.user.id = :userId")
    List<Long> findReviewedProductIdsByUserId(@Param("userId") Long userId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.product.id = :productId AND r.isVisible = true")
    Double findAverageRatingByProductId(@Param("productId") Long productId);

    long countByProductIdAndIsVisibleTrue(Long productId);

    // Dashboard: đếm đánh giá chưa được admin phản hồi (tất cả thời gian)
    long countByAdminReplyIsNull();

    // Dashboard: đếm đánh giá chưa phản hồi trong khoảng thời gian
    @Query("SELECT COUNT(r) FROM Review r WHERE r.adminReply IS NULL " +
           "AND r.createdAt >= :from AND r.createdAt < :to")
    long countReviewsNotRepliedByRange(@Param("from") java.time.LocalDateTime from,
                                       @Param("to")   java.time.LocalDateTime to);
}
