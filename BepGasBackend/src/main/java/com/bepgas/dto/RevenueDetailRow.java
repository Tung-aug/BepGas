package com.bepgas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 1 dòng trong bảng chi tiết doanh thu (trang /admin/dashboard/revenue-detail).
 * countedAmount: số tiền tính vào chỉ số đang xem (Thực thu/Chưa thu/Tạm tính/Đã hoàn) —
 * ý nghĩa thay đổi theo "type" của trang, xem OrderService.getRevenueDetail().
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RevenueDetailRow {
    private Long id;
    private String orderCode;
    private LocalDateTime createdAt;
    private String shippingName;
    private String paymentMethod;
    private String status;
    private String paymentStatus;
    private BigDecimal totalAmount;
    private BigDecimal refundedAmount;
    private BigDecimal countedAmount;
}
