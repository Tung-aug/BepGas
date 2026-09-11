package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Address;
import com.bepgas.entity.User;
import com.bepgas.service.AddressService;
import com.bepgas.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API sổ địa chỉ giao hàng của người dùng.
 * Base URL: /api/addresses — yêu cầu JWT (authenticated).
 * GET    /api/addresses         — lấy tất cả địa chỉ của tôi
 * POST   /api/addresses         — thêm địa chỉ mới
 * PUT    /api/addresses/{id}    — cập nhật địa chỉ
 * DELETE /api/addresses/{id}    — xóa địa chỉ
 * PUT    /api/addresses/{id}/default — đặt làm địa chỉ mặc định
 * Admin quản lý địa chỉ user qua AdminController (/api/admin/users/{userId}/addresses).
 */
@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
public class AddressController {

    private final AddressService addressService;
    private final UserService userService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Address>>> getMyAddresses(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(addressService.getByUser(user.getId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Address>> create(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Address address) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Thêm địa chỉ thành công",
                addressService.create(user.getId(), address)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Address>> update(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Address address) {
        User user = userService.getByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                addressService.update(id, user.getId(), address)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        addressService.delete(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Xóa địa chỉ thành công", null));
    }

    @PutMapping("/{id}/default")
    public ResponseEntity<ApiResponse<Void>> setDefault(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getByEmail(userDetails.getUsername());
        addressService.setDefault(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Đã đặt làm địa chỉ mặc định", null));
    }
}
