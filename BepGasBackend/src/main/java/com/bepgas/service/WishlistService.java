package com.bepgas.service;

import com.bepgas.dto.response.WishlistResponse;
import com.bepgas.entity.Product;
import com.bepgas.entity.User;
import com.bepgas.entity.Wishlist;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.ProductRepository;
import com.bepgas.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Quản lý danh sách yêu thích (Wishlist) của người dùng.
 * Mỗi wishlist item là cặp (user, product) — không cho thêm trùng.
 * Chỉ dành cho user đã đăng nhập (JWT required ở controller).
 */
@Service
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final ProductRepository  productRepository;
    private final UserService        userService;

    /**
     * Lấy toàn bộ danh sách yêu thích của user, map sang WishlistResponse (có giá, ảnh).
     *
     * @param userId ID user
     */
    @Transactional(readOnly = true)
    public List<WishlistResponse> getWishlist(Long userId) {
        return wishlistRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Thêm sản phẩm vào danh sách yêu thích.
     * Báo lỗi nếu sản phẩm đã có trong wishlist (tránh trùng lặp).
     *
     * @param userId    ID user
     * @param productId ID sản phẩm cần thêm
     * @return WishlistResponse đã tạo
     * @throws BadRequestException       nếu sản phẩm đã có trong wishlist
     * @throws ResourceNotFoundException nếu sản phẩm không tồn tại
     */
    @Transactional
    public WishlistResponse add(Long userId, Long productId) {
        if (wishlistRepository.existsByUserIdAndProductId(userId, productId)) {
            throw new BadRequestException("Sản phẩm đã có trong wishlist");
        }
        User    user    = userService.getById(userId);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm: " + productId));
        Wishlist saved = wishlistRepository.save(Wishlist.builder().user(user).product(product).build());
        return toResponse(saved);
    }

    /**
     * Xóa sản phẩm khỏi danh sách yêu thích.
     *
     * @param userId    ID user
     * @param productId ID sản phẩm cần xóa
     * @throws ResourceNotFoundException nếu sản phẩm không có trong wishlist
     */
    @Transactional
    public void remove(Long userId, Long productId) {
        if (!wishlistRepository.existsByUserIdAndProductId(userId, productId)) {
            throw new ResourceNotFoundException("Sản phẩm không có trong wishlist");
        }
        wishlistRepository.deleteByUserIdAndProductId(userId, productId);
    }

    /**
     * Map Wishlist entity → WishlistResponse DTO.
     * Lấy ảnh chính của sản phẩm (isPrimary=true), fallback về ảnh đầu tiên nếu không có.
     */
    private WishlistResponse toResponse(Wishlist w) {
        Product p = w.getProduct();
        String img = null;
        if (p.getImages() != null) {
            img = p.getImages().stream()
                    .filter(i -> i.isPrimary())
                    .map(i -> i.getImageUrl())
                    .findFirst()
                    // fallback về ảnh đầu tiên nếu không có ảnh isPrimary
                    .orElse(p.getImages().isEmpty() ? null : p.getImages().get(0).getImageUrl());
        }
        return WishlistResponse.builder()
                .id(w.getId())
                .productId(p.getId())
                .productName(p.getProductName())
                .slug(p.getSlug())
                .price(p.getPrice())
                .salePrice(p.getSalePrice())
                .primaryImageUrl(img)
                .isFeatured(p.isFeatured())
                .build();
    }
}
