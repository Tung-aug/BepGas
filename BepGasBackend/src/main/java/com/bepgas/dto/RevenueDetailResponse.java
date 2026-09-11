package com.bepgas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response cho trang chi tiết doanh thu — gồm danh sách đơn đóng góp vào 1 chỉ số dashboard
 * (actual/cod-unpaid/estimated/refunded) kèm tổng hợp để đối chiếu đúng với số trên dashboard.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RevenueDetailResponse {
    private String type;
    private List<RevenueDetailRow> rows;
    private long totalOrders;
    private BigDecimal totalAmountSum;
    private BigDecimal refundedAmountSum;
    private BigDecimal countedAmountSum;
}
