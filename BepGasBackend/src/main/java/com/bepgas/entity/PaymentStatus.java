package com.bepgas.entity;

/**
 * Trạng thái thanh toán của đơn hàng.
 * Độc lập với OrderStatus: ví dụ đơn COD delivered vẫn có thể unpaid nếu chưa thu tiền.
 */
public enum PaymentStatus {
    unpaid,             // Chưa thanh toán — mặc định khi tạo đơn, kể cả VNPay chưa hoàn tất
    paid,               // Đã thanh toán — VNPay callback thành công hoặc staff xác nhận thu COD
    refund_pending,     // Đang chờ hoàn tiền — khách hủy đơn đã thanh toán VNPay
    refunded,           // Đã hoàn tiền toàn bộ — admin duyệt hoàn trả/hủy và đã chuyển lại đủ tiền
    partially_refunded  // Đã hoàn một phần — duyệt hoàn trả từng sản phẩm, tổng hoàn < totalAmount
}
