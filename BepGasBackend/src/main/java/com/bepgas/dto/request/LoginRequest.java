package com.bepgas.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Dữ liệu gửi lên khi đăng nhập — POST /api/auth/login.
 * @NotBlank: Spring Validation tự trả 400 nếu field trống, trước khi vào AuthService.
 */
@Data
public class LoginRequest {

    @NotBlank // email không được để trống
    private String email;

    @NotBlank // password không được để trống
    private String password;
}
