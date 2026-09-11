package com.bepgas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO thống kê sản phẩm bán chạy — dùng trong Dashboard Admin (top-selling-orders).
 * Được tổng hợp từ OrderItem của các đơn đã giao (delivered) trong khoảng thời gian.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TopProductDTO {
    private Long       productId;    // null nếu sản phẩm đã bị xóa khỏi DB
    private String     productName;  // Snapshot tên từ OrderItem — luôn có dù sản phẩm bị xóa
    private String     productImage; // Snapshot ảnh từ OrderItem
    private String     slug;         // Slug hiện tại để tạo link (null nếu sản phẩm bị xóa)
    private long       totalQty;     // Tổng số lượng đã bán trong khoảng thời gian
    private BigDecimal totalRevenue; // Tổng doanh thu = unitPrice × quantity (từ đơn delivered)
    private String     status;       // Trạng thái hiện tại: "active"/"inactive"/"deleted"
    private int        stockQty;     // Tồn kho hiện tại — 0 nếu sản phẩm đã xóa
}
