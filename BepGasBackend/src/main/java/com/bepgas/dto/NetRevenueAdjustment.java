package com.bepgas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Kết quả tính điều chỉnh doanh thu do hoàn trả từng phần (payment_status = partially_refunded)
 * trong 1 khoảng thời gian — dùng nội bộ giữa OrderService và AdminController cho dashboard,
 * không lưu DB, không phải response trả thẳng cho client.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NetRevenueAdjustment {
    /** Cộng vào paidRevenue: tổng (totalAmount − đã hoàn) của các đơn không bị hủy/hoàn hết. */
    private BigDecimal paidNetAdjustment;
    /** Trừ vào totalRevenue: tổng tiền đã hoàn của các đơn đang ở status=delivered. */
    private BigDecimal totalNetDeduction;
    /** Tổng tiền đã hoàn trong khoảng — hiển thị riêng cho admin biết đã hoàn bao nhiêu. */
    private BigDecimal refundedAmount;
}
