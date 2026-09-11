package com.bepgas.service;

import com.bepgas.dto.NetRevenueAdjustment;
import com.bepgas.dto.ReturnDecisionData;
import com.bepgas.dto.ReturnRequestData;
import com.bepgas.dto.TopProductDTO;
import com.bepgas.dto.request.OrderRequest;
import com.bepgas.dto.response.OrderResponse;
import com.bepgas.entity.*;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.CouponRepository;
import com.bepgas.repository.OrderRepository;
import com.bepgas.repository.ProductRepository;
import com.bepgas.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Xử lý toàn bộ nghiệp vụ liên quan đến đơn hàng:
 * tạo đơn, cập nhật trạng thái, hủy đơn, hoàn trả, xóa đơn, in hoá đơn.
 * Mọi thao tác thay đổi tồn kho đều được bọc trong @Transactional để đảm bảo toàn vẹn dữ liệu.
 */
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CouponRepository couponRepository;
    private final CouponService couponService;
    private final UserService userService;
    private final CartService cartService;
    private final com.bepgas.repository.OrderStatusHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final ReturnRequestHelper returnRequestHelper;

    /**
     * Lấy danh sách đơn hàng của một user (có phân trang).
     * Luôn ép sort theo createdAt DESC để đơn mới nhất lên đầu,
     * bất kể client gửi sort parameter gì trong request.
     *
     * @param userId   ID của user cần lấy đơn
     * @param pageable thông tin phân trang từ request
     * @return trang kết quả đã map sang OrderResponse
     */
    @Transactional(readOnly = true)
    public Page<OrderResponse> getMyOrders(Long userId, Pageable pageable) {
        // Ép sort createdAt DESC — đơn mới nhất luôn lên đầu bất kể client gửi gì
        org.springframework.data.domain.Pageable sorted = org.springframework.data.domain.PageRequest.of(
            pageable.getPageNumber(),
            pageable.getPageSize(),
            org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Direction.DESC, "createdAt")
        );
        return orderRepository.findByUserId(userId, sorted).map(this::toResponse);
    }

    /**
     * Danh sách đơn hàng cho Admin/Staff — filter đa điều kiện, map sang OrderResponse (thay vì trả
     * thẳng entity Order) để FE có sẵn items[].returnedQty + statusHistory ngay trên danh sách,
     * không phải mở chi tiết mới biết đơn đã hoàn trả sản phẩm nào. Cần @Transactional vì toResponse
     * lazy-load items và truy vấn statusHistory cho từng đơn.
     */
    @Transactional(readOnly = true)
    public Page<OrderResponse> getAdminOrders(
            OrderStatus status, PaymentStatus paymentStatus, PaymentMethod paymentMethod,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {
        return orderRepository.findByFilters(status, paymentStatus, paymentMethod, fromDate, toDate, pageable)
                .map(this::toResponse);
    }

    /**
     * Tính điều chỉnh doanh thu do hoàn tiền trong 1 khoảng thời gian — dùng cho dashboard.
     * Gồm ĐỦ 3 loại hoàn tiền có thể xảy ra:
     * 1. Hoàn 1 phần (payment_status = partially_refunded) — số tiền hoàn lấy từ statusHistory.
     * 2. Hoàn toàn bộ qua luồng hoàn trả từng sản phẩm (payment_status = refunded, đã duyệt đủ
     *    100% giá trị đơn qua approveReturnRequest/confirmReturnRefund) — số tiền hoàn cũng lấy
     *    từ statusHistory (lúc này tổng đã hoàn >= totalAmount).
     * 3. Hoàn tiền đơn hủy VNPay (payment_status = refunded qua confirmCancelRefund) — KHÔNG đi
     *    qua luồng hoàn trả từng sản phẩm nên không có statusHistory liên quan → fallback dùng
     *    totalAmount (hoàn nguyên đơn).
     * Vì DB không có cột lưu sẵn số tiền đã hoàn, phải lấy từng đơn rồi tính lại từ statusHistory
     * (sumApprovedRefundAmount) — nhóm đơn refunded/partially_refunded luôn rất ít nên đủ rẻ để
     * tính trực tiếp ở Java, không cần SQL phức tạp.
     *
     * @param from null = không lọc theo ngày (toàn bộ lịch sử)
     * @param to   null = không lọc theo ngày (toàn bộ lịch sử)
     */
    @Transactional(readOnly = true)
    public NetRevenueAdjustment computeNetRevenueAdjustment(LocalDateTime from, LocalDateTime to) {
        List<Order> refundedOrders = new ArrayList<>();
        refundedOrders.addAll(orderRepository.findByFilters(
                null, PaymentStatus.partially_refunded, null, from, to, Pageable.unpaged()).getContent());
        refundedOrders.addAll(orderRepository.findByFilters(
                null, PaymentStatus.refunded, null, from, to, Pageable.unpaged()).getContent());

        BigDecimal paidNetAdjustment = BigDecimal.ZERO;
        BigDecimal totalNetDeduction = BigDecimal.ZERO;
        BigDecimal refundedAmount    = BigDecimal.ZERO;

        for (Order o : refundedOrders) {
            BigDecimal refunded = returnRequestHelper.sumApprovedRefundAmount(
                    historyRepository.findByOrderIdOrderByCreatedAtAsc(o.getId()));
            // Không có lịch sử hoàn trả từng sản phẩm (đơn hủy VNPay refunded thẳng, không qua
            // reqCode nào) → coi như hoàn nguyên đơn.
            if (refunded.compareTo(BigDecimal.ZERO) <= 0) {
                refunded = o.getTotalAmount();
            }
            refundedAmount = refundedAmount.add(refunded);

            // paidRevenue (SQL) đã loại trừ cancelled/returned — phần cộng thêm này phải khớp điều
            // kiện đó, tránh cộng nhầm đơn mà SQL gốc chưa từng tính vào paidRevenue.
            if (o.getStatus() != OrderStatus.cancelled && o.getStatus() != OrderStatus.returned) {
                paidNetAdjustment = paidNetAdjustment.add(o.getTotalAmount().subtract(refunded));
            }
            // totalRevenue (SQL) chỉ tính status=delivered — chỉ trừ đúng nhóm đó.
            if (o.getStatus() == OrderStatus.delivered) {
                totalNetDeduction = totalNetDeduction.add(refunded);
            }
        }

        return NetRevenueAdjustment.builder()
                .paidNetAdjustment(paidNetAdjustment)
                .totalNetDeduction(totalNetDeduction)
                .refundedAmount(refundedAmount)
                .build();
    }

    /**
     * Danh sách đơn đóng góp vào 1 chỉ số doanh thu trên dashboard, để admin xem chi tiết từng
     * đơn thay vì chỉ thấy 1 con số tổng. Mỗi type lấy ĐÚNG bộ đơn mà SQL/Java phía dashboard đã
     * dùng để tính ra con số đó (xem getDashboard ở AdminController + computeNetRevenueAdjustment),
     * để tổng trên trang chi tiết luôn khớp với số hiển thị trên dashboard.
     *
     * @param type "actual" (thực thu) | "cod-unpaid" (COD chưa thu) | "estimated" (tạm tính) | "refunded" (đã hoàn)
     * @param from null = không lọc theo ngày
     * @param to   null = không lọc theo ngày
     */
    @Transactional(readOnly = true)
    public com.bepgas.dto.RevenueDetailResponse getRevenueDetail(String type, LocalDateTime from, LocalDateTime to) {
        List<Order> orders;
        switch (type) {
            case "cod-unpaid" -> orders = orderRepository.findByFilters(
                    OrderStatus.delivered, PaymentStatus.unpaid, PaymentMethod.cod, from, to, Pageable.unpaged())
                    .getContent();
            case "estimated" -> {
                orders = new ArrayList<>();
                for (OrderStatus s : List.of(OrderStatus.pending, OrderStatus.confirmed, OrderStatus.shipping)) {
                    orders.addAll(orderRepository.findByFilters(s, null, PaymentMethod.cod, from, to, Pageable.unpaged())
                            .getContent());
                }
                orders.sort(Comparator.comparing(Order::getCreatedAt).reversed());
            }
            case "refunded" -> {
                // Gồm hoàn 1 phần VÀ hoàn toàn bộ (cả qua luồng hoàn trả từng sản phẩm lẫn hủy
                // VNPay) — khớp đúng 3 nhóm mà computeNetRevenueAdjustment dùng để tính refundedAmount.
                List<Order> combined = new ArrayList<>();
                combined.addAll(orderRepository.findByFilters(null, PaymentStatus.partially_refunded, null, from, to, Pageable.unpaged())
                        .getContent());
                combined.addAll(orderRepository.findByFilters(null, PaymentStatus.refunded, null, from, to, Pageable.unpaged())
                        .getContent());
                orders = combined.stream().sorted(Comparator.comparing(Order::getCreatedAt).reversed()).toList();
            }
            case "actual" -> {
                List<Order> combined = new ArrayList<>();
                combined.addAll(orderRepository.findByFilters(null, PaymentStatus.paid, null, from, to, Pageable.unpaged())
                        .getContent());
                combined.addAll(orderRepository.findByFilters(null, PaymentStatus.partially_refunded, null, from, to, Pageable.unpaged())
                        .getContent());
                // Loại đơn cancelled/returned — khớp đúng điều kiện sumRevenueByPaymentStatus/sumPaidRevenueByRange
                orders = combined.stream()
                        .filter(o -> o.getStatus() != OrderStatus.cancelled && o.getStatus() != OrderStatus.returned)
                        .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
                        .toList();
            }
            default -> throw new BadRequestException("Loại doanh thu không hợp lệ: " + type);
        }

        List<com.bepgas.dto.RevenueDetailRow> rows = orders.stream().map(o -> {
            BigDecimal refunded = BigDecimal.ZERO;
            if (o.getPaymentStatus() == PaymentStatus.partially_refunded || o.getPaymentStatus() == PaymentStatus.refunded) {
                refunded = returnRequestHelper.sumApprovedRefundAmount(historyRepository.findByOrderIdOrderByCreatedAtAsc(o.getId()));
                // Đơn refunded do hủy VNPay không có lịch sử hoàn trả từng sản phẩm — fallback hoàn nguyên đơn.
                if (refunded.compareTo(BigDecimal.ZERO) <= 0) refunded = o.getTotalAmount();
            }
            BigDecimal counted = switch (type) {
                case "refunded" -> refunded;
                case "actual"   -> o.getTotalAmount().subtract(refunded);
                default         -> o.getTotalAmount();
            };
            return com.bepgas.dto.RevenueDetailRow.builder()
                    .id(o.getId())
                    .orderCode(o.getOrderCode())
                    .createdAt(o.getCreatedAt())
                    .shippingName(o.getShippingName())
                    .paymentMethod(o.getPaymentMethod() != null ? o.getPaymentMethod().name() : null)
                    .status(o.getStatus().name())
                    .paymentStatus(o.getPaymentStatus().name())
                    .totalAmount(o.getTotalAmount())
                    .refundedAmount(refunded)
                    .countedAmount(counted)
                    .build();
        }).toList();

        BigDecimal totalAmountSum    = rows.stream().map(com.bepgas.dto.RevenueDetailRow::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refundedAmountSum = rows.stream().map(com.bepgas.dto.RevenueDetailRow::getRefundedAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal countedAmountSum  = rows.stream().map(com.bepgas.dto.RevenueDetailRow::getCountedAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return com.bepgas.dto.RevenueDetailResponse.builder()
                .type(type)
                .rows(rows)
                .totalOrders(rows.size())
                .totalAmountSum(totalAmountSum)
                .refundedAmountSum(refundedAmountSum)
                .countedAmountSum(countedAmountSum)
                .build();
    }

    /**
     * Lấy chi tiết một đơn hàng theo ID.
     * Nếu userId != null (tức là khách hàng gọi, không phải admin),
     * kiểm tra xem đơn hàng có thuộc về user đó không.
     *
     * @param id     ID đơn hàng
     * @param userId ID user đang yêu cầu (null nếu là admin)
     * @return chi tiết đơn hàng
     * @throws ResourceNotFoundException nếu không tìm thấy đơn hàng
     * @throws BadRequestException       nếu user không có quyền xem đơn này
     */
    @Transactional(readOnly = true)
    public OrderResponse getById(Long id, Long userId) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + id));
        if (userId != null && !order.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền xem đơn hàng này");
        }
        return toResponse(order);
    }

    /**
     * Tạo đơn hàng mới từ danh sách sản phẩm đã chọn.
     * Quy trình:
     * 1. Khóa row sản phẩm (SELECT FOR UPDATE) để tránh race condition tồn kho
     * 2. Kiểm tra tồn kho từng sản phẩm, trừ tồn kho và cộng soldQty
     * 3. Tính phí vận chuyển, phí lắp đặt, áp coupon nếu có
     * 4. Tạo Order + OrderItem, lưu vào DB
     * 5. Xóa các cart item đã đặt khỏi giỏ hàng của user
     *
     * @param userId  ID user đặt hàng
     * @param request thông tin đơn hàng (sản phẩm, địa chỉ, phương thức thanh toán...)
     * @return thông tin đơn hàng vừa tạo
     * @throws ResourceNotFoundException nếu sản phẩm không tồn tại
     * @throws BadRequestException       nếu tồn kho không đủ
     */
    @Transactional
    public OrderResponse create(Long userId, OrderRequest request) {
        User user = userService.getById(userId);

        BigDecimal subtotal = BigDecimal.ZERO;
        List<OrderItem> items = new ArrayList<>();

        for (OrderRequest.OrderItemRequest itemReq : request.getItems()) {
            // findByIdForUpdate dùng SELECT FOR UPDATE — khóa row, tránh race condition tồn kho
            // khi nhiều user cùng đặt sản phẩm tồn kho ít
            Product product = productRepository.findByIdForUpdate(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm: " + itemReq.getProductId()));

            if (product.getStockQty() < itemReq.getQuantity()) {
                throw new BadRequestException("Sản phẩm " + product.getProductName() + " không đủ tồn kho");
            }

            // Ưu tiên salePrice nếu có, không thì dùng price gốc
            BigDecimal price = product.getSalePrice() != null ? product.getSalePrice() : product.getPrice();
            subtotal = subtotal.add(price.multiply(BigDecimal.valueOf(itemReq.getQuantity())));

            // Lấy ảnh đầu tiên làm ảnh đại diện cho OrderItem (snapshot — không đổi khi sản phẩm thay ảnh)
            String mainImage = product.getImages() != null && !product.getImages().isEmpty()
                    ? product.getImages().get(0).getImageUrl() : null;

            items.add(OrderItem.builder()
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(price)
                    .productName(product.getProductName())
                    .productImage(mainImage)
                    .requiresInstallation(product.isRequiresInstallation())
                    .warrantyMonths(product.getWarrantyMonths())   // snapshot bảo hành tại thời điểm đặt hàng
                    .build());

            // Trừ tồn kho và cộng số đã bán
            product.setStockQty(product.getStockQty() - itemReq.getQuantity());
            product.setSoldQty(product.getSoldQty() + itemReq.getQuantity());
            productRepository.save(product);
        }

        // Áp dụng mã giảm giá nếu có — validate trước, sau đó tăng lượt dùng một cách nguyên tử
        BigDecimal discount = BigDecimal.ZERO;
        Coupon coupon = null;
        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            discount = couponService.validate(request.getCouponCode(), subtotal);
            coupon = couponRepository.findByCode(request.getCouponCode().trim().toUpperCase()).orElse(null);
            if (coupon != null) {
                int updated = couponRepository.incrementUsedCountIfAvailable(coupon.getId());
                if (updated == 0) throw new com.bepgas.exception.BadRequestException("Mã coupon đã hết lượt sử dụng");
            }
        }

        // Phí vận chuyển: miễn phí nếu subtotal >= 500.000đ, ngược lại 30.000đ
        BigDecimal shippingFee = subtotal.compareTo(BigDecimal.valueOf(500000)) >= 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(30000);

        // Phí lắp đặt: tổng phí tất cả sản phẩm yêu cầu lắp đặt
        // Mỗi sản phẩm có installationFee riêng; nếu null thì dùng mặc định 150.000đ
        BigDecimal installationFee = items.stream()
                .filter(i -> i.getProduct() != null && i.getProduct().isRequiresInstallation())
                .map(i -> {
                    BigDecimal fee = i.getProduct().getInstallationFee();
                    return fee != null ? fee : BigDecimal.valueOf(150_000L);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Tổng tiền = tạm tính - giảm giá + ship + lắp đặt
        BigDecimal totalAmount = subtotal.subtract(discount).add(shippingFee).add(installationFee);

        // Sinh mã đơn hàng ngẫu nhiên dạng ORD-XXXXXXXX (8 ký tự UUID)
        Order order = Order.builder()
                .user(user)
                .orderCode("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .shippingName(request.getShippingName())
                .shippingPhone(request.getShippingPhone())
                .shippingAddress(request.getShippingAddress())
                .paymentMethod(PaymentMethod.valueOf(request.getPaymentMethod()))
                .subtotal(subtotal)
                .discountAmount(discount)
                .shippingFee(shippingFee)
                .installationFee(installationFee)
                .totalAmount(totalAmount)
                .coupon(coupon)
                .note(request.getNote())
                .build();

        // Lưu order trước để có ID, sau đó set quan hệ 2 chiều với items
        order = orderRepository.save(order);
        for (OrderItem item : items) item.setOrder(order);
        order.setItems(items);
        orderRepository.save(order);

        // Chỉ xóa cart item của sản phẩm đã đặt — giữ nguyên item chưa chọn trong giỏ
        java.util.List<Long> orderedProductIds = request.getItems().stream()
                .map(OrderRequest.OrderItemRequest::getProductId)
                .toList();
        cartService.removeOrderedItems(userId, orderedProductIds);

        return toResponse(order);
    }

    /**
     * Khách hàng hủy đơn hàng của chính mình.
     * Chỉ cho phép hủy khi đơn đang ở trạng thái pending hoặc confirmed.
     * Sau khi hủy: hoàn lại tồn kho và ghi lịch sử.
     *
     * @param id     ID đơn hàng
     * @param userId ID user yêu cầu hủy (để xác thực quyền sở hữu)
     * @param reason lý do hủy
     * @return đơn hàng sau khi hủy
     * @throws BadRequestException nếu không có quyền hoặc đơn không thể hủy
     */
    @Transactional
    public OrderResponse cancel(Long id, Long userId, String reason) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + id));
        if (!order.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền hủy đơn hàng này");
        }
        if (order.getStatus() == OrderStatus.shipping) {
            throw new BadRequestException(
                "Không thể hủy đơn hàng đang được vận chuyển. Vui lòng chờ nhận hàng, sau đó dùng tính năng yêu cầu hoàn trả nếu cần.");
        }
        if (order.getStatus() == OrderStatus.delivered) {
            throw new BadRequestException(
                "Đơn hàng đã giao không thể hủy. Vui lòng dùng tính năng yêu cầu hoàn trả sản phẩm thay thế.");
        }
        if (order.getStatus() != OrderStatus.pending && order.getStatus() != OrderStatus.confirmed) {
            throw new BadRequestException("Chỉ có thể hủy đơn hàng đang chờ xử lý hoặc đã xác nhận");
        }
        order.setStatus(OrderStatus.cancelled);
        // Đã thanh toán qua VNPay → chuyển sang chờ hoàn tiền thay vì giữ nguyên trạng thái paid
        if (order.getPaymentStatus() == PaymentStatus.paid) {
            order.setPaymentStatus(PaymentStatus.refund_pending);
        }
        // Ghi lịch sử hủy — changedBy = null vì khách tự hủy (không phải admin)
        historyRepository.save(com.bepgas.entity.OrderStatusHistory.builder()
                .order(order).status("cancelled").note(reason).build());
        // Hoàn lại tồn kho và giảm soldQty
        if (order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                Product p = item.getProduct();
                if (p != null) {
                    p.setStockQty((int)(p.getStockQty() + item.getQuantity()));
                    p.setSoldQty((int) Math.max(0, p.getSoldQty() - item.getQuantity()));
                    productRepository.save(p);
                }
            }
        }
        // Giảm lượt sử dụng coupon đã tăng khi tạo đơn (nguyên tử)
        if (order.getCoupon() != null) {
            couponRepository.decrementUsedCount(order.getCoupon().getId());
        }
        return toResponse(orderRepository.save(order));
    }

    /**
     * Xóa đơn hàng và hoàn lại toàn bộ tồn kho + coupon.
     * Dùng cho trường hợp thanh toán VNPay thất bại/bị hủy:
     * đơn được tạo trước khi redirect nhưng chưa thanh toán → cần XÓA hoàn toàn
     * (không phải cancel) để đơn không hiện trong admin/client.
     *
     * @param orderId ID đơn hàng cần xóa
     */
    @Transactional
    public void cancelAndRestoreStock(Long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return; // đã bị xóa trước đó — bỏ qua

        // Hoàn lại tồn kho cho từng sản phẩm trong đơn
        if (order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                Product p = item.getProduct();
                if (p != null) {
                    p.setStockQty(p.getStockQty() + (int) item.getQuantity());
                    p.setSoldQty((int) Math.max(0, p.getSoldQty() - item.getQuantity()));
                    productRepository.save(p);
                }
            }
        }

        // Giảm lượt sử dụng coupon đã tăng khi tạo đơn (nguyên tử)
        if (order.getCoupon() != null) {
            couponRepository.decrementUsedCount(order.getCoupon().getId());
        }

        // Hoàn lại giỏ hàng — thêm từng sản phẩm về cart của khách
        Long userId = order.getUser() != null ? order.getUser().getId() : null;
        if (userId != null && order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() == null) continue;
                com.bepgas.dto.request.CartRequest cartReq = new com.bepgas.dto.request.CartRequest();
                cartReq.setProductId(item.getProduct().getId());
                cartReq.setQuantity((int) item.getQuantity());
                try {
                    cartService.addToCart(userId, cartReq);
                } catch (Exception ignored) {
                    // Sản phẩm không còn active → bỏ qua, không chặn việc xóa đơn
                }
            }
        }

        // XÓA đơn — thanh toán thất bại không được tính là đơn hàng
        orderRepository.delete(order);
    }

    /** Kết quả xử lý 1 lượt báo kết quả VNPay — dùng để controller quyết định phản hồi phù hợp. */
    public enum VnpayResult { ORDER_NOT_FOUND, ALREADY_PROCESSED, AMOUNT_MISMATCH, PAID, FAILED }

    /**
     * Xử lý kết quả thanh toán VNPay — dùng chung cho cả callback (browser redirect) và
     * IPN (server-to-server), vì cả hai có thể cùng báo về cho 1 giao dịch theo thứ tự bất kỳ.
     * Idempotent: gọi nhiều lần với cùng giao dịch không gây side-effect kép (không set paid 2 lần,
     * không cancelAndRestoreStock 2 lần — lần gọi sau tìm thấy đơn đã paid hoặc đã bị xóa thì bỏ qua).
     *
     * @param orderId      ID đơn hàng (lấy từ vnp_TxnRef)
     * @param responseCode mã kết quả VNPay trả về ("00" = thành công)
     * @param vnpAmount    số tiền VNPay báo về (đã nhân 100), dùng để chống giả mạo số tiền
     * @return trạng thái xử lý — controller map sang response phù hợp (redirect FE hoặc RspCode VNPay)
     */
    @Transactional
    public VnpayResult processVnpayResult(Long orderId, String responseCode, long vnpAmount) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return VnpayResult.ORDER_NOT_FOUND; // đã bị dọn (hủy/xóa) trước đó

        // Đã xử lý thành công rồi — request đến sau (callback hoặc IPN gọi lại) không làm lại
        if (order.getPaymentStatus() == PaymentStatus.paid) return VnpayResult.ALREADY_PROCESSED;

        if ("00".equals(responseCode)) {
            // Kiểm tra số tiền khớp — phòng trường hợp tạo URL thanh toán bị lỗi sinh sai số tiền
            long expectedAmount = order.getTotalAmount().longValue() * 100;
            if (expectedAmount != vnpAmount) return VnpayResult.AMOUNT_MISMATCH;
            // Chỉ cập nhật paymentStatus — KHÔNG tự đổi status sang confirmed, để admin
            // chủ động xác nhận đơn giống đơn COD (nhất quán quy trình xử lý cho mọi phương thức).
            order.setPaymentStatus(PaymentStatus.paid);
            orderRepository.save(order);
            return VnpayResult.PAID;
        }

        // Thất bại/hủy — xóa đơn, hoàn kho + coupon (an toàn nếu gọi lại: order đã null thì no-op)
        cancelAndRestoreStock(orderId);
        return VnpayResult.FAILED;
    }

    /**
     * Chuyển đổi entity Order sang DTO OrderResponse để trả về client.
     * Bao gồm: danh sách OrderItem, lịch sử trạng thái (sắp xếp theo thời gian tăng dần).
     *
     * @param o entity Order cần convert
     * @return OrderResponse chứa đầy đủ thông tin cho client
     */
    private OrderResponse toResponse(Order o) {
        // Load 1 lần duy nhất — dùng chung cho cả timeline lịch sử và tính returnedQty từng item
        List<OrderStatusHistory> historyEntities = historyRepository.findByOrderIdOrderByCreatedAtAsc(o.getId());
        Map<Long, Long> returnedQtyByItem = returnRequestHelper.aggregateReturnedQty(historyEntities);

        // Map từng OrderItem sang DTO
        List<OrderResponse.OrderItemResponse> itemResponses;
        if (o.getItems() == null) {
            itemResponses = new ArrayList<>();
        } else {
            itemResponses = o.getItems().stream().map(item -> OrderResponse.OrderItemResponse.builder()
                    .orderItemId(item.getId())
                    .productId(item.getProduct() != null ? item.getProduct().getId() : null)
                    .productSlug(item.getProduct() != null ? item.getProduct().getSlug() : null)
                    .productName(item.getProductName())
                    .productImage(item.getProductImage())
                    .quantity((int) item.getQuantity())
                    .unitPrice(item.getUnitPrice())
                    .warrantyMonths(item.getWarrantyMonths())
                    .returnedQty(returnedQtyByItem.getOrDefault(item.getId(), 0L))
                    .build()).toList();
        }

        // Lấy lịch sử trạng thái, sắp xếp cũ → mới để frontend hiển thị timeline
        List<com.bepgas.dto.response.OrderStatusHistoryDto> history = historyEntities
                .stream()
                .map(h -> com.bepgas.dto.response.OrderStatusHistoryDto.builder()
                        .status(h.getStatus())
                        .note(h.getNote())
                        .imageUrl(h.getImageUrl())
                        .changedBy(enrichChangedBy(h.getChangedBy()))
                        .createdAt(h.getCreatedAt())
                        .build())
                .toList();

        return OrderResponse.builder()
                .id(o.getId())
                .orderCode(o.getOrderCode())
                .shippingName(o.getShippingName())
                .shippingPhone(o.getShippingPhone())
                .shippingAddress(o.getShippingAddress())
                .status(o.getStatus().name())
                .subtotal(o.getSubtotal())
                .couponCode(o.getCoupon() != null ? o.getCoupon().getCode() : null)
                .discountAmount(o.getDiscountAmount())
                .shippingFee(o.getShippingFee())
                .installationFee(o.getInstallationFee())
                .totalAmount(o.getTotalAmount())
                .paymentMethod(o.getPaymentMethod() != null ? o.getPaymentMethod().name() : null)
                .paymentStatus(o.getPaymentStatus().name())
                .note(o.getNote())
                .items(itemResponses)
                .statusHistory(history)
                .deliveredAt(o.getDeliveredAt())
                .paymentReceiptUrl(o.getPaymentReceiptUrl())
                .refundReceiptUrl(o.getRefundReceiptUrl())
                .createdAt(o.getCreatedAt())
                .updatedAt(o.getUpdatedAt())
                .build();
    }

    /**
     * Admin xóa đơn hàng khỏi hệ thống.
     * Nếu đơn đang ở trạng thái pending/confirmed/shipping (chưa giao) thì hoàn lại tồn kho.
     * Các đơn đã delivered/cancelled không cần hoàn tồn kho.
     *
     * @param id ID đơn hàng cần xóa
     * @throws ResourceNotFoundException nếu không tìm thấy đơn hàng
     */
    @Transactional
    public void delete(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + id));
        // Chỉ hoàn tồn kho nếu đơn chưa hoàn tất — tránh tồn kho bị +2 lần
        boolean needRestoreStock = order.getStatus() == OrderStatus.pending
                || order.getStatus() == OrderStatus.confirmed
                || order.getStatus() == OrderStatus.shipping;
        if (needRestoreStock && order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                Product p = item.getProduct();
                if (p != null) {
                    p.setStockQty(p.getStockQty() + (int) item.getQuantity());
                    p.setSoldQty((int) Math.max(0, p.getSoldQty() - item.getQuantity()));
                    productRepository.save(p);
                }
            }
        }
        orderRepository.delete(order);
    }

    // Cửa sổ hoàn trả: 7 ngày kể từ khi giao hàng
    private static final int RETURN_WINDOW_DAYS = 7;

    /**
     * Khách hàng yêu cầu hoàn trả từng sản phẩm trong đơn đã giao (delivered → return_pending).
     * Lưu trữ: 1 dòng OrderStatusHistory (status=return_pending) chứa JSON ReturnRequestData —
     * không thêm bảng mới. reqCode sinh ra dùng để admin duyệt/từ chối sau này.
     *
     * Kiểm tra: đúng chủ đơn, đơn đang delivered, còn trong hạn 7 ngày kể từ deliveredAt,
     * mỗi sản phẩm chọn phải thuộc đơn và không vượt số lượng còn có thể hoàn trả
     * (đã mua − đã yêu cầu hoàn trả trước đó, gồm cả các yêu cầu đang chờ duyệt).
     *
     * @param orderId ID đơn hàng
     * @param userId  ID user yêu cầu (xác thực quyền sở hữu)
     * @param reason  lý do hoàn trả
     * @param images  danh sách URL ảnh minh chứng (có thể rỗng)
     * @param items   danh sách (orderItemId, qty) sản phẩm muốn hoàn trả
     * @throws BadRequestException nếu không có quyền, đơn sai trạng thái, hết hạn, hoặc vượt số lượng
     */
    @Transactional
    public OrderResponse requestPartialReturn(Long orderId, Long userId, String reason,
                                               List<String> images, List<com.bepgas.dto.request.ReturnRequest.ItemLine> items) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + orderId));
        if (!order.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền yêu cầu hoàn trả đơn hàng này");
        }
        if (order.getStatus() != OrderStatus.delivered) {
            throw new BadRequestException("Chỉ có thể yêu cầu hoàn trả đơn hàng đã giao");
        }
        if (items == null || items.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn ít nhất 1 sản phẩm cần hoàn trả");
        }
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Vui lòng nhập lý do hoàn trả");
        }

        // Tính deadline từ deliveredAt (chính xác hơn updatedAt vì updatedAt thay đổi khi admin sửa)
        java.time.LocalDateTime deliveredAt = order.getDeliveredAt() != null
                ? order.getDeliveredAt() : order.getUpdatedAt();
        if (deliveredAt != null) {
            java.time.LocalDateTime deadline = deliveredAt.plusDays(RETURN_WINDOW_DAYS);
            if (java.time.LocalDateTime.now().isAfter(deadline)) {
                throw new BadRequestException(
                    "Đã hết thời hạn " + RETURN_WINDOW_DAYS + " ngày yêu cầu hoàn trả");
            }
        }

        Map<Long, OrderItem> itemsById = (order.getItems() == null ? List.<OrderItem>of() : order.getItems())
                .stream().collect(Collectors.toMap(OrderItem::getId, i -> i));
        List<OrderStatusHistory> history = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        Map<Long, Long> alreadyReserved = returnRequestHelper.aggregateReturnedQty(history);

        // Tỷ lệ giảm giá coupon trên subtotal — trừ tương ứng vào tiền hoàn từng sản phẩm để
        // hoàn đúng số tiền khách đã thực trả, không hoàn dư phần đã được giảm giá.
        // Phí ship/lắp đặt không nằm trong subtotal nên không bị ảnh hưởng — vẫn không hoàn (chủ ý).
        BigDecimal discountRatio = BigDecimal.ZERO;
        if (order.getDiscountAmount() != null && order.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                && order.getSubtotal() != null && order.getSubtotal().compareTo(BigDecimal.ZERO) > 0) {
            discountRatio = order.getDiscountAmount().divide(order.getSubtotal(), 6, java.math.RoundingMode.HALF_UP);
        }

        List<ReturnRequestData.ReturnItemLine> lines = new ArrayList<>();
        BigDecimal refundAmount = BigDecimal.ZERO;
        for (com.bepgas.dto.request.ReturnRequest.ItemLine reqLine : items) {
            OrderItem item = itemsById.get(reqLine.getOrderItemId());
            if (item == null) {
                throw new BadRequestException("Sản phẩm không thuộc đơn hàng này");
            }
            if (reqLine.getQty() <= 0) {
                throw new BadRequestException("Số lượng hoàn trả phải lớn hơn 0");
            }
            long reserved = alreadyReserved.getOrDefault(item.getId(), 0L);
            if (reserved + reqLine.getQty() > item.getQuantity()) {
                throw new BadRequestException(
                    "Sản phẩm \"" + item.getProductName() + "\" vượt số lượng có thể hoàn trả");
            }
            BigDecimal grossLineRefund = item.getUnitPrice().multiply(BigDecimal.valueOf(reqLine.getQty()));
            BigDecimal lineRefund = grossLineRefund
                    .subtract(grossLineRefund.multiply(discountRatio))
                    .setScale(2, java.math.RoundingMode.HALF_UP);
            refundAmount = refundAmount.add(lineRefund);
            lines.add(ReturnRequestData.ReturnItemLine.builder()
                    .orderItemId(item.getId())
                    .name(item.getProductName())
                    .qty(reqLine.getQty())
                    .unitPrice(item.getUnitPrice())
                    .lineRefund(lineRefund)
                    .build());
        }

        String reqCode = "RTN-" + java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        ReturnRequestData data = ReturnRequestData.builder()
                .type("return_request")
                .reqCode(reqCode)
                .reason(reason)
                .images(images != null ? images : List.of())
                .items(lines)
                .refundAmount(refundAmount)
                .reqStatus("pending")
                .build();

        order.setStatus(OrderStatus.return_pending);
        String firstImage = (images != null && !images.isEmpty()) ? images.get(0) : null;
        historyRepository.save(OrderStatusHistory.builder()
                .order(order).status("return_pending")
                .note(returnRequestHelper.serializeRequest(data))
                .imageUrl(firstImage)
                .build());
        return toResponse(orderRepository.save(order));
    }

    /**
     * Số tiền tối đa có thể hoàn từ việc trả sản phẩm = subtotal − discountAmount (đã trừ mã giảm
     * giá tương ứng). KHÔNG dùng order.getTotalAmount() vì totalAmount còn gồm phí ship/lắp đặt —
     * 2 phí này không bao giờ được hoàn (chủ ý), nên nếu so trực tiếp với totalAmount, đơn có phí
     * ship/lắp đặt sẽ KHÔNG BAO GIỜ đạt paymentStatus=refunded dù đã hoàn hết 100% sản phẩm — mãi
     * kẹt ở partially_refunded một cách sai lệch.
     */
    private BigDecimal refundableProductAmount(Order order) {
        BigDecimal subtotal = order.getSubtotal() != null ? order.getSubtotal() : BigDecimal.ZERO;
        BigDecimal discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
        return subtotal.subtract(discount);
    }

    /**
     * Admin chấp nhận 1 yêu cầu hoàn trả (theo reqCode).
     * Hoàn kho cho đúng các sản phẩm/số lượng trong yêu cầu này nếu restoreStock=true.
     * Hoàn tiền: cộng dồn refundAmount của các yêu cầu đã duyệt+refunded — nếu bằng
     * refundableProductAmount (subtotal đã trừ giảm giá — KHÔNG gồm ship/lắp đặt) thì đặt
     * paymentStatus=refunded (hoàn hết phần sản phẩm), ngược lại partially_refunded (hoàn 1 phần).
     * Order.status sau đó tính lại theo trạng thái thực tế (xem applyOrderStatusFromReturnState).
     *
     * @param orderId      ID đơn hàng
     * @param reqCode      mã yêu cầu hoàn trả cần duyệt
     * @param restoreStock true nếu cộng lại tồn kho cho các sản phẩm trong yêu cầu này
     * @param refunded     true nếu đã chuyển khoản/hoàn tiền cho yêu cầu này (COD unpaid thì bỏ qua)
     * @throws BadRequestException nếu không tìm thấy yêu cầu hoặc yêu cầu đã được xử lý
     */
    @Transactional
    public OrderResponse approveReturnRequest(Long orderId, String reqCode, boolean restoreStock, boolean refunded) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + orderId));

        List<OrderStatusHistory> history = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        ReturnRequestData target = returnRequestHelper.findRequest(history, reqCode);
        if (target == null) {
            throw new BadRequestException("Không tìm thấy yêu cầu hoàn trả: " + reqCode);
        }
        if (returnRequestHelper.isDecided(history, reqCode)) {
            throw new BadRequestException("Yêu cầu hoàn trả này đã được xử lý");
        }

        if (restoreStock) {
            Map<Long, OrderItem> itemsById = (order.getItems() == null ? List.<OrderItem>of() : order.getItems())
                    .stream().collect(Collectors.toMap(OrderItem::getId, i -> i));
            for (ReturnRequestData.ReturnItemLine line : target.getItems()) {
                OrderItem item = itemsById.get(line.getOrderItemId());
                if (item != null && item.getProduct() != null) {
                    Product p = item.getProduct();
                    p.setStockQty((int) (p.getStockQty() + line.getQty()));
                    p.setSoldQty((int) Math.max(0, p.getSoldQty() - line.getQty()));
                    productRepository.save(p);
                }
            }
        }

        // Chỉ hoàn tiền nếu khách đã thanh toán — COD chưa thu giữ nguyên unpaid
        boolean shouldRefund = refunded && order.getPaymentStatus() == PaymentStatus.paid;
        // Siết quy trình: phải upload biên lai chuyển khoản trước, tránh đánh dấu hoàn tiền khống
        if (shouldRefund && (order.getRefundReceiptUrl() == null || order.getRefundReceiptUrl().isBlank())) {
            throw new BadRequestException("Vui lòng upload biên lai chuyển khoản hoàn tiền trước khi đánh dấu đã hoàn tiền");
        }
        String changedBy = resolveAdminName();
        ReturnDecisionData decision = ReturnDecisionData.builder()
                .type("return_decision").reqCode(reqCode)
                .approved(true).restocked(restoreStock).refunded(shouldRefund)
                .build();
        historyRepository.save(OrderStatusHistory.builder()
                .order(order).status("returned")
                .note(returnRequestHelper.serializeDecision(decision))
                .changedBy(changedBy)
                .build());

        if (shouldRefund) {
            // Truy vấn lại để gồm cả dòng quyết định vừa lưu — tính tổng đã hoàn (kể cả yêu cầu này)
            List<OrderStatusHistory> freshHistory = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
            BigDecimal totalRefunded = returnRequestHelper.sumApprovedRefundAmount(freshHistory);
            order.setPaymentStatus(totalRefunded.compareTo(refundableProductAmount(order)) >= 0
                    ? PaymentStatus.refunded : PaymentStatus.partially_refunded);
        }

        applyOrderStatusFromReturnState(order, orderId);
        return toResponse(orderRepository.save(order));
    }

    /**
     * Admin xác nhận đã hoàn tiền cho 1 yêu cầu hoàn trả ĐÃ DUYỆT trước đó nhưng lúc duyệt
     * chưa tick hoàn tiền (VD: chưa có biên lai lúc đó). Append thêm 1 dòng quyết định mới
     * cùng reqCode với refunded=true — dòng mới hơn sẽ "thắng" khi tra cứu (xem
     * ReturnRequestHelper.findDecision), không cần sửa dòng cũ, giữ đúng tính chất append-only.
     *
     * @param orderId ID đơn hàng
     * @param reqCode mã yêu cầu hoàn trả cần xác nhận đã hoàn tiền
     * @throws BadRequestException nếu yêu cầu chưa được duyệt, đã hoàn tiền rồi, hoặc chưa có biên lai
     */
    @Transactional
    public OrderResponse confirmReturnRefund(Long orderId, String reqCode) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + orderId));

        List<OrderStatusHistory> history = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        ReturnDecisionData currentDecision = returnRequestHelper.findDecision(history, reqCode);
        if (currentDecision == null || !currentDecision.isApproved()) {
            throw new BadRequestException("Yêu cầu hoàn trả này chưa được duyệt, không thể xác nhận hoàn tiền");
        }
        if (Boolean.TRUE.equals(currentDecision.getRefunded())) {
            throw new BadRequestException("Yêu cầu hoàn trả này đã được đánh dấu hoàn tiền rồi");
        }
        if (order.getRefundReceiptUrl() == null || order.getRefundReceiptUrl().isBlank()) {
            throw new BadRequestException("Vui lòng upload biên lai chuyển khoản hoàn tiền trước khi xác nhận");
        }

        String changedBy = resolveAdminName();
        ReturnDecisionData updated = ReturnDecisionData.builder()
                .type("return_decision").reqCode(reqCode)
                .approved(true).restocked(currentDecision.getRestocked()).refunded(true)
                .build();
        historyRepository.save(OrderStatusHistory.builder()
                .order(order).status("returned")
                .note(returnRequestHelper.serializeDecision(updated))
                .changedBy(changedBy)
                .build());

        // Tính lại tổng đã hoàn — gồm cả yêu cầu vừa xác nhận
        List<OrderStatusHistory> freshHistory = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        BigDecimal totalRefunded = returnRequestHelper.sumApprovedRefundAmount(freshHistory);
        order.setPaymentStatus(totalRefunded.compareTo(refundableProductAmount(order)) >= 0
                ? PaymentStatus.refunded : PaymentStatus.partially_refunded);

        return toResponse(orderRepository.save(order));
    }

    /**
     * Admin từ chối 1 yêu cầu hoàn trả (theo reqCode). Không đụng tồn kho/tiền.
     * Order.status tính lại: nếu còn yêu cầu khác đang chờ thì vẫn return_pending,
     * không thì quay về delivered (hoặc returned nếu các yêu cầu khác đã trả hết sản phẩm).
     *
     * @param orderId ID đơn hàng
     * @param reqCode mã yêu cầu hoàn trả cần từ chối
     * @param reason  lý do từ chối
     * @throws BadRequestException nếu không tìm thấy yêu cầu hoặc yêu cầu đã được xử lý
     */
    @Transactional
    public OrderResponse rejectReturnRequest(Long orderId, String reqCode, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Vui lòng nhập lý do từ chối");
        }
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + orderId));

        List<OrderStatusHistory> history = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        if (returnRequestHelper.findRequest(history, reqCode) == null) {
            throw new BadRequestException("Không tìm thấy yêu cầu hoàn trả: " + reqCode);
        }
        if (returnRequestHelper.isDecided(history, reqCode)) {
            throw new BadRequestException("Yêu cầu hoàn trả này đã được xử lý");
        }

        String changedBy = resolveAdminName();
        ReturnDecisionData decision = ReturnDecisionData.builder()
                .type("return_decision").reqCode(reqCode)
                .approved(false).rejectReason(reason)
                .build();
        historyRepository.save(OrderStatusHistory.builder()
                .order(order).status("delivered")
                .note(returnRequestHelper.serializeDecision(decision))
                .changedBy(changedBy)
                .build());

        applyOrderStatusFromReturnState(order, orderId);
        return toResponse(orderRepository.save(order));
    }

    /**
     * Tính lại Order.status dựa trên trạng thái thực tế các yêu cầu hoàn trả (giải pháp lai):
     * còn ≥1 yêu cầu đang chờ duyệt → return_pending; không còn pending nhưng đã trả hết
     * toàn bộ số lượng mọi sản phẩm → returned; còn lại → delivered (FE tự hiện badge
     * "Đang hoàn trả N sản phẩm" dựa trên parse JSON, không cần thêm cột DB).
     * Gọi SAU KHI đã lưu dòng quyết định mới nhất để truy vấn lại thấy đúng dữ liệu.
     */
    private void applyOrderStatusFromReturnState(Order order, Long orderId) {
        List<OrderStatusHistory> freshHistory = historyRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        if (!returnRequestHelper.getPendingRequests(freshHistory).isEmpty()) {
            order.setStatus(OrderStatus.return_pending);
            return;
        }
        Map<Long, Long> returnedQty = returnRequestHelper.aggregateReturnedQty(freshHistory);
        boolean allReturned = (order.getItems() == null ? List.<OrderItem>of() : order.getItems()).stream()
                .allMatch(item -> returnedQty.getOrDefault(item.getId(), 0L) >= item.getQuantity());
        order.setStatus(allReturned ? OrderStatus.returned : OrderStatus.delivered);
    }

    /**
     * Top sản phẩm bán chạy tính từ đơn đã giao trong khoảng thời gian.
     * Dùng lại findByFilters (không thêm SQL mới) — tổng hợp bằng Java streams.
     * N+1 items là chấp nhận được vì dashboard gọi thỉnh thoảng và số đơn mỗi kỳ nhỏ.
     * Đơn hủy và đơn hoàn trả toàn phần đã tự loại vì không có status=delivered; riêng đơn
     * hoàn trả TỪNG PHẦN vẫn giữ status=delivered nên phải trừ thủ công số lượng đã hoàn
     * (đã được duyệt) khỏi từng dòng sản phẩm — nếu không sẽ tính dư cả số lượng và doanh thu.
     */
    @Transactional(readOnly = true)
    public List<TopProductDTO> getTopSellingFromOrders(String fromDate, String toDate, int limit) {
        java.time.LocalDateTime fromDt = (fromDate != null && !fromDate.isBlank())
                ? LocalDate.parse(fromDate).atStartOfDay() : null;
        java.time.LocalDateTime toDt = (toDate != null && !toDate.isBlank())
                ? LocalDate.parse(toDate).plusDays(1).atStartOfDay() : null;

        // Lấy tối đa 500 đơn đã giao trong khoảng — @Transactional giữ session để lazy-load items
        Page<Order> page = orderRepository.findByFilters(
                OrderStatus.delivered, null, null, fromDt, toDt,
                PageRequest.of(0, 500));

        // Tổng hợp theo productId (null nếu sản phẩm đã bị xóa khỏi DB)
        Map<Long, TopProductDTO> acc = new LinkedHashMap<>();
        for (Order o : page.getContent()) {
            if (o.getItems() == null) continue;

            // Số lượng đã hoàn trả (được duyệt) theo từng order_item_id của đơn này
            Map<Long, Long> returnedQty = returnRequestHelper.aggregateReturnedQty(
                    historyRepository.findByOrderIdOrderByCreatedAtAsc(o.getId()));

            for (OrderItem item : o.getItems()) {
                long soldQty = item.getQuantity() - returnedQty.getOrDefault(item.getId(), 0L);
                if (soldQty <= 0) continue; // dòng này đã được hoàn trả hết, không tính là đã bán

                Long pid = item.getProduct() != null ? item.getProduct().getId() : null;
                String key_name = item.getProductName();
                Long key = pid != null ? pid : (long) key_name.hashCode();

                acc.merge(key, TopProductDTO.builder()
                        .productId(pid)
                        .productName(key_name)
                        .productImage(item.getProductImage())
                        .slug(item.getProduct() != null ? item.getProduct().getSlug() : null)
                        .totalQty(soldQty)
                        .totalRevenue(item.getUnitPrice()
                                .multiply(BigDecimal.valueOf(soldQty)))
                        .status(item.getProduct() != null
                                ? item.getProduct().getStatus().name() : "deleted")
                        .stockQty(item.getProduct() != null
                                ? item.getProduct().getStockQty() : 0)
                        .build(),
                    (existing, incoming) -> {
                        existing.setTotalQty(existing.getTotalQty() + incoming.getTotalQty());
                        existing.setTotalRevenue(existing.getTotalRevenue()
                                .add(incoming.getTotalRevenue()));
                        return existing;
                    });
            }
        }

        return acc.values().stream()
                .sorted(Comparator.comparingLong(TopProductDTO::getTotalQty).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }

    /** Nếu changedBy là email cũ, lookup và trả về "Tên (Quyền)". Không thay đổi nếu đã là tên. */
    private String enrichChangedBy(String changedBy) {
        if (changedBy == null || !changedBy.contains("@")) return changedBy;
        return userRepository.findByEmail(changedBy).map(u -> {
            String name = u.getFullName() != null ? u.getFullName() : changedBy;
            String role = u.getRole() == com.bepgas.entity.Role.admin ? "Quản trị viên" : "Nhân viên";
            return name + " (" + role + ")";
        }).orElse(changedBy);
    }

    /** Lấy "Tên (Quyền)" của admin/staff đang đăng nhập. */
    private String resolveAdminName() {
        String email = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).map(u -> {
            String name = u.getFullName() != null ? u.getFullName() : email;
            String role = u.getRole() == com.bepgas.entity.Role.admin ? "Quản trị viên" : "Nhân viên";
            return name + " (" + role + ")";
        }).orElse(email);
    }
}
