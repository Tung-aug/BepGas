package com.bepgas.controller;

import com.bepgas.dto.request.CartRequest;
import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.CartItem;
import com.bepgas.entity.User;
import com.bepgas.service.CartService;
import com.bepgas.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API giỏ hàng.
 * Base URL: /api/cart — yêu cầu JWT (authenticated).
 * GET    /api/cart         — lấy giỏ hàng hiện tại
 * POST   /api/cart         — thêm sản phẩm vào giỏ
 * PUT    /api/cart/{itemId} — cập nhật số lượng
 * DELETE /api/cart/{itemId} — xóa một item
 * DELETE /api/cart          — xóa toàn bộ giỏ
 */
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;
    private final UserService userService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CartItem>>> getCart(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(cartService.getCart(user.getId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CartItem>> addToCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CartRequest request) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Thêm vào giỏ hàng thành công",
                cartService.addToCart(user.getId(), request)));
    }

    @PutMapping("/{itemId}")
    public ResponseEntity<ApiResponse<CartItem>> updateQuantity(
            @PathVariable Long itemId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Integer> body) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                cartService.updateQuantity(itemId, user.getId(), body.get("quantity"))));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<ApiResponse<Void>> removeItem(
            @PathVariable Long itemId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        cartService.removeItem(itemId, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Xóa khỏi giỏ hàng thành công", null));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> clearCart(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        cartService.clearCart(user.getId());
        return ResponseEntity.ok(ApiResponse.success("Đã xóa giỏ hàng", null));
    }
}
