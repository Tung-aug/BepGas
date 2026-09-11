package com.bepgas.entity;

/**
 * Trạng thái đơn hàng theo luồng state machine.
 * Luồng chính: pending → confirmed → shipping → delivered
 * Luồng phụ: shipping → delivery_failed → shipping (thử lại) hoặc cancelled
 *            delivered → return_pending → returned (hoàn hàng) hoặc delivered (từ chối hoàn)
 * Chuyển trạng thái được kiểm soát bởi VALID_TRANSITIONS trong AdminController.
 */
public enum OrderStatus {
    pending,          // Chờ xác nhận — vừa đặt xong, admin/staff chưa xem
    confirmed,        // Đã xác nhận — admin đã duyệt, chuẩn bị giao hàng
    shipping,         // Đang giao hàng — đơn vị vận chuyển đang mang đến
    delivered,        // Đã giao thành công — khách đã nhận hàng
    delivery_failed,  // Giao hàng thất bại — không liên lạc được khách, địa chỉ sai...
    cancelled,        // Đã hủy — khách hủy (pending/confirmed) hoặc admin hủy
    return_pending,   // Đang chờ duyệt hoàn hàng — khách gửi yêu cầu, admin chưa xử lý
    returned          // Đã hoàn hàng — admin chấp nhận, có thể đã hoàn kho và hoàn tiền
}
