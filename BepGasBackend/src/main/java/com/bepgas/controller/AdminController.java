package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.dto.response.DashboardStatsResponse;
import com.bepgas.dto.response.OrderResponse;
import com.bepgas.entity.Order;
import com.bepgas.entity.OrderStatus;
import com.bepgas.entity.PaymentStatus;
import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.entity.Address;
import com.bepgas.entity.Review;
import com.bepgas.repository.OrderRepository;
import com.bepgas.repository.ProductRepository;
import com.bepgas.repository.ReviewRepository;
import com.bepgas.repository.UserRepository;
import com.bepgas.service.AddressService;
import com.bepgas.service.OrderService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * REST API quản trị — tổng hợp các chức năng cho Admin và Staff.
 * Base URL: /api/admin — mặc định yêu cầu ROLE_ADMIN (@PreAuthorize class-level).
 * Các endpoint cần cả Admin lẫn Staff dùng thêm @PreAuthorize("hasAnyRole('ADMIN','STAFF')").
 *
 * Nhóm chức năng:
 * - Sản phẩm: GET /products, /products/top-selling, /products/low-stock
 * - Dashboard: GET /dashboard (có filter theo ngày)
 * - Đơn hàng:  GET/PUT/DELETE /orders, /orders/{id}/status, /orders/{id}/confirm-payment...
 * - Người dùng: GET/POST/PUT/DELETE /users, /users/{id}/toggle-lock
 * - Đánh giá: GET /reviews, PUT /reviews/{id}/toggle-visible, reply, DELETE
 * - Địa chỉ: GET/POST/PUT/DELETE /users/{userId}/addresses
 * - Biên lai: POST /orders/{id}/payment-receipt
 * - Hoàn trả: PUT /orders/{id}/approve-return, /orders/{id}/reject-return
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final OrderRepository   orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository    userRepository;
    private final ReviewRepository  reviewRepository;
    private final PasswordEncoder   passwordEncoder;
    private final OrderService      orderService;
    private final AddressService    addressService;
    private final com.bepgas.service.ProductService productService;
    private final com.bepgas.repository.OrderStatusHistoryRepository historyRepository;
    private final com.bepgas.service.ImgBBService imgBBService;
    private final com.bepgas.repository.CouponRepository couponRepository;

    /**
     * Danh sách sản phẩm cho Admin (tất cả status, hỗ trợ filter search + status).
     * Gọi qua ProductService để đảm bảo @Transactional — tránh LazyInitializationException
     * khi Jackson serialize brand/category sau khi session đóng.
     */
    @GetMapping("/products")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<com.bepgas.dto.response.ProductResponse>>> getAdminProducts(
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {

        org.springframework.data.domain.Pageable pageable =
            org.springframework.data.domain.PageRequest.of(
                page, size,
                org.springframework.data.domain.Sort.by("createdAt").descending());

        return ResponseEntity.ok(ApiResponse.success(
            productService.getAdminPage(search, status, pageable)));
    }

    /**
     * Dashboard thống kê — Admin và Staff đều xem được.
     * Hỗ trợ filter theo khoảng thời gian: ?fromDate=yyyy-MM-dd&toDate=yyyy-MM-dd.
     * Khi không truyền → KPI tính toàn bộ lịch sử.
     * KPI không phụ thuộc filter (luôn tính theo hiện tại):
     * todayOrders, lowStockProducts, totalProducts, totalUsers.
     */
    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getDashboard(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {

        // Hôm nay — luôn dùng để tính todayOrders (không phụ thuộc filter)
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay   = startOfDay.plusDays(1);

        // Khoảng thời gian filter — mặc định là toàn bộ lịch sử nếu không truyền
        final boolean hasRange = (fromDate != null && !fromDate.isBlank())
                              || (toDate   != null && !toDate.isBlank());
        final LocalDateTime rangeFrom = (fromDate != null && !fromDate.isBlank())
                ? LocalDate.parse(fromDate).atStartOfDay()
                : LocalDateTime.of(2000, 1, 1, 0, 0);
        final LocalDateTime rangeTo = (toDate != null && !toDate.isBlank())
                ? LocalDate.parse(toDate).plusDays(1).atStartOfDay()
                : LocalDateTime.now().plusDays(1);

        java.util.List<OrderStatus> inFlightStatuses = java.util.List.of(
                OrderStatus.pending, OrderStatus.confirmed, OrderStatus.shipping);

        // ── KPI không ảnh hưởng bởi time filter ──────────────────
        long totalProducts  = productRepository.count();
        long totalUsers     = userRepository.count();
        long totalCustomers = userRepository.countByRole(com.bepgas.entity.Role.customer);
        long totalStaff     = userRepository.countByRole(com.bepgas.entity.Role.staff);
        // Cảnh báo vận hành — luôn tính theo trạng thái hiện tại
        long lowStock       = productRepository.countByStockQtyLessThanEqualAndStatus(5,
                                    com.bepgas.entity.ProductStatus.active);

        // ── Revenue + counts — dùng range query nếu có filter ─────
        java.math.BigDecimal paidRevenue, pendingRevenue, debtRevenue;
        long totalOrders, pendingOrders, confirmedOrders, shippingOrders, deliveredOrders, deliveryFailedOrders,
             cancelledOrders, returnPendingOrders, returnedOrders, codDeliveredUnpaid, reviewsNotReplied;

        // Điều chỉnh doanh thu do hoàn trả từng phần — đơn partially_refunded bị SQL loại hẳn khỏi
        // paidRevenue (lọc đúng payment_status=paid) nên phải cộng lại phần CHƯA hoàn (net), không
        // phải tính dư cả đơn. Cùng khoảng thời gian với paidRevenue (null/null = toàn bộ lịch sử).
        com.bepgas.dto.NetRevenueAdjustment netAdj = orderService.computeNetRevenueAdjustment(
                hasRange ? rangeFrom : null, hasRange ? rangeTo : null);

        if (hasRange) {
            paidRevenue    = orderRepository.sumPaidRevenueByRange(
                                com.bepgas.entity.PaymentStatus.paid, rangeFrom, rangeTo)
                                .add(netAdj.getPaidNetAdjustment());
            pendingRevenue = orderRepository.sumPendingRevenueByRange(
                                com.bepgas.entity.PaymentMethod.cod, inFlightStatuses, rangeFrom, rangeTo);
            debtRevenue    = orderRepository.sumDebtRevenueByRange(
                                OrderStatus.delivered, com.bepgas.entity.PaymentMethod.cod,
                                com.bepgas.entity.PaymentStatus.unpaid, rangeFrom, rangeTo);
            totalOrders        = orderRepository.countByCreatedAtBetween(rangeFrom, rangeTo);
            pendingOrders      = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.pending,        rangeFrom, rangeTo);
            confirmedOrders    = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.confirmed,      rangeFrom, rangeTo);
            shippingOrders     = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.shipping,       rangeFrom, rangeTo);
            deliveredOrders    = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.delivered,      rangeFrom, rangeTo);
            deliveryFailedOrders = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.delivery_failed, rangeFrom, rangeTo);
            cancelledOrders    = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.cancelled,      rangeFrom, rangeTo);
            returnPendingOrders= orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.return_pending, rangeFrom, rangeTo);
            returnedOrders     = orderRepository.countByStatusAndCreatedAtBetween(OrderStatus.returned,       rangeFrom, rangeTo);
            codDeliveredUnpaid = orderRepository.countByStatusAndPaymentMethodAndPaymentStatusAndCreatedAtBetween(
                                    OrderStatus.delivered, com.bepgas.entity.PaymentMethod.cod,
                                    com.bepgas.entity.PaymentStatus.unpaid, rangeFrom, rangeTo);
            reviewsNotReplied  = reviewRepository.countReviewsNotRepliedByRange(rangeFrom, rangeTo);
        } else {
            paidRevenue    = orderRepository.sumRevenueByPaymentStatus(com.bepgas.entity.PaymentStatus.paid)
                                .add(netAdj.getPaidNetAdjustment());
            pendingRevenue = orderRepository.sumRevenueByPaymentMethodAndStatuses(
                                com.bepgas.entity.PaymentMethod.cod, inFlightStatuses);
            debtRevenue    = orderRepository.sumRevenueByStatusAndPaymentMethodAndPaymentStatus(
                                OrderStatus.delivered, com.bepgas.entity.PaymentMethod.cod,
                                com.bepgas.entity.PaymentStatus.unpaid);
            totalOrders        = orderRepository.count();
            pendingOrders      = orderRepository.countByStatus(OrderStatus.pending);
            confirmedOrders    = orderRepository.countByStatus(OrderStatus.confirmed);
            shippingOrders     = orderRepository.countByStatus(OrderStatus.shipping);
            deliveredOrders    = orderRepository.countByStatus(OrderStatus.delivered);
            deliveryFailedOrders = orderRepository.countByStatus(OrderStatus.delivery_failed);
            cancelledOrders    = orderRepository.countByStatus(OrderStatus.cancelled);
            returnPendingOrders= orderRepository.countByStatus(OrderStatus.return_pending);
            returnedOrders     = orderRepository.countByStatus(OrderStatus.returned);
            codDeliveredUnpaid = orderRepository.countByStatusAndPaymentMethodAndPaymentStatus(
                                    OrderStatus.delivered, com.bepgas.entity.PaymentMethod.cod,
                                    com.bepgas.entity.PaymentStatus.unpaid);
            reviewsNotReplied  = reviewRepository.countByAdminReplyIsNull();
        }

        // totalRevenue luôn all-time (không phụ thuộc filter) — cần điều chỉnh riêng theo toàn bộ
        // lịch sử, không dùng netAdj phía trên vì netAdj có thể đang scope theo range đã chọn.
        com.bepgas.dto.NetRevenueAdjustment netAdjAllTime = hasRange
                ? orderService.computeNetRevenueAdjustment(null, null) : netAdj;
        java.math.BigDecimal totalRevenue = orderRepository.sumTotalRevenue()
                .subtract(netAdjAllTime.getTotalNetDeduction());

        DashboardStatsResponse stats = DashboardStatsResponse.builder()
                .paidRevenue(paidRevenue)
                .pendingRevenue(pendingRevenue)
                .debtRevenue(debtRevenue)
                .refundedAmount(netAdj.getRefundedAmount())
                .totalRevenue(totalRevenue)
                .totalOrders(totalOrders)
                .todayOrders(orderRepository.countByCreatedAtBetween(startOfDay, endOfDay))
                .totalProducts(totalProducts)
                .totalUsers(totalUsers)
                .totalCustomers(totalCustomers)
                .totalStaff(totalStaff)
                .pendingOrders(pendingOrders)
                .confirmedOrders(confirmedOrders)
                .shippingOrders(shippingOrders)
                .deliveredOrders(deliveredOrders)
                .deliveryFailedOrders(deliveryFailedOrders)
                .cancelledOrders(cancelledOrders)
                .returnPendingOrders(returnPendingOrders)
                .returnedOrders(returnedOrders)
                .codDeliveredUnpaid(codDeliveredUnpaid)
                .lowStockProducts(lowStock)
                .reviewsNotReplied(reviewsNotReplied)
                .build();

        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * Chi tiết danh sách đơn đóng góp vào 1 chỉ số doanh thu trên dashboard — admin bấm vào ô
     * doanh thu (thực thu/COD chưa thu/tạm tính/đã hoàn) để xem đúng các đơn cấu thành con số đó.
     */
    @GetMapping("/dashboard/revenue-detail")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<com.bepgas.dto.RevenueDetailResponse>> getRevenueDetail(
            @RequestParam String type,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        LocalDateTime fromDt = (fromDate != null && !fromDate.isBlank())
                ? LocalDate.parse(fromDate).atStartOfDay() : null;
        LocalDateTime toDt   = (toDate != null && !toDate.isBlank())
                ? LocalDate.parse(toDate).plusDays(1).atStartOfDay() : null;
        return ResponseEntity.ok(ApiResponse.success(orderService.getRevenueDetail(type, fromDt, toDt)));
    }

    /** Top sản phẩm bán chạy (all-time, dựa vào soldQty). */
    @GetMapping("/products/top-selling")
    public ResponseEntity<ApiResponse<java.util.List<com.bepgas.dto.response.ProductResponse>>> getTopSelling(
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(ApiResponse.success(productService.getTopSelling(limit)));
    }

    /** Top sản phẩm bán chạy tính từ đơn đã giao trong khoảng thời gian. */
    @GetMapping("/products/top-selling-orders")
    public ResponseEntity<ApiResponse<java.util.List<com.bepgas.dto.TopProductDTO>>> getTopSellingOrders(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getTopSellingFromOrders(from, to, limit)));
    }

    /** Sản phẩm sắp hết hàng (stockQty <= maxStock) — gọi qua ProductService (@Transactional). */
    @GetMapping("/products/low-stock")
    public ResponseEntity<ApiResponse<java.util.List<com.bepgas.dto.response.ProductResponse>>> getLowStock(
            @RequestParam(defaultValue = "8")  int limit,
            @RequestParam(defaultValue = "5")  int maxStock) {
        return ResponseEntity.ok(ApiResponse.success(productService.getLowStock(limit, maxStock)));
    }

    /**
     * Danh sách đơn hàng cho Admin/Staff — filter đa điều kiện phía server.
     * Map sang OrderResponse (qua OrderService) thay vì trả thẳng entity Order, để FE có sẵn
     * items[].returnedQty + statusHistory ngay trên danh sách — không cần mở chi tiết mới biết đơn
     * đã hoàn trả sản phẩm nào hoặc có yêu cầu đã duyệt mà chưa hoàn tiền.
     */
    @GetMapping("/orders")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Page<OrderResponse>>> getOrders(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String paymentMethod) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        OrderStatus   statusEnum = (status != null && !status.isBlank())
                                    ? OrderStatus.valueOf(status) : null;
        PaymentStatus psEnum     = (paymentStatus != null && !paymentStatus.isBlank())
                                    ? PaymentStatus.valueOf(paymentStatus) : null;
        com.bepgas.entity.PaymentMethod pmEnum = (paymentMethod != null && !paymentMethod.isBlank())
                                    ? com.bepgas.entity.PaymentMethod.valueOf(paymentMethod) : null;
        LocalDateTime fromDt     = (fromDate != null && !fromDate.isBlank())
                                    ? LocalDate.parse(fromDate).atStartOfDay() : null;
        LocalDateTime toDt       = (toDate != null && !toDate.isBlank())
                                    ? LocalDate.parse(toDate).plusDays(1).atStartOfDay() : null;

        return ResponseEntity.ok(ApiResponse.success(
                orderService.getAdminOrders(statusEnum, psEnum, pmEnum, fromDt, toDt, pageable)));
    }

    /** Chi tiết đơn hàng cho Admin/Staff — truyền userId=null để bỏ qua kiểm tra chủ sở hữu. */
    @GetMapping("/orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getById(id, null)));
    }

    // ── PUT /api/admin/orders/{id}/confirm-payment ────────────
    @PutMapping("/orders/{id}/confirm-payment")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmPayment(@PathVariable Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng #" + id));

        if (order.getPaymentMethod() != com.bepgas.entity.PaymentMethod.cod) {
            throw new BadRequestException("Chỉ xác nhận thu tiền COD — đơn VNPay được thanh toán tự động");
        }
        if (order.getStatus() != OrderStatus.delivered) {
            throw new BadRequestException("Chỉ xác nhận thanh toán cho đơn hàng đã giao");
        }
        if (order.getPaymentStatus() == PaymentStatus.paid) {
            throw new BadRequestException("Đơn hàng này đã được xác nhận thanh toán rồi");
        }

        order.setPaymentStatus(PaymentStatus.paid);
        orderRepository.save(order);

        return ResponseEntity.ok(ApiResponse.success(
                "Đã xác nhận thu tiền COD thành công",
                Map.of("orderId", id, "paymentStatus", "paid")));
    }

    // Fix #10: State machine — chỉ cho phép chuyển trạng thái theo luồng hợp lệ
    private static final java.util.Map<OrderStatus, java.util.Set<OrderStatus>> VALID_TRANSITIONS;
    static {
        java.util.Map<OrderStatus, java.util.Set<OrderStatus>> m = new java.util.HashMap<>();
        m.put(OrderStatus.pending,          java.util.Set.of(OrderStatus.confirmed, OrderStatus.cancelled));
        m.put(OrderStatus.confirmed,        java.util.Set.of(OrderStatus.shipping, OrderStatus.cancelled));
        m.put(OrderStatus.shipping,         java.util.Set.of(OrderStatus.delivered, OrderStatus.delivery_failed));
        m.put(OrderStatus.delivery_failed,  java.util.Set.of(OrderStatus.shipping, OrderStatus.cancelled));
        m.put(OrderStatus.delivered,        java.util.Set.of(OrderStatus.return_pending));
        m.put(OrderStatus.return_pending,   java.util.Set.of(OrderStatus.returned, OrderStatus.delivered));
        m.put(OrderStatus.cancelled,        java.util.Set.of());
        m.put(OrderStatus.returned,         java.util.Set.of());
        VALID_TRANSITIONS = java.util.Collections.unmodifiableMap(m);
    }

    // ── PUT /api/admin/orders/{id}/status ────────────────────
    @Transactional
    @PutMapping("/orders/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Order>> updateOrderStatus(
            @PathVariable Long id,
            @RequestBody  Map<String, String> body) {

        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            throw new BadRequestException("Thiếu trường 'status'");
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng #" + id));

        OrderStatus prevStatus = order.getStatus();
        OrderStatus nextStatus;
        try {
            nextStatus = OrderStatus.valueOf(newStatus);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Trạng thái không hợp lệ: " + newStatus);
        }

        // Fix #10: kiểm tra state machine
        java.util.Set<OrderStatus> allowed = VALID_TRANSITIONS.getOrDefault(prevStatus, java.util.Set.of());
        if (!allowed.contains(nextStatus)) {
            throw new BadRequestException(
                "Không thể chuyển trạng thái từ '" + prevStatus.name() + "' sang '" + nextStatus.name() + "'");
        }

        // Hoàn lại tồn kho khi hủy hoặc hoàn trả đơn hàng
        boolean shouldRestoreStock = (nextStatus == OrderStatus.cancelled || nextStatus == OrderStatus.returned)
                && prevStatus != OrderStatus.cancelled && prevStatus != OrderStatus.returned;

        if (shouldRestoreStock && order.getItems() != null) {
            for (com.bepgas.entity.OrderItem item : order.getItems()) {
                if (item.getProduct() != null) {
                    com.bepgas.entity.Product product = item.getProduct();
                    product.setStockQty((int)(product.getStockQty() + item.getQuantity()));
                    product.setSoldQty((int) Math.max(0, product.getSoldQty() - item.getQuantity()));
                    productRepository.save(product);
                }
            }
        }

        // Giảm usedCount coupon khi hủy đơn (nguyên tử)
        if (nextStatus == OrderStatus.cancelled && order.getCoupon() != null) {
            couponRepository.decrementUsedCount(order.getCoupon().getId());
        }

        // Đơn đã thanh toán VNPay bị admin hủy → chuyển sang chờ hoàn tiền, giống logic khách tự hủy
        // (OrderService.cancel()) — nếu không thì paymentStatus kẹt ở "paid" mãi, không có cách nào
        // nhắc admin hoàn tiền lại cho khách.
        if (nextStatus == OrderStatus.cancelled && order.getPaymentStatus() == PaymentStatus.paid) {
            order.setPaymentStatus(PaymentStatus.refund_pending);
        }

        order.setStatus(nextStatus);

        // Set deliveredAt khi giao thành công
        if (nextStatus == OrderStatus.delivered && order.getDeliveredAt() == null) {
            order.setDeliveredAt(java.time.LocalDateTime.now());
        }

        Order saved = orderRepository.save(order);

        // Ghi lịch sử trạng thái
        String reason = body.containsKey("reason") ? body.get("reason") : null;
        String adminEmail = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getName();
        String changedBy = userRepository.findByEmail(adminEmail).map(u -> {
            String name = u.getFullName() != null ? u.getFullName() : adminEmail;
            String role = u.getRole() == com.bepgas.entity.Role.admin ? "Quản trị viên" : "Nhân viên";
            return name + " (" + role + ")";
        }).orElse(adminEmail);
        historyRepository.save(com.bepgas.entity.OrderStatusHistory.builder()
                .order(saved)
                .status(nextStatus.name())
                .note(reason)
                .changedBy(changedBy)
                .build());

        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái thành công", saved));
    }

    // ── GET /api/admin/users ─────────────────────────────────
    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Page<User>>> getUsers(
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "200") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        // Staff chỉ được xem danh sách customer — không thấy admin / staff khác
        org.springframework.security.core.Authentication auth =
            org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        boolean isStaff = auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_STAFF"));

        if (isStaff) {
            return ResponseEntity.ok(ApiResponse.success(
                userRepository.findByRole(com.bepgas.entity.Role.customer, pageable)));
        }
        return ResponseEntity.ok(ApiResponse.success(userRepository.findAll(pageable)));
    }

    // ── POST /api/admin/users ────────────────────────────────
    @PostMapping("/users")
    public ResponseEntity<ApiResponse<User>> createUser(@RequestBody Map<String, String> body) {
        String fullName = body.get("fullName");
        String email    = body.get("email");
        String password = body.get("password");
        String phone    = body.getOrDefault("phone", "");
        String role     = body.getOrDefault("role", "customer");

        if (userRepository.existsByEmail(email))
            throw new BadRequestException("Email đã tồn tại");

        User user = User.builder()
                .fullName(fullName)
                .email(email)
                .password(passwordEncoder.encode(password))
                .phone(phone)
                .role(com.bepgas.entity.Role.valueOf(role))
                .enabled(true)
                .build();
        return ResponseEntity.ok(ApiResponse.success("Tạo tài khoản thành công", userRepository.save(user)));
    }

    // ── PUT /api/admin/users/{id} ────────────────────────────
    @PutMapping("/users/{id}")
    public ResponseEntity<ApiResponse<User>> updateUser(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @org.springframework.security.core.annotation.AuthenticationPrincipal
                org.springframework.security.core.userdetails.UserDetails currentUser) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + id));

        if (body.containsKey("fullName")) user.setFullName(body.get("fullName"));
        if (body.containsKey("phone"))    user.setPhone(body.get("phone"));

        if (body.containsKey("role")) {
            com.bepgas.entity.Role newRole = com.bepgas.entity.Role.valueOf(body.get("role"));
            boolean isDowngradingAdmin = user.getRole() == com.bepgas.entity.Role.admin && newRole != com.bepgas.entity.Role.admin;
            if (isDowngradingAdmin) {
                if (user.getEmail().equals(currentUser.getUsername())) {
                    throw new BadRequestException("Không thể tự hạ quyền chính mình");
                }
                if (user.isEnabled() && userRepository.countByRoleAndEnabledTrue(com.bepgas.entity.Role.admin) <= 1) {
                    throw new BadRequestException("Không thể hạ quyền admin cuối cùng trong hệ thống");
                }
            }
            user.setRole(newRole);
        }

        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công", userRepository.save(user)));
    }

    // ── DELETE /api/admin/users/{id} ─────────────────────────
    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id))
            throw new ResourceNotFoundException("Không tìm thấy tài khoản: " + id);
        long orderCount = orderRepository.countByUserId(id);
        if (orderCount > 0) {
            throw new BadRequestException(
                "Không thể xóa tài khoản đã có " + orderCount + " đơn hàng — hãy dùng khoá tài khoản thay thế");
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa tài khoản thành công", null));
    }

    /** Chỉ cho phép thao tác địa chỉ trên tài khoản khách hàng — bảo vệ địa chỉ admin/staff */
    private void requireCustomerTarget(Long userId) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + userId));
        if (target.getRole() != com.bepgas.entity.Role.customer) {
            throw new BadRequestException("Chỉ có thể quản lý địa chỉ của tài khoản khách hàng");
        }
    }

    // ── PUT /api/admin/users/{id}/toggle-lock ────────────────
    // Cho phép cả ADMIN và STAFF — staff chỉ được khoá tài khoản customer
    @PutMapping("/users/{id}/toggle-lock")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<User>> toggleLock(
            @PathVariable Long id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal
                org.springframework.security.core.userdetails.UserDetails currentUser) {

        User target = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + id));

        boolean isStaff = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_STAFF"));

        // Nhân viên chỉ được khoá tài khoản khách hàng
        if (isStaff && target.getRole() != com.bepgas.entity.Role.customer) {
            throw new BadRequestException("Nhân viên chỉ được khoá tài khoản khách hàng");
        }

        // Không cho tự khoá tài khoản của chính mình
        if (target.getEmail().equals(currentUser.getUsername())) {
            throw new BadRequestException("Không thể tự khoá tài khoản của chính mình");
        }

        // Không cho khoá admin cuối cùng còn active trong hệ thống
        boolean isLockingAdmin = target.isEnabled() && target.getRole() == com.bepgas.entity.Role.admin;
        if (isLockingAdmin && userRepository.countByRoleAndEnabledTrue(com.bepgas.entity.Role.admin) <= 1) {
            throw new BadRequestException("Không thể khoá admin cuối cùng trong hệ thống");
        }

        target.setEnabled(!target.isEnabled());
        return ResponseEntity.ok(ApiResponse.success(
                target.isEnabled() ? "Đã mở khoá tài khoản" : "Đã khoá tài khoản",
                userRepository.save(target)));
    }

    // ── GET /api/admin/reviews ───────────────────────────────
    @GetMapping("/reviews")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Page<Review>>> getReviews(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(ApiResponse.success(reviewRepository.findAll(pageable)));
    }

    // ── PUT /api/admin/reviews/{id}/toggle-visible ───────────
    @PutMapping("/reviews/{id}/toggle-visible")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> toggleVisible(@PathVariable Long id) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đánh giá: " + id));
        review.setVisible(!review.isVisible());
        reviewRepository.save(review);
        // Chỉ trả về field vừa đổi — tránh hoàn toàn việc serialize Review entity với proxy
        Map<String, Object> result = Map.of("isVisible", review.isVisible(), "reviewId", id);
        return ResponseEntity.ok(ApiResponse.success(
                review.isVisible() ? "Đã hiện đánh giá" : "Đã ẩn đánh giá", result));
    }

    // ── DELETE /api/admin/reviews/{id} ───────────────────────
    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteReview(@PathVariable Long id) {
        if (!reviewRepository.existsById(id))
            throw new ResourceNotFoundException("Không tìm thấy đánh giá: " + id);
        reviewRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa đánh giá thành công", null));
    }

    // ── PUT /api/admin/reviews/{id}/reply ─────────────────────
    @PutMapping("/reviews/{id}/reply")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> replyReview(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đánh giá: " + id));
        String reply = body.getOrDefault("adminReply", "").trim();
        review.setAdminReply(reply.isEmpty() ? null : reply);
        reviewRepository.save(review);
        // adminReply có thể null → dùng HashMap (Map.of không cho phép null value)
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("adminReply", review.getAdminReply());
        result.put("reviewId", id);
        return ResponseEntity.ok(ApiResponse.success("Đã lưu phản hồi", result));
    }
    // ── GET /api/admin/users/{userId}/addresses ──────────────
    @GetMapping("/users/{userId}/addresses")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<List<Address>>> getUserAddresses(@PathVariable Long userId) {
        requireCustomerTarget(userId);
        return ResponseEntity.ok(ApiResponse.success(addressService.getByUser(userId)));
    }

    // ── POST /api/admin/users/{userId}/addresses ─────────────
    @PostMapping("/users/{userId}/addresses")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Address>> createUserAddress(
            @PathVariable Long userId,
            @RequestBody Address address) {
        requireCustomerTarget(userId);
        return ResponseEntity.ok(ApiResponse.success("Them dia chi thanh cong",
                addressService.create(userId, address)));
    }

    // ── PUT /api/admin/users/{userId}/addresses/{addressId} ──
    @PutMapping("/users/{userId}/addresses/{addressId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Address>> updateUserAddress(
            @PathVariable Long userId,
            @PathVariable Long addressId,
            @RequestBody Address address) {
        requireCustomerTarget(userId);
        return ResponseEntity.ok(ApiResponse.success("Cap nhat thanh cong",
                addressService.update(addressId, userId, address)));
    }

    // ── DELETE /api/admin/users/{userId}/addresses/{addressId} ─
    @DeleteMapping("/users/{userId}/addresses/{addressId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Void>> deleteUserAddress(
            @PathVariable Long userId,
            @PathVariable Long addressId) {
        requireCustomerTarget(userId);
        addressService.delete(addressId, userId);
        return ResponseEntity.ok(ApiResponse.success("Xoa dia chi thanh cong", null));
    }

    // ── PUT /api/admin/users/{userId}/addresses/{addressId}/default ─
    @PutMapping("/users/{userId}/addresses/{addressId}/default")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Void>> setDefaultUserAddress(
            @PathVariable Long userId,
            @PathVariable Long addressId) {
        requireCustomerTarget(userId);
        addressService.setDefault(addressId, userId);
        return ResponseEntity.ok(ApiResponse.success("Da dat lam dia chi mac dinh", null));
    }

    // ── POST /api/admin/orders/{id}/payment-receipt ────────────
    @PostMapping("/orders/{id}/payment-receipt")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadPaymentReceipt(
            @PathVariable Long id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng #" + id));
        String url = imgBBService.upload(file);
        order.setPaymentReceiptUrl(url);
        orderRepository.save(order);
        return ResponseEntity.ok(ApiResponse.success("Đã lưu biên lai", Map.of("paymentReceiptUrl", url)));
    }

    // ── POST /api/admin/orders/{id}/refund-receipt ────────────
    @PostMapping("/orders/{id}/refund-receipt")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadRefundReceipt(
            @PathVariable Long id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng #" + id));
        String url = imgBBService.upload(file);
        order.setRefundReceiptUrl(url);
        orderRepository.save(order);
        return ResponseEntity.ok(ApiResponse.success("Đã lưu biên lai hoàn tiền", Map.of("refundReceiptUrl", url)));
    }

    // ── DELETE /api/admin/orders/{id}/refund-receipt ─────────────
    @DeleteMapping("/orders/{id}/refund-receipt")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Void>> deleteRefundReceipt(@PathVariable Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng #" + id));
        order.setRefundReceiptUrl(null);
        orderRepository.save(order);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa biên lai hoàn tiền", null));
    }

    // ── PUT /api/admin/orders/{id}/confirm-cancel-refund ─────────
    // Đánh dấu đã hoàn tiền cho đơn bị hủy sau khi thanh toán VNPay (refund_pending → refunded)
    @PutMapping("/orders/{id}/confirm-cancel-refund")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmCancelRefund(@PathVariable Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng #" + id));
        if (order.getStatus() != OrderStatus.cancelled || order.getPaymentStatus() != PaymentStatus.refund_pending) {
            throw new BadRequestException("Đơn hàng không ở trạng thái chờ hoàn tiền");
        }
        // Siết quy trình: phải upload biên lai chuyển khoản trước, tránh đánh dấu hoàn tiền khống
        if (order.getRefundReceiptUrl() == null || order.getRefundReceiptUrl().isBlank()) {
            throw new BadRequestException("Vui lòng upload biên lai chuyển khoản hoàn tiền trước khi xác nhận");
        }
        order.setPaymentStatus(PaymentStatus.refunded);
        orderRepository.save(order);
        return ResponseEntity.ok(ApiResponse.success("Đã xác nhận hoàn tiền thành công",
                Map.of("paymentStatus", "refunded")));
    }

    // ── DELETE /api/admin/orders/{id} ────────────────────────────
    @DeleteMapping("/orders/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteOrder(@PathVariable Long id) {
        orderService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa đơn hàng", null));
    }

    // ── PUT /api/admin/returns/approve ────────────────────────────
    // Duyệt 1 yêu cầu hoàn trả từng phần theo reqCode — body: { orderId, reqCode, restoreStock, refunded }
    @PutMapping("/returns/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<OrderResponse>> approveReturnRequest(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(String.valueOf(body.get("orderId")));
        String reqCode = String.valueOf(body.get("reqCode"));
        boolean restoreStock = Boolean.TRUE.equals(body.get("restoreStock"));
        boolean refunded = Boolean.TRUE.equals(body.get("refunded"));
        return ResponseEntity.ok(ApiResponse.success("Đã chấp nhận hoàn trả",
                orderService.approveReturnRequest(orderId, reqCode, restoreStock, refunded)));
    }

    // ── PUT /api/admin/returns/reject ─────────────────────────────
    // Từ chối 1 yêu cầu hoàn trả từng phần theo reqCode — body: { orderId, reqCode, reason }
    @PutMapping("/returns/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<OrderResponse>> rejectReturnRequest(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(String.valueOf(body.get("orderId")));
        String reqCode = String.valueOf(body.get("reqCode"));
        String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối hoàn trả",
                orderService.rejectReturnRequest(orderId, reqCode, reason)));
    }

    // ── PUT /api/admin/returns/confirm-refund ──────────────────────
    // Xác nhận đã hoàn tiền cho yêu cầu ĐÃ DUYỆT trước đó nhưng chưa tick hoàn tiền lúc duyệt
    // (VD: lúc đó chưa có biên lai) — body: { orderId, reqCode }
    @PutMapping("/returns/confirm-refund")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<OrderResponse>> confirmReturnRefund(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(String.valueOf(body.get("orderId")));
        String reqCode = String.valueOf(body.get("reqCode"));
        return ResponseEntity.ok(ApiResponse.success("Đã xác nhận hoàn tiền",
                orderService.confirmReturnRefund(orderId, reqCode)));
    }
}
