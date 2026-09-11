package com.bepgas.controller;

import com.bepgas.dto.request.ReviewRequest;
import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Review;
import com.bepgas.entity.User;
import com.bepgas.service.ReviewService;
import com.bepgas.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * REST API đánh giá sản phẩm.
 * Base URL: /api/reviews
 * Public : GET /reviews/product/{productId} — chỉ trả review visible
 * Auth   : POST /reviews/product/{productId} — tạo đánh giá mới (mỗi user 1 lần/sản phẩm)
 * Auth   : DELETE /reviews/{reviewId} — xóa đánh giá của mình
 * Admin quản lý (ẩn/hiện, reply, xóa) qua AdminController.
 */
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final UserService userService;

    @GetMapping("/product/{productId}")
    public ResponseEntity<ApiResponse<Page<Review>>> getByProduct(
            @PathVariable Long productId, Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.getByProduct(productId, pageable)));
    }

    @PostMapping("/product/{productId}")
    public ResponseEntity<ApiResponse<Review>> create(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ReviewRequest request) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Đánh giá thành công",
                reviewService.create(user.getId(), productId, request)));
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long reviewId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        reviewService.delete(reviewId, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Xóa đánh giá thành công", null));
    }

    /** Trả về danh sách productId mà user hiện tại đã đánh giá — dùng cho OrderDetail. */
    @GetMapping("/reviewed-product-ids")
    public ResponseEntity<ApiResponse<java.util.List<Long>>> getMyReviewedProductIds(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(reviewService.getReviewedProductIds(user.getId())));
    }
}
