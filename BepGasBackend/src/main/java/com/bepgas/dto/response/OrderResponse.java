package com.bepgas.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Response đầy đủ thông tin đơn hàng — dùng cho cả trang khách (chi tiết đơn) lẫn admin.
 * statusHistory: danh sách lịch sử trạng thái sắp xếp cũ → mới để hiển thị timeline.
 */
@Data
@Builder
public class OrderResponse {
    private Long       id;
    private String     orderCode;        // Mã đơn hiển thị: "ORD-A1B2C3D4"
    private String     shippingName;     // Người nhận hàng
    private String     shippingPhone;    // SĐT người nhận
    private String     shippingAddress;  // Địa chỉ giao hàng đầy đủ (snapshot lúc đặt)
    private String     status;           // Trạng thái hiện tại: "pending" / "confirmed"...
    private BigDecimal subtotal;         // Tổng tiền hàng trước giảm giá
    private String     couponCode;        // Mã voucher đã dùng (null nếu không áp mã)
    private BigDecimal discountAmount;   // Số tiền giảm từ coupon (0 nếu không dùng mã)
    private BigDecimal shippingFee;      // Phí vận chuyển (0 nếu đơn >= 500k)
    private BigDecimal installationFee;  // Phí lắp đặt (0 nếu không có sản phẩm cần lắp)
    private BigDecimal totalAmount;      // Tổng thanh toán = subtotal - discount + ship + lắp đặt
    private String     paymentMethod;    // "cod" hoặc "vnpay"
    private String     paymentStatus;    // "unpaid" / "paid" / "refunded"
    private String     note;             // Ghi chú của khách khi đặt hàng
    private List<OrderItemResponse>      items;         // Danh sách sản phẩm trong đơn
    private List<OrderStatusHistoryDto>  statusHistory; // Timeline trạng thái đơn (cũ → mới)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;         // Thời điểm cập nhật cuối — dùng tính deadline hoàn trả
    private LocalDateTime deliveredAt;       // Thời điểm giao thành công — dùng tính bảo hành
    private String        paymentReceiptUrl; // Ảnh biên lai chuyển khoản của khách
    private String        refundReceiptUrl;  // Ảnh biên lai hoàn tiền của admin

    /**
     * Thông tin một dòng sản phẩm trong đơn hàng — dữ liệu đã snapshot tại thời điểm mua.
     */
    @Data
    @Builder
    public static class OrderItemResponse {
        private Long       orderItemId;    // ID dòng OrderItem — dùng làm khóa khi gửi yêu cầu hoàn trả từng sản phẩm
        private Long       productId;      // null nếu sản phẩm đã bị xóa
        private String     productSlug;    // Slug để tạo link xem lại sản phẩm
        private String     productName;    // Tên snapshot — không đổi dù admin sửa tên sản phẩm
        private String     productImage;   // Ảnh snapshot
        private int        quantity;
        private BigDecimal unitPrice;      // Giá tại thời điểm mua (đã áp salePrice nếu có)
        private long       warrantyMonths; // Bảo hành snapshot — không bị ảnh hưởng khi admin sửa sau
        private long       returnedQty;    // Số lượng đã yêu cầu hoàn trả (chờ duyệt + đã duyệt) — FE dùng giới hạn số lượng có thể hoàn tiếp
    }
}
