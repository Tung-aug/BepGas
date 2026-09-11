package com.bepgas.controller;

import com.bepgas.dto.request.LoginRequest;
import com.bepgas.dto.request.RegisterRequest;
import com.bepgas.dto.response.ApiResponse;
import com.bepgas.dto.response.AuthResponse;
import com.bepgas.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API xác thực người dùng.
 * Base URL: /api/auth — public (không cần JWT).
 * POST /api/auth/register — đăng ký tài khoản mới.
 * POST /api/auth/login    — đăng nhập, trả về JWT.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Đăng ký tài khoản mới.
     * Validate request với @Valid trước khi gọi service.
     * Trả về JWT ngay để client đăng nhập không cần bước xác nhận email.
     *
     * @param request thông tin đăng ký (fullName, email, password, phone)
     * @return AuthResponse chứa JWT + thông tin user
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đăng ký thành công", authService.register(request)));
    }

    /**
     * Đăng nhập và nhận JWT.
     * AuthService xử lý rate limiting và các lỗi credentials.
     *
     * @param request thông tin đăng nhập (email, password)
     * @return AuthResponse chứa JWT + thông tin user
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đăng nhập thành công", authService.login(request)));
    }
}
