package com.bepgas.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Dữ liệu gửi lên khi đăng ký tài khoản — POST /api/auth/register.
 * Tất cả validate được @Valid + Spring Validation xử lý trước khi vào AuthService.
 */
@Data
public class RegisterRequest {

    @NotBlank // Họ tên không được để trống
    private String fullName;

    @NotBlank
    @Email // Phải đúng định dạng email (có @ và domain)
    private String email;

    @NotBlank
    @Size(min = 6) // Mật khẩu tối thiểu 6 ký tự
    private String password;

    // Số điện thoại không bắt buộc nhưng nếu nhập phải đúng định dạng VN (10 số, đầu 03x–09x)
    @Pattern(regexp = "^0[3-9][0-9]{8}$", message = "Số điện thoại không hợp lệ (đầu số 03x–09x, đủ 10 chữ số)")
    private String phone;
}
