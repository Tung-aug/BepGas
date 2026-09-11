package com.bepgas.service;

import com.bepgas.entity.Order;
import com.bepgas.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Dọn các đơn VNPay bị bỏ dở: khách đóng tab/mất mạng giữa lúc thanh toán nên không có
 * callback thành công lẫn thất bại từ VNPay → đơn nằm mãi ở pending/unpaid, kho và lượt
 * dùng coupon đã trừ lúc tạo đơn không bao giờ được hoàn lại.
 * Mốc 15 phút khớp với vnp_ExpireDate trong VNPayService — sau thời điểm này VNPay
 * cũng không còn chấp nhận thanh toán cho giao dịch đó nữa.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderCleanupScheduler {

    private final OrderRepository orderRepository;
    private final OrderService orderService;

    private static final int EXPIRE_MINUTES = 15;

    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void cleanupAbandonedVnpayOrders() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(EXPIRE_MINUTES);
        List<Order> abandoned = orderRepository.findAbandonedVnpayOrders(threshold);
        if (abandoned.isEmpty()) return;

        log.info("Dọn {} đơn VNPay bị bỏ dở (tạo trước {})", abandoned.size(), threshold);
        for (Order order : abandoned) {
            try {
                orderService.cancelAndRestoreStock(order.getId());
                log.info("Đã hủy đơn VNPay bỏ dở #{} ({})", order.getId(), order.getOrderCode());
            } catch (Exception e) {
                log.error("Lỗi khi dọn đơn VNPay bỏ dở #{}: {}", order.getId(), e.getMessage());
            }
        }
    }
}
