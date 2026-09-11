package com.bepgas.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Dữ liệu gửi khi thêm sản phẩm vào giỏ hàng — POST /api/cart.
 */
@Data
public class CartRequest {

    @NotNull // productId bắt buộc — không cho phép null
    private Long productId;

    @Min(1)  // Phải chọn ít nhất 1 sản phẩm
    private int quantity;
}
