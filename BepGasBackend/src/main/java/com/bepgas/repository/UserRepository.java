package com.bepgas.repository;

import com.bepgas.entity.Role;
import com.bepgas.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // Tìm user theo email — dùng bởi UserDetailsServiceImpl (Spring Security) và AuthService
    Optional<User> findByEmail(String email);

    // Kiểm tra email đã tồn tại — dùng khi đăng ký và admin tạo tài khoản mới
    boolean existsByEmail(String email);

    // Đếm user theo role — dùng trong Dashboard: totalCustomers, totalStaff
    long countByRole(Role role);

    // Đếm admin còn đang active (chưa bị khoá) — dùng chặn khoá/hạ quyền admin cuối cùng
    long countByRoleAndEnabledTrue(Role role);

    // Staff chỉ được xem danh sách customer — phân quyền trong AdminController
    Page<User> findByRole(Role role, Pageable pageable);
}
