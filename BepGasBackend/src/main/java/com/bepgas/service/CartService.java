package com.bepgas.service;

import com.bepgas.dto.request.CartRequest;
import com.bepgas.entity.CartItem;
import com.bepgas.entity.Product;
import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.CartItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Quản lý giỏ hàng của người dùng (CartItem).
 * Mỗi cart item là một cặp (user, product) với quantity.
 * Tất cả các thao tác đều kiểm tra quyền sở hữu (userId) trước khi thực hiện.
 * Sau mỗi save, re-fetch bằng findByIdWithDetails (JOIN FETCH) để tránh LazyInitializationException
 * khi Jackson serialize response sau khi session đã đóng.
 */
@Service
@RequiredArgsConstructor
public class CartService {

    private final CartItemRepository cartItemRepository;
    private final ProductService productService;
    private final UserService userService;

    /**
     * Lấy toàn bộ giỏ hàng của user.
     * findByUserId dùng JOIN FETCH product+images nên không cần lazy load sau session.
     *
     * @param userId ID user
     * @return danh sách CartItem của user
     */
    @Transactional(readOnly = true)
    public List<CartItem> getCart(Long userId) {
        return cartItemRepository.findByUserId(userId);
    }

    /**
     * Thêm sản phẩm vào giỏ hàng.
     * - Nếu sản phẩm đã có trong giỏ: cộng thêm quantity, kiểm tra không vượt tồn kho.
     * - Nếu chưa có: tạo CartItem mới, kiểm tra tồn kho đủ không.
     * Sau khi lưu, re-fetch với JOIN FETCH để Jackson serialize được (tránh LazyInitException).
     *
     * @param userId  ID user
     * @param request thông tin thêm giỏ (productId, quantity)
     * @return CartItem đã lưu với đầy đủ thông tin sản phẩm
     * @throws BadRequestException nếu quantity < 1 hoặc vượt tồn kho
     */
    @Transactional
    public CartItem addToCart(Long userId, CartRequest request) {
        Product product = productService.findById(request.getProductId());

        if (request.getQuantity() < 1) {
            throw new BadRequestException("Số lượng phải ít nhất là 1");
        }

        CartItem saved = cartItemRepository
                .findByUserIdAndProductId(userId, request.getProductId())
                .map(item -> {
                    // Sản phẩm đã có trong giỏ → cộng thêm, kiểm tra tổng không vượt tồn kho
                    int newTotal = item.getQuantity() + request.getQuantity();
                    if (newTotal > product.getStockQty()) {
                        throw new BadRequestException(
                            "Không đủ tồn kho. Hiện có " + product.getStockQty()
                            + ", giỏ đã chứa " + item.getQuantity() + " sản phẩm này.");
                    }
                    item.setQuantity(newTotal);
                    return cartItemRepository.save(item);
                })
                .orElseGet(() -> {
                    // Sản phẩm chưa có trong giỏ → tạo mới, kiểm tra tồn kho
                    if (product.getStockQty() < request.getQuantity()) {
                        throw new BadRequestException(
                            "Sản phẩm không đủ tồn kho (còn " + product.getStockQty() + ")");
                    }
                    User user = userService.getById(userId);
                    return cartItemRepository.save(CartItem.builder()
                            .user(user)
                            .product(product)
                            .quantity(request.getQuantity())
                            .build());
                });

        // Re-fetch với JOIN FETCH để response không bị LazyInitializationException
        return cartItemRepository.findByIdWithDetails(saved.getId()).orElse(saved);
    }

    /**
     * Cập nhật số lượng một item trong giỏ hàng.
     * Kiểm tra: quantity >= 1, đúng chủ giỏ hàng, không vượt tồn kho.
     *
     * @param itemId   ID CartItem cần cập nhật
     * @param userId   ID user (xác thực quyền sở hữu)
     * @param quantity số lượng mới
     * @return CartItem sau khi cập nhật
     * @throws BadRequestException nếu không có quyền hoặc vượt tồn kho
     */
    @Transactional
    public CartItem updateQuantity(Long itemId, Long userId, int quantity) {
        if (quantity < 1) {
            throw new BadRequestException("Số lượng phải ít nhất là 1");
        }

        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy item giỏ hàng"));
        if (!item.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền");
        }

        int stock = item.getProduct().getStockQty();
        if (quantity > stock) {
            throw new BadRequestException(
                "Số lượng vượt quá tồn kho (còn " + stock + ")");
        }

        item.setQuantity(quantity);
        CartItem saved = cartItemRepository.save(item);

        // Re-fetch với JOIN FETCH để tránh LazyInitializationException
        return cartItemRepository.findByIdWithDetails(saved.getId()).orElse(saved);
    }

    /**
     * Xóa một item khỏi giỏ hàng (kiểm tra đúng chủ).
     *
     * @param itemId ID CartItem cần xóa
     * @param userId ID user (xác thực quyền sở hữu)
     */
    @Transactional
    public void removeItem(Long itemId, Long userId) {
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy item giỏ hàng"));
        if (!item.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền");
        }
        cartItemRepository.delete(item);
    }

    /**
     * Xóa toàn bộ giỏ hàng của user (dùng khi cần clear hoàn toàn).
     *
     * @param userId ID user cần clear giỏ
     */
    @Transactional
    public void clearCart(Long userId) {
        cartItemRepository.deleteByUserId(userId);
    }

    /**
     * Xóa chỉ các cart item đã được đặt hàng, giữ nguyên item chưa chọn.
     * Được gọi bởi OrderService.create() sau khi tạo đơn thành công.
     *
     * @param userId     ID user
     * @param productIds danh sách productId đã đặt hàng
     */
    @Transactional
    public void removeOrderedItems(Long userId, java.util.List<Long> productIds) {
        for (Long productId : productIds) {
            cartItemRepository.findByUserIdAndProductId(userId, productId)
                    .ifPresent(cartItemRepository::delete);
        }
    }
}
