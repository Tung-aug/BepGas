package com.bepgas.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter xác thực JWT cho mỗi request HTTP.
 * Kế thừa OncePerRequestFilter — đảm bảo chỉ chạy một lần mỗi request.
 * Quy trình: đọc header Authorization → validate JWT → load UserDetails → set SecurityContext.
 * Nếu không có token hoặc token không hợp lệ → request được truyền tiếp,
 * Spring Security sẽ xử lý tiếp (trả 401 nếu endpoint yêu cầu xác thực).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider       jwtTokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    /**
     * Xử lý xác thực JWT cho từng request.
     * Nếu token hợp lệ: set Authentication vào SecurityContextHolder để các
     * @PreAuthorize và .authenticated() có thể kiểm tra quyền.
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);

        if (token != null && jwtTokenProvider.validateToken(token)) {
            String username = jwtTokenProvider.getUsernameFromToken(token); // = email user
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            // Tạo Authentication object với đầy đủ authorities (ROLE_ADMIN/ROLE_CUSTOMER...)
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            // Set vào SecurityContext để Spring Security biết request đã xác thực
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Lấy JWT từ header Authorization dạng "Bearer <token>".
     * Trả null nếu header không tồn tại hoặc không đúng format.
     *
     * @param request HTTP request
     * @return JWT string hoặc null
     */
    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7); // bỏ prefix "Bearer "
        }
        return null;
    }
}
