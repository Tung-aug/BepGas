package com.bepgas.repository;

import com.bepgas.entity.Order;
import com.bepgas.entity.OrderStatus;
import com.bepgas.entity.PaymentMethod;
import com.bepgas.entity.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    Page<Order> findByUserId(Long userId, Pageable pageable);
    long countByUserId(Long userId);
    Page<Order> findByStatus(OrderStatus status, Pageable pageable);
    List<Order> findByStatus(OrderStatus status);
    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);
    long countByStatus(OrderStatus status);
    long countByStatusAndCreatedAtBetween(OrderStatus status, LocalDateTime from, LocalDateTime to);

    /** Dashboard: lọc đơn theo khoảng ngày tạo */
    Page<Order> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);
    Page<Order> findByStatusAndCreatedAtBetween(
            OrderStatus status, LocalDateTime from, LocalDateTime to, Pageable pageable);
    long countByStatusAndPaymentMethodAndPaymentStatus(
            OrderStatus status, PaymentMethod paymentMethod, PaymentStatus paymentStatus);
    long countByStatusAndPaymentMethodAndPaymentStatusAndCreatedAtBetween(
            OrderStatus status, PaymentMethod paymentMethod, PaymentStatus paymentStatus,
            LocalDateTime from, LocalDateTime to);

    /** Doanh thu cũ — giữ lại để tương thích */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o WHERE o.status = 'delivered'")
    BigDecimal sumTotalRevenue();

    // ── Queries không có date range (dùng khi filter = Tất cả) ──

    // Loại bỏ đơn đã hủy/đã hoàn trả để tránh tính nhầm doanh thu
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.paymentStatus = :payStatus " +
           "AND o.status NOT IN (com.bepgas.entity.OrderStatus.cancelled, com.bepgas.entity.OrderStatus.returned)")
    BigDecimal sumRevenueByPaymentStatus(@Param("payStatus") PaymentStatus payStatus);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.paymentMethod = :method AND o.status IN :statuses")
    BigDecimal sumRevenueByPaymentMethodAndStatuses(
            @Param("method") PaymentMethod method, @Param("statuses") List<OrderStatus> statuses);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.status = :status AND o.paymentMethod = :method AND o.paymentStatus = :payStatus")
    BigDecimal sumRevenueByStatusAndPaymentMethodAndPaymentStatus(
            @Param("status") OrderStatus status, @Param("method") PaymentMethod method,
            @Param("payStatus") PaymentStatus payStatus);

    // ── Queries có date range (dùng khi filter theo thời gian) ──

    /** Doanh thu thực tế (paid) trong khoảng thời gian — loại đơn đã hủy/hoàn trả */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.paymentStatus = :payStatus " +
           "AND o.status NOT IN (com.bepgas.entity.OrderStatus.cancelled, com.bepgas.entity.OrderStatus.returned) " +
           "AND o.createdAt >= :from AND o.createdAt < :to")
    BigDecimal sumPaidRevenueByRange(
            @Param("payStatus") PaymentStatus payStatus,
            @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Doanh thu tạm tính (COD in-flight) trong khoảng thời gian */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.paymentMethod = :method AND o.status IN :statuses " +
           "AND o.createdAt >= :from AND o.createdAt < :to")
    BigDecimal sumPendingRevenueByRange(
            @Param("method") PaymentMethod method, @Param("statuses") List<OrderStatus> statuses,
            @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** COD đã giao chưa thu — trong khoảng thời gian */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.status = :status AND o.paymentMethod = :method " +
           "AND o.paymentStatus = :payStatus AND o.createdAt >= :from AND o.createdAt < :to")
    BigDecimal sumDebtRevenueByRange(
            @Param("status") OrderStatus status, @Param("method") PaymentMethod method,
            @Param("payStatus") PaymentStatus payStatus,
            @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Lọc đa điều kiện cho admin list — tất cả params đều nullable (null = bỏ qua điều kiện) */
    @Query("SELECT o FROM Order o " +
           "WHERE (:status IS NULL OR o.status = :status) " +
           "AND (:paymentStatus IS NULL OR o.paymentStatus = :paymentStatus) " +
           "AND (:paymentMethod IS NULL OR o.paymentMethod = :paymentMethod) " +
           "AND (:fromDate IS NULL OR o.createdAt >= :fromDate) " +
           "AND (:toDate IS NULL OR o.createdAt < :toDate) " +
           "ORDER BY o.createdAt DESC")
    Page<Order> findByFilters(
            @Param("status") OrderStatus status,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("paymentMethod") PaymentMethod paymentMethod,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            Pageable pageable);

    /**
     * Đơn VNPay bị bỏ dở: tạo quá lâu mà vẫn pending/unpaid — khách đóng tab giữa chừng,
     * không có callback thành công lẫn thất bại nên không bao giờ tự dọn.
     * OrderCleanupScheduler dùng để tìm và hủy các đơn này, hoàn lại kho + coupon.
     */
    @Query("SELECT o FROM Order o WHERE o.paymentMethod = com.bepgas.entity.PaymentMethod.vnpay " +
           "AND o.status = com.bepgas.entity.OrderStatus.pending " +
           "AND o.paymentStatus = com.bepgas.entity.PaymentStatus.unpaid " +
           "AND o.createdAt < :before")
    List<Order> findAbandonedVnpayOrders(@Param("before") LocalDateTime before);

    /** Kiểm tra user đã có đơn hàng delivered chứa productId này chưa */
    @Query("SELECT CASE WHEN COUNT(oi) > 0 THEN TRUE ELSE FALSE END " +
           "FROM Order o JOIN o.items oi " +
           "WHERE o.user.id = :userId AND oi.product.id = :productId " +
           "AND o.status = com.bepgas.entity.OrderStatus.delivered")
    boolean existsDeliveredOrderWithProduct(@Param("userId") Long userId,
                                            @Param("productId") Long productId);
}
