package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.dto.response.WishlistResponse;
import com.bepgas.entity.User;
import com.bepgas.service.UserService;
import com.bepgas.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API danh sách yêu thích.
 * Base URL: /api/wishlist — yêu cầu JWT (authenticated).
 * GET    /api/wishlist              — lấy toàn bộ wishlist
 * POST   /api/wishlist/{productId}  — thêm sản phẩm vào wishlist
 * DELETE /api/wishlist/{productId}  — xóa sản phẩm khỏi wishlist
 */
@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;
    private final UserService userService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<WishlistResponse>>> getWishlist(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(wishlistService.getWishlist(user.getId())));
    }

    @PostMapping("/{productId}")
    public ResponseEntity<ApiResponse<WishlistResponse>> add(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Đã thêm vào wishlist",
                wishlistService.add(user.getId(), productId)));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<ApiResponse<Void>> remove(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        wishlistService.remove(user.getId(), productId);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa khỏi wishlist", null));
    }
}
