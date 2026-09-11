package com.bepgas.security;

import com.bepgas.entity.User;
import com.bepgas.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Implementation của UserDetailsService dùng bởi Spring Security.
 * Load thông tin user từ DB theo email (được dùng làm username).
 * Được gọi bởi AuthenticationManager khi đăng nhập và bởi JwtAuthFilter khi xác thực token.
 */
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Load UserDetails theo email.
     * Authorities được map từ Role enum: customer → ROLE_CUSTOMER, admin → ROLE_ADMIN, staff → ROLE_STAFF.
     * disabled(!enabled): nếu admin khóa tài khoản (enabled=false) → Spring Security ném DisabledException
     * khi authenticate, AuthService bắt và trả lỗi "Tài khoản bị khóa".
     *
     * @param email email (username) cần load
     * @return UserDetails đầy đủ để Spring Security xác thực
     * @throws UsernameNotFoundException nếu email không tồn tại trong DB
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy user: " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                // Convention Spring Security: role phải có prefix ROLE_
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name().toUpperCase())))
                .disabled(!user.isEnabled()) // enabled=false → DisabledException khi authenticate
                .build();
    }
}
