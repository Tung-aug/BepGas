package com.bepgas.controller;

import com.bepgas.dto.request.OrderRequest;
import com.bepgas.dto.response.ApiResponse;
import com.bepgas.dto.response.OrderResponse;
import com.bepgas.entity.User;
import com.bepgas.service.OrderService;
import com.bepgas.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API đơn hàng dành cho khách hàng.
 * Base URL: /api/orders — yêu cầu JWT (authenticated).
 * GET    /api/orders         — danh sách đơn của tôi (phân trang)
 * GET    /api/orders/{id}    — chi tiết đơn hàng (kiểm tra chủ sở hữu)
 * POST   /api/orders         — tạo đơn hàng mới
 * PUT    /api/orders/{id}/cancel         — khách tự hủy đơn
 * PUT    /api/orders/{id}/return-request — khách yêu cầu hoàn trả
 * (Admin endpoints nằm ở AdminController — đây là nguồn sự thật duy nhất cho thao tác admin)
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final UserService userService;

    /**
     * Lấy danh sách đơn hàng của user hiện tại (phân trang, sort mới nhất lên đầu).
     *
     * @param userDetails thông tin user từ JWT (inject tự động)
     * @param pageable    thông tin phân trang từ query params (?page=0&size=10)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<OrderResponse>>> getMyOrders(
            @AuthenticationPrincipal UserDetails userDetails,
            Pageable pageable) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyOrders(user.getId(), pageable)));
    }

    /**
     * Lấy chi tiết đơn hàng. OrderService kiểm tra đơn phải thuộc về user hiện tại.
     *
     * @param id          ID đơn hàng
     * @param userDetails thông tin user từ JWT
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(orderService.getById(id, user.getId())));
    }

    /**
     * Tạo đơn hàng mới từ các sản phẩm đã chọn trong giỏ hàng.
     * OrderService sẽ trừ tồn kho, tính phí, áp coupon và xóa cart items đã đặt.
     *
     * @param userDetails thông tin user từ JWT
     * @param request     danh sách sản phẩm, địa chỉ giao, phương thức thanh toán...
     */
    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> create(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody OrderRequest request) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Đặt hàng thành công",
                orderService.create(user.getId(), request)));
    }

    /**
     * Khách tự hủy đơn hàng (chỉ được hủy khi pending hoặc confirmed).
     * Tồn kho sẽ được hoàn lại sau khi hủy.
     *
     * @param id          ID đơn hàng cần hủy
     * @param body        JSON có thể chứa "reason" (lý do hủy, optional)
     * @param userDetails thông tin user từ JWT
     */
    @PutMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> cancel(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(ApiResponse.success("Hủy đơn hàng thành công",
                orderService.cancel(id, user.getId(), reason)));
    }

    /**
     * Khách yêu cầu hoàn trả từng sản phẩm trong đơn đã giao (trong 7 ngày kể từ deliveredAt).
     * Ảnh minh chứng upload lên ImgBB từ phía frontend trước khi gọi API này.
     *
     * @param id          ID đơn hàng cần hoàn trả
     * @param request     { reason, images:[..], items:[{orderItemId, qty}, ...] }
     * @param userDetails thông tin user từ JWT
     */
    @PostMapping("/{id}/return-request")
    public ResponseEntity<ApiResponse<OrderResponse>> requestReturn(
            @PathVariable Long id,
            @Valid @RequestBody com.bepgas.dto.request.ReturnRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Đã gửi yêu cầu hoàn trả",
                orderService.requestPartialReturn(id, user.getId(), request.getReason(),
                        request.getImages(), request.getItems())));
    }

}
