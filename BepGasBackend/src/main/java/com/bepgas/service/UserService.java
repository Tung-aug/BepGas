package com.bepgas.service;

import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Xử lý nghiệp vụ liên quan đến người dùng:
 * tìm kiếm, cập nhật hồ sơ, đổi mật khẩu.
 * Được inject vào nhiều service khác (OrderService, CartService, AuthService, ReviewService).
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Tìm user theo ID — dùng nội bộ bởi các service khác.
     *
     * @param id ID user cần tìm
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user: " + id));
    }

    /**
     * Tìm user theo email — dùng bởi AuthService sau khi xác thực thành công.
     *
     * @param email địa chỉ email
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public User getByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user: " + email));
    }

    /**
     * Lấy danh sách tất cả user (Admin).
     *
     * @param pageable thông tin phân trang
     */
    public Page<User> getAll(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    /**
     * Cập nhật hồ sơ cá nhân (tên, số điện thoại).
     * Chỉ update field không null — field null giữ nguyên giá trị cũ.
     *
     * @param id       ID user cần cập nhật
     * @param fullName tên mới (null = không thay đổi)
     * @param phone    số điện thoại mới (null = không thay đổi)
     */
    public User updateProfile(Long id, String fullName, String phone) {
        User user = getById(id);
        if (fullName != null) user.setFullName(fullName);
        if (phone != null) user.setPhone(phone);
        return userRepository.save(user);
    }

    /**
     * Đổi mật khẩu — yêu cầu nhập mật khẩu cũ để xác thực.
     * Mật khẩu mới được mã hóa BCrypt trước khi lưu.
     *
     * @param id          ID user
     * @param oldPassword mật khẩu hiện tại (để xác thực)
     * @param newPassword mật khẩu mới
     * @throws BadRequestException nếu mật khẩu cũ không khớp
     */
    public void changePassword(Long id, String oldPassword, String newPassword) {
        User user = getById(id);
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new BadRequestException("Mật khẩu cũ không đúng");
        }
        user.setPassword(passwordEncoder.encode(newPassword)); // BCrypt hash mật khẩu mới
        userRepository.save(user);
    }
}
