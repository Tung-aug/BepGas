package com.bepgas.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Một bước trong lịch sử trạng thái đơn hàng — hiển thị timeline trên trang chi tiết đơn.
 * Các bước được sắp xếp theo createdAt tăng dần (cũ → mới) từ OrderService.toResponse().
 */
@Data
@Builder
public class OrderStatusHistoryDto {
    private String        status;    // Tên trạng thái: "pending" / "confirmed" / "shipping"...
    private String        note;      // Lý do thay đổi (hủy, hoàn trả...) — null nếu không có lý do
    private String        imageUrl;  // Ảnh minh chứng (ảnh hàng lỗi khi hoàn trả) — null nếu không có
    private String        changedBy; // Tên admin/staff thực hiện — null nếu khách tự thao tác
    private LocalDateTime createdAt; // Thời điểm chuyển trạng thái — dùng để hiển thị trên timeline
}
