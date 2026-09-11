package com.bepgas.repository;

import com.bepgas.entity.OrderStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Repository lịch sử trạng thái đơn hàng.
 * Ghi append-only — không cập nhật hay xóa record đã lưu.
 */
public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, Long> {

    /**
     * Lấy toàn bộ lịch sử trạng thái của 1 đơn, sắp xếp cũ → mới.
     * Dùng trong OrderService.toResponse() để build timeline cho frontend.
     */
    List<OrderStatusHistory> findByOrderIdOrderByCreatedAtAsc(Long orderId);
}
