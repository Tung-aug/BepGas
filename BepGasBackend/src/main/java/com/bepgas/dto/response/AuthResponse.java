package com.bepgas.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response sau khi đăng nhập/đăng ký thành công.
 * Frontend lưu token vào localStorage để gửi kèm mọi request sau trong header:
 * Authorization: Bearer <token>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;           // JWT để xác thực các request tiếp theo
    @Builder.Default
    private String type = "Bearer"; // Loại token — luôn là "Bearer" theo chuẩn OAuth2
    private Long   userId;          // ID user — dùng để fetch thêm dữ liệu nếu cần
    private String fullName;        // Tên hiển thị trên header/avatar
    private String email;           // Email đăng nhập
    private String phone;           // Số điện thoại
    private String role;            // "customer" / "admin" / "staff" — điều hướng frontend sang đúng dashboard
}
