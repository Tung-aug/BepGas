package com.bepgas.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Dữ liệu gửi lên khi đặt hàng — POST /api/orders.
 * @Valid trên List<OrderItemRequest> để Spring Validation kiểm tra từng item con.
 */
@Data
public class OrderRequest {

    @NotBlank // Tên người nhận — bắt buộc để shipper gọi điện/giao hàng
    private String shippingName;

    @NotBlank // SĐT người nhận
    private String shippingPhone;

    @NotBlank // Địa chỉ giao hàng đầy đủ (đường + phường + quận + tỉnh)
    private String shippingAddress;

    @NotBlank // Phương thức thanh toán: "cod" hoặc "vnpay"
    private String paymentMethod;

    private String couponCode; // Mã giảm giá — null nếu không dùng

    // installationFee giữ lại để không break client cũ, nhưng backend tự tính (fix #5)
    private java.math.BigDecimal installationFee;

    private String note; // Ghi chú thêm cho đơn hàng (giao giờ hành chính, gọi trước...)

    @NotEmpty // Phải có ít nhất 1 sản phẩm trong đơn
    @Valid    // Kích hoạt validate cho từng OrderItemRequest trong danh sách
    private List<OrderItemRequest> items;

    /**
     * Thông tin một sản phẩm trong đơn — cặp (productId, quantity).
     */
    @Data
    public static class OrderItemRequest {
        @NotNull(message = "Mã sản phẩm không được để trống")
        private Long productId; // ID sản phẩm cần đặt

        @Min(value = 1, message = "Số lượng phải ít nhất là 1")
        private int quantity;   // Số lượng đặt — OrderService kiểm tra thêm với tồn kho thực tế
    }
}
