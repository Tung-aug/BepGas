package com.bepgas.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Binding cấu hình JWT từ application.properties.
 * jwt.secret     — secret key ký JWT (phải đủ dài, >=32 ký tự cho HS256)
 * jwt.expiration — thời hạn token tính bằng milliseconds (ví dụ: 86400000 = 24 giờ)
 * Được inject vào JwtTokenProvider qua @Value.
 */
@Configuration
@ConfigurationProperties(prefix = "jwt")
@Data
public class JwtConfig {
    private String secret;
    private long expiration;
}
