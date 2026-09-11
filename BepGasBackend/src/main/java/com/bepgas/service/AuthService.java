package com.bepgas.service;

import com.bepgas.dto.request.LoginRequest;
import com.bepgas.dto.request.RegisterRequest;
import com.bepgas.dto.response.AuthResponse;
import com.bepgas.entity.Role;
import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.repository.UserRepository;
import com.bepgas.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Xử lý nghiệp vụ đăng ký và đăng nhập.
 * Tích hợp rate limiting in-memory (ConcurrentHashMap) để chống brute-force:
 * sai 5 lần → khóa 15 phút. Lưu ý: rate limit mất khi restart server (không persist DB).
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;

    /* ── Rate limiting: giới hạn đăng nhập sai nhiều lần ── */
    private static final int  MAX_FAILED   = 5;        // số lần sai tối đa trước khi khóa
    private static final long LOCKOUT_SECS = 15 * 60;  // thời gian khóa: 15 phút

    // Lưu số lần sai theo email — ConcurrentHashMap để thread-safe khi nhiều request đồng thời
    private final Map<String, Integer> failedAttempts = new ConcurrentHashMap<>();
    // Lưu thời điểm hết khóa theo email
    private final Map<String, Instant> lockedUntil    = new ConcurrentHashMap<>();

    /**
     * Kiểm tra xem email có đang bị khóa không.
     * Nếu đang trong thời gian khóa → ném lỗi kèm số phút còn lại.
     *
     * @param email email cần kiểm tra
     * @throws BadRequestException nếu tài khoản đang bị khóa
     */
    private void checkRateLimit(String email) {
        Instant locked = lockedUntil.get(email);
        if (locked != null && Instant.now().isBefore(locked)) {
            long secs = locked.getEpochSecond() - Instant.now().getEpochSecond();
            throw new BadRequestException(
                "Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau "
                + (secs / 60 + 1) + " phút.");
        }
    }

    /**
     * Ghi nhận một lần đăng nhập sai.
     * Khi đạt MAX_FAILED → đặt thời điểm khóa, xóa bộ đếm (để reset sau khi hết khóa).
     *
     * @param email email vừa đăng nhập sai
     */
    private void recordFailure(String email) {
        int attempts = failedAttempts.merge(email, 1, Integer::sum); // tăng đếm +1
        if (attempts >= MAX_FAILED) {
            lockedUntil.put(email, Instant.now().plusSeconds(LOCKOUT_SECS));
            failedAttempts.remove(email); // xóa bộ đếm để khi hết khóa bắt đầu lại từ 0
        }
    }

    /**
     * Xóa toàn bộ bộ đếm lỗi sau khi đăng nhập thành công.
     *
     * @param email email đăng nhập thành công
     */
    private void clearFailures(String email) {
        failedAttempts.remove(email);
        lockedUntil.remove(email);
    }

    /**
     * Đăng ký tài khoản mới.
     * Kiểm tra email chưa tồn tại, mã hóa mật khẩu BCrypt, gán role customer mặc định,
     * trả về JWT để client đăng nhập ngay không cần bước xác nhận.
     *
     * @param request thông tin đăng ký (fullName, email, password, phone)
     * @return AuthResponse chứa JWT + thông tin user
     * @throws BadRequestException nếu email đã tồn tại
     */
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email đã được sử dụng");
        }

        // Chuẩn hoá phone: bỏ khoảng trắng (người dùng có thể nhập "0912 345 678")
        String phone = request.getPhone() != null
                ? request.getPhone().replaceAll("\\s+", "")
                : null;

        User user = User.builder()
                .fullName(request.getFullName().trim())
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(phone)
                .role(Role.customer)
                .build();

        userRepository.save(user);
        String token = jwtTokenProvider.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .build();
    }

    /**
     * Đăng nhập và trả về JWT.
     * Luồng xử lý:
     * 1. Normalize email (trim + lowercase)
     * 2. Kiểm tra rate limit — nếu đang khóa thì reject ngay
     * 3. Dùng AuthenticationManager xác thực username/password
     *    - DisabledException: admin đã khóa tài khoản (enabled=false)
     *    - BadCredentialsException: sai mật khẩu → recordFailure, báo số lần còn lại
     * 4. Đăng nhập thành công → clearFailures, sinh JWT
     *
     * @param request thông tin đăng nhập (email, password)
     * @return AuthResponse chứa JWT + thông tin user
     * @throws BadRequestException nếu bị khóa rate limit, tài khoản disabled, hoặc sai credentials
     */
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase(); // normalize để rate limit theo email nhất quán

        // Kiểm tra rate limit trước khi authenticate — tránh tốn tài nguyên DB khi đang khóa
        checkRateLimit(email);

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getPassword())
            );
        } catch (DisabledException e) {
            // Tài khoản bị admin disable (enabled=false trong DB) — không tính vào rate limit
            throw new BadRequestException("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
        } catch (BadCredentialsException e) {
            // Sai mật khẩu — tăng bộ đếm, tính số lần còn lại để thông báo cho user
            recordFailure(email);
            int remaining = MAX_FAILED - failedAttempts.getOrDefault(email, 0);
            if (remaining <= 0) {
                throw new BadRequestException(
                    "Đăng nhập sai quá nhiều lần. Tài khoản bị khóa 15 phút.");
            }
            throw new BadRequestException(
                "Email hoặc mật khẩu không đúng. Còn " + remaining + " lần thử.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Tài khoản không tồn tại"));

        // Đăng nhập thành công — xóa bộ đếm lỗi để không bị ảnh hưởng ở lần sau
        clearFailures(email);

        // Sinh JWT từ email (là username trong Spring Security)
        String token = jwtTokenProvider.generateToken(authentication.getName());

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .build();
    }
}
