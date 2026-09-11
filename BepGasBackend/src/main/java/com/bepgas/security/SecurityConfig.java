package com.bepgas.security;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.beans.factory.annotation.Value;
import java.util.Arrays;
import java.util.List;

/**
 * Cấu hình Spring Security cho toàn bộ ứng dụng.
 * - JWT stateless (không session): CSRF disabled, SessionCreationPolicy.STATELESS.
 * - CORS: cho phép các origin từ cấu hình cors.allowed-origins (mặc định localhost:5173,5174).
 * - Phân quyền: PUBLIC_APIS mở hoàn toàn; /api/admin/** phân chia ADMIN/STAFF theo HTTP method;
 *   còn lại yêu cầu authenticated.
 * - @EnableMethodSecurity: cho phép @PreAuthorize trên từng endpoint/method.
 * - authenticationEntryPoint: trả JSON 401 thay vì redirect sang trang login.
 * - accessDeniedHandler: trả JSON 403 thay vì trang lỗi mặc định.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter      jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    // API công khai — không cần JWT, mọi user đều truy cập được
    private static final String[] PUBLIC_APIS = {
        "/api/auth/**",
        "/api/products/**",
        "/api/categories/**",
        "/api/brands/**",
        "/api/banners/**",
        "/api/reviews/product/**",
        "/api/payment/**",
        "/v3/api-docs/**",
        "/swagger-ui/**",
        "/error"
    };

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(PUBLIC_APIS).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ── STAFF: đọc đơn hàng, khách hàng, đánh giá ──
                // Dashboard và dữ liệu thống kê sản phẩm là admin-only
                .requestMatchers(HttpMethod.GET,
                    "/api/admin/orders",
                    "/api/admin/orders/*",
                    "/api/admin/users",
                    "/api/admin/users/*/addresses",
                    "/api/admin/reviews"
                ).hasAnyRole("ADMIN", "STAFF")

                // ── STAFF: cập nhật trạng thái đơn, xác nhận COD, hoàn trả ──
                .requestMatchers(HttpMethod.PUT,
                    "/api/admin/orders/*/status",
                    "/api/admin/orders/*/confirm-payment",
                    "/api/admin/orders/*/approve-return",
                    "/api/admin/orders/*/reject-return",
                    "/api/admin/users/*/toggle-lock",
                    "/api/admin/users/*/addresses/*",
                    "/api/admin/users/*/addresses/*/default",
                    "/api/admin/reviews/*/toggle-visible",
                    "/api/admin/reviews/*/reply"
                ).hasAnyRole("ADMIN", "STAFF")

                // ── STAFF: upload biên lai thanh toán / hoàn tiền ──
                .requestMatchers(HttpMethod.POST, "/api/admin/orders/*/payment-receipt")
                    .hasAnyRole("ADMIN", "STAFF")
                .requestMatchers(HttpMethod.POST, "/api/admin/orders/*/refund-receipt")
                    .hasAnyRole("ADMIN", "STAFF")

                // ── STAFF: quản lý địa chỉ khách hàng ──
                .requestMatchers(HttpMethod.POST,  "/api/admin/users/*/addresses")
                    .hasAnyRole("ADMIN", "STAFF")
                .requestMatchers(HttpMethod.DELETE, "/api/admin/users/*/addresses/*")
                    .hasAnyRole("ADMIN", "STAFF")

                // ── ADMIN ONLY: tất cả còn lại trong /api/admin/** ──
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write(
                        "{\"success\":false,\"message\":\"Bạn cần đăng nhập để thực hiện thao tác này\"}"
                    );
                })
                .accessDeniedHandler((req, res, e) -> {
                    res.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write(
                        "{\"success\":false,\"message\":\"Bạn không có quyền thực hiện thao tác này\"}"
                    );
                })
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:5174}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
