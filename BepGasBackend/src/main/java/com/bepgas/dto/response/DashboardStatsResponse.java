package com.bepgas.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Response thống kê dashboard dành cho Admin và Staff.
 * Hỗ trợ filter theo khoảng thời gian (fromDate/toDate) ở AdminController.
 * KPI không phụ thuộc filter (luôn tính theo trạng thái hiện tại):
 * todayOrders, lowStockProducts, totalProducts, totalUsers.
 */
@Data
@Builder
public class DashboardStatsResponse {
    // ── 3 KPI doanh thu chính ────────────────────────────────
    /** Tiền thực giữ lại (net): payment_status = paid + phần còn lại của đơn partially_refunded
     * sau khi trừ tiền đã hoàn — KHÔNG còn tính dư phần đã hoàn trả cho khách. */
    private BigDecimal paidRevenue;
    /** Tiền COD đang trên đường: đơn pending/confirmed/shipping chưa thu */
    private BigDecimal pendingRevenue;
    /** Công nợ giao hàng: đơn delivered nhưng COD chưa thu — cần follow-up */
    private BigDecimal debtRevenue;
    /** Tổng tiền đã hoàn cho khách (đơn partially_refunded) trong kỳ — đối chiếu với paidRevenue. */
    private BigDecimal refundedAmount;

    // ── Tổng quan ────────────────────────────────────────────
    private BigDecimal totalRevenue;      // Tổng doanh thu all-time (status=delivered), đã trừ hoàn trả
    private long totalOrders;            // Tổng số đơn trong kỳ
    private long todayOrders;            // Đơn hôm nay — KPI vận hành, không filter theo range
    private long totalProducts;          // Tổng số sản phẩm trong hệ thống
    private long totalUsers;             // Tổng số tài khoản
    private long totalCustomers;         // Số tài khoản role=customer
    private long totalStaff;             // Số tài khoản role=staff
    // ── Phân tích đơn theo trạng thái ───────────────────────
    private long pendingOrders;          // Chờ xác nhận — cần xử lý sớm
    private long confirmedOrders;        // Đã xác nhận — chờ giao
    private long shippingOrders;         // Đang giao — theo dõi vận chuyển
    private long deliveredOrders;        // Đã giao thành công
    private long deliveryFailedOrders;   // Giao thất bại — cần xử lý lại
    private long cancelledOrders;        // Đã hủy
    private long returnPendingOrders;    // Đang chờ duyệt hoàn trả — cần xét duyệt
    private long returnedOrders;         // Đã hoàn trả xong (toàn bộ sản phẩm)
    private long codDeliveredUnpaid;     // COD đã giao nhưng chưa thu — cần xác nhận thu tiền
    // ── Cảnh báo vận hành ───────────────────────────────────
    private long lowStockProducts;       // Sản phẩm sắp hết hàng (stockQty <= 5) — luôn tính theo thực tế
    private long reviewsNotReplied;      // Đánh giá chưa được shop phản hồi
}
