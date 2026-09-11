package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Order;
import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.OrderRepository;
import com.bepgas.service.OrderService;
import com.bepgas.service.UserService;
import com.bepgas.service.VNPayService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

/**
 * REST API tích hợp thanh toán VNPay.
 * Base URL: /api/payment
 *
 * POST /api/payment/vnpay/create/{orderId} — tạo URL thanh toán (cần JWT)
 * GET  /api/payment/vnpay-callback          — VNPay redirect trình duyệt sau thanh toán (public)
 * GET  /api/payment/vnpay-ipn               — VNPay gọi server-to-server (public)
 * GET  /api/payment/status/{orderId}        — kiểm tra trạng thái thanh toán (cần JWT)
 *
 * callback và ipn phải public vì VNPay không có JWT — bảo mật bằng HMAC-SHA512.
 */
@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final VNPayService    vnPayService;
    private final OrderRepository orderRepository;
    private final OrderService    orderService;
    private final UserService     userService;

    /**
     * Tạo URL thanh toán VNPay cho đơn hàng.
     * Yêu cầu: user đã đăng nhập và là chủ đơn hàng.
     * Frontend nhận URL rồi redirect sang VNPay để khách nhập thông tin thẻ.
     *
     * @param orderId     ID đơn hàng cần thanh toán
     * @param userDetails thông tin user từ JWT
     * @param request     HTTP request gốc (để lấy IP tạo chữ ký VNPay)
     * @return URL thanh toán VNPay đầy đủ
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/vnpay/create/{orderId}")
    public ResponseEntity<ApiResponse<String>> createPayment(
            @PathVariable Long orderId,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest request) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + orderId));

        // Xác thực chủ đơn — tránh user A tạo URL thanh toán đơn của user B
        User currentUser = userService.getByEmail(userDetails.getUsername());
        if (!order.getUser().getId().equals(currentUser.getId())) {
            throw new BadRequestException("Không có quyền thanh toán đơn hàng này");
        }

        long   amount = order.getTotalAmount().longValue();
        String info   = "Thanh toan don hang " + order.getOrderCode();
        String payUrl = vnPayService.createPaymentUrl(orderId, amount, info, request);

        return ResponseEntity.ok(ApiResponse.success(payUrl));
    }

    /**
     * VNPay callback — endpoint công khai để VNPay redirect trình duyệt khách về đây sau thanh toán.
     * Giữ public (không cần JWT) vì VNPay redirect browser, không có token.
     * Bảo mật bằng HMAC-SHA512: validateResponse() xác thực signature trước khi xử lý.
     *
     * Đường này KHÔNG đáng tin cậy để chốt trạng thái đơn một mình — khách có thể đóng tab,
     * mất mạng, hoặc bấm back nên callback có thể không bao giờ về tới server. Vì vậy logic
     * cập nhật đơn (set paid/confirmed hoặc cancel+restore) được gộp vào
     * OrderService.processVnpayResult(), dùng CHUNG với IPN (đường đáng tin cậy hơn vì
     * VNPay gọi trực tiếp server-to-server) — ai đến trước thì xử lý, ai đến sau là no-op
     * nhờ kiểm tra idempotent trong processVnpayResult.
     *
     * @param params  query params từ VNPay (chứa vnp_ResponseCode, vnp_TxnRef, vnp_SecureHash...)
     * @param response HTTP response để redirect về frontend
     */
    @GetMapping("/vnpay-callback")
    public void vnpayCallback(
            @RequestParam Map<String, String> params,
            HttpServletResponse response) throws IOException {

        String frontendBase = "http://localhost:5173/payment/return";
        boolean valid       = vnPayService.validateResponse(params);

        if (!valid) {
            response.sendRedirect(frontendBase + "?status=invalid");
            return;
        }

        String responseCode = params.get("vnp_ResponseCode");
        // TxnRef format: orderId_timestamp → lấy phần trước "_" để ra orderId
        String txnRef    = params.get("vnp_TxnRef");
        String amountStr = params.get("vnp_Amount");

        Long orderId;
        long vnpAmount;
        try {
            orderId   = Long.parseLong(txnRef.split("_")[0]);
            vnpAmount = Long.parseLong(amountStr);
        } catch (Exception e) {
            response.sendRedirect(frontendBase + "?status=error");
            return;
        }

        if ("00".equals(responseCode)) {
            OrderService.VnpayResult result = orderService.processVnpayResult(orderId, responseCode, vnpAmount);
            if (result == OrderService.VnpayResult.PAID || result == OrderService.VnpayResult.ALREADY_PROCESSED) {
                Order order = orderRepository.findById(orderId).orElse(null);
                String code = order != null ? order.getOrderCode() : "";
                response.sendRedirect(frontendBase + "?status=success&orderId=" + orderId + "&code=" + code);
            } else {
                // Số tiền không khớp hoặc không tìm thấy đơn — đáng ngờ, không xác nhận thành công
                response.sendRedirect(frontendBase + "?status=error");
            }
        } else {
            // Thất bại/hủy — dọn đơn nếu còn (an toàn nếu IPN đã dọn trước: processVnpayResult no-op)
            orderService.processVnpayResult(orderId, responseCode, vnpAmount);
            response.sendRedirect(frontendBase + "?status=failed&code=" + responseCode);
        }
    }

    /**
     * VNPay IPN (Instant Payment Notification) — server-to-server callback.
     * VNPay gọi endpoint này trực tiếp từ server của họ để thông báo kết quả thanh toán.
     * Phải trả JSON theo đúng format VNPay quy định (RspCode + Message).
     * Public vì VNPay không có JWT; bảo mật bằng HMAC-SHA512.
     *
     * Đây là đường đáng tin cậy hơn callback (server-to-server, không phụ thuộc trình duyệt
     * khách), nhưng để chạy được ở localhost cần VNPay gọi tới được — môi trường dev hiện tại
     * dùng callback (qua return-url) làm đường chính. Dùng chung
     * OrderService.processVnpayResult() với callback để đảm bảo nhất quán và idempotent.
     *
     * @param params query params từ VNPay
     * @return JSON { RspCode, Message } theo spec VNPay
     */
    @GetMapping("/vnpay-ipn")
    public ResponseEntity<Map<String, String>> vnpayIpn(
            @RequestParam Map<String, String> params) {

        boolean valid = vnPayService.validateResponse(params);
        if (!valid) {
            return ResponseEntity.ok(Map.of("RspCode", "97", "Message", "Invalid signature"));
        }

        String responseCode = params.get("vnp_ResponseCode");
        String txnRef    = params.get("vnp_TxnRef");
        String amountStr = params.get("vnp_Amount"); // đã nhân 100

        Long orderId;
        long vnpAmount;
        try {
            orderId   = Long.parseLong(txnRef.split("_")[0]);
            vnpAmount = Long.parseLong(amountStr);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("RspCode", "01", "Message", "Order not found"));
        }

        OrderService.VnpayResult result = orderService.processVnpayResult(orderId, responseCode, vnpAmount);
        return switch (result) {
            case ORDER_NOT_FOUND   -> ResponseEntity.ok(Map.of("RspCode", "01", "Message", "Order not found"));
            case ALREADY_PROCESSED -> ResponseEntity.ok(Map.of("RspCode", "02", "Message", "Order already confirmed"));
            case AMOUNT_MISMATCH   -> ResponseEntity.ok(Map.of("RspCode", "04", "Message", "Invalid amount"));
            case PAID, FAILED      -> ResponseEntity.ok(Map.of("RspCode", "00", "Message", "Confirm Success"));
        };
    }

    /**
     * Kiểm tra trạng thái thanh toán của đơn hàng.
     * Dùng bởi trang PaymentReturn để hiển thị kết quả sau khi VNPay redirect về.
     * Chỉ chủ đơn hàng mới được xem.
     *
     * @param orderId     ID đơn hàng cần kiểm tra
     * @param userDetails thông tin user từ JWT
     * @return thông tin trạng thái đơn và thanh toán
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/status/{orderId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPaymentStatus(
            @PathVariable Long orderId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hàng: " + orderId));

        User currentUser = userService.getByEmail(userDetails.getUsername());
        if (!order.getUser().getId().equals(currentUser.getId())) {
            throw new BadRequestException("Không có quyền xem thông tin đơn hàng này");
        }

        Map<String, Object> data = Map.of(
                "orderId",       order.getId(),
                "orderCode",     order.getOrderCode(),
                "orderStatus",   order.getStatus().name(),
                "paymentStatus", order.getPaymentStatus().name(),
                "paymentMethod", order.getPaymentMethod() != null ? order.getPaymentMethod().name() : "cod",
                "totalAmount",   order.getTotalAmount()
        );

        return ResponseEntity.ok(ApiResponse.success(data));
    }
}
