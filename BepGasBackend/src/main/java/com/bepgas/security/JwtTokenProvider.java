package com.bepgas.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

/**
 * Tạo và xác thực JWT (JSON Web Token).
 * Thuật toán: HS256 (HMAC-SHA256).
 * Cấu hình (application.properties): jwt.secret, jwt.expiration (milliseconds).
 * Subject của token là email người dùng (username trong Spring Security).
 */
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret;        // secret key, cần đủ dài (>=256 bit cho HS256)

    @Value("${jwt.expiration}")
    private long jwtExpiration;      // thời hạn token tính bằng milliseconds

    /** Tạo signing key từ secret, dùng chung cho cả generate và validate. */
    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    /**
     * Tạo JWT cho user sau khi đăng nhập thành công.
     * Token chứa: subject=email, issuedAt=hiện tại, expiration=hiện tại+jwtExpiration.
     *
     * @param username email của user (là username trong Spring Security)
     * @return JWT string dạng header.payload.signature
     */
    public String generateToken(String username) {
        Date now    = new Date();
        Date expiry = new Date(now.getTime() + jwtExpiration);
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Lấy email (subject) từ JWT đã xác thực.
     *
     * @param token JWT string
     * @return email của user
     */
    public String getUsernameFromToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    /**
     * Kiểm tra JWT có hợp lệ không (đúng chữ ký, chưa hết hạn).
     * Bắt mọi JwtException (hết hạn, sai chữ ký, malformed...) và trả false.
     *
     * @param token JWT string cần kiểm tra
     * @return true nếu hợp lệ, false nếu không
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(getSigningKey()).build().parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false; // token hết hạn, sai chữ ký, hoặc malformed
        }
    }
}
