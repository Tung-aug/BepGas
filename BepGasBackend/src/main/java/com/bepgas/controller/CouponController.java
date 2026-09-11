package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Coupon;
import com.bepgas.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * REST API mã giảm giá.
 * Base URL: /api/coupons
 * Public : POST /api/coupons/validate — kiểm tra coupon và tính tiền giảm (dùng tại checkout)
 * Admin  : GET / (tất cả), POST / (tạo), PUT /{id} (sửa), DELETE /{id} (xóa)
 */
@RestController
@RequestMapping("/api/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<BigDecimal>> validate(@RequestBody Map<String, String> body) {
        String code     = body.get("code");
        String totalStr = body.get("orderTotal");
        if (code == null || code.isBlank())
            throw new com.bepgas.exception.BadRequestException("Thiếu mã coupon");
        BigDecimal orderTotal;
        try {
            orderTotal = new BigDecimal(totalStr == null ? "" : totalStr.trim());
            if (orderTotal.compareTo(BigDecimal.ZERO) < 0) throw new NumberFormatException();
        } catch (NumberFormatException e) {
            throw new com.bepgas.exception.BadRequestException("Tổng đơn hàng không hợp lệ");
        }
        BigDecimal discount = couponService.validate(code, orderTotal);
        return ResponseEntity.ok(ApiResponse.success("Coupon hợp lệ", discount));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Coupon>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(couponService.getAll()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Coupon>> create(@RequestBody Coupon coupon) {
        return ResponseEntity.ok(ApiResponse.success("Tạo coupon thành công",
                couponService.create(coupon)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Coupon>> update(
            @PathVariable Long id,
            @RequestBody Coupon coupon) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                couponService.update(id, coupon)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        couponService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa coupon thành công", null));
    }
}
