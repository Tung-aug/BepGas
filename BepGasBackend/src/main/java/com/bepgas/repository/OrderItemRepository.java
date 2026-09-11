package com.bepgas.repository;

import com.bepgas.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    // Lấy tất cả sản phẩm trong một đơn hàng — dùng khi cần xử lý từng item riêng
    List<OrderItem> findByOrderId(Long orderId);
}
