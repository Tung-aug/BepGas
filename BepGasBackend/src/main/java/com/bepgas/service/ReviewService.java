package com.bepgas.service;

import com.bepgas.dto.request.ReviewRequest;
import com.bepgas.entity.Product;
import com.bepgas.entity.Review;
import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.OrderRepository;
import com.bepgas.repository.ProductRepository;
import com.bepgas.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản lý đánh giá sản phẩm (Review).
 * Mỗi user chỉ được đánh giá một sản phẩm một lần.
 * Tự động gắn badge "Đã mua hàng" (verifiedPurchase) nếu user có đơn delivered chứa sản phẩm.
 * Admin/Staff có thể ẩn/hiện review qua AdminController, không qua ReviewService.
 */
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final UserService userService;

    /**
     * Lấy danh sách đánh giá của sản phẩm (chỉ review đang hiện — isVisible=true).
     * Review bị admin ẩn sẽ không xuất hiện ở trang sản phẩm.
     *
     * @param productId ID sản phẩm
     * @param pageable  thông tin phân trang
     */
    public Page<Review> getByProduct(Long productId, Pageable pageable) {
        return reviewRepository.findByProductIdAndIsVisibleTrue(productId, pageable);
    }

    /**
     * Tạo đánh giá mới cho sản phẩm.
     * Kiểm tra: user chưa đánh giá sản phẩm này; nếu rồi thì báo lỗi.
     * verifiedPurchase=true nếu user có đơn hàng delivered chứa sản phẩm này
     * (query bằng existsDeliveredOrderWithProduct để tránh gian lận badge).
     *
     * @param userId    ID user gửi đánh giá
     * @param productId ID sản phẩm được đánh giá
     * @param request   nội dung đánh giá (rating 1-5, comment, imageUrl)
     * @throws BadRequestException nếu user đã đánh giá sản phẩm này
     */
    @Transactional
    public Review create(Long userId, Long productId, ReviewRequest request) {
        if (reviewRepository.existsByUserIdAndProductId(userId, productId)) {
            throw new BadRequestException("Bạn đã đánh giá sản phẩm này rồi");
        }
        User user = userService.getById(userId);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm: " + productId));

        // Tự động xác nhận "Đã mua hàng" — kiểm tra có đơn delivered chứa sản phẩm này không
        boolean verified = orderRepository.existsDeliveredOrderWithProduct(userId, productId);

        return reviewRepository.save(Review.builder()
                .user(user)
                .product(product)
                .rating(request.getRating())
                .comment(request.getComment())
                .imageUrl(request.getImageUrl())
                .verifiedPurchase(verified)
                .build());
    }

    /**
     * User xóa đánh giá của chính mình.
     * Kiểm tra quyền sở hữu trước khi xóa.
     *
     * @param reviewId ID đánh giá cần xóa
     * @param userId   ID user yêu cầu (xác thực quyền sở hữu)
     * @throws BadRequestException nếu không phải chủ đánh giá
     */
    @Transactional
    public void delete(Long reviewId, Long userId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đánh giá: " + reviewId));
        if (!review.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền xóa đánh giá này");
        }
        reviewRepository.delete(review);
    }

    public java.util.List<Long> getReviewedProductIds(Long userId) {
        return reviewRepository.findReviewedProductIdsByUserId(userId);
    }
}