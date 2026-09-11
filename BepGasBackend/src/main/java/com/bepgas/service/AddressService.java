package com.bepgas.service;

import com.bepgas.entity.Address;
import com.bepgas.entity.User;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Quản lý sổ địa chỉ giao hàng của người dùng.
 * Mỗi user có thể có nhiều địa chỉ nhưng chỉ một địa chỉ mặc định (isDefault=true).
 * Logic mặc định: địa chỉ đầu tiên tự động làm mặc định;
 * đặt địa chỉ mới làm mặc định sẽ bỏ mặc định địa chỉ cũ;
 * xóa địa chỉ mặc định sẽ tự gán địa chỉ đầu tiên còn lại làm mặc định.
 */
@Service
@RequiredArgsConstructor
public class AddressService {

    private final AddressRepository addressRepository;
    private final UserService userService;

    /**
     * Lấy tất cả địa chỉ của một user.
     *
     * @param userId ID user
     */
    public List<Address> getByUser(Long userId) {
        return addressRepository.findByUserId(userId);
    }

    /**
     * Thêm địa chỉ mới cho user.
     * - Nếu là địa chỉ đầu tiên: tự động đặt làm mặc định.
     * - Nếu user muốn đặt làm mặc định: bỏ mặc định địa chỉ hiện tại.
     * - Nếu không muốn mặc định và đã có địa chỉ khác: lưu bình thường.
     *
     * @param userId  ID user
     * @param address thông tin địa chỉ mới
     */
    public Address create(Long userId, Address address) {
        User user = userService.getById(userId);
        address.setUser(user);

        List<Address> existing = addressRepository.findByUserId(userId);
        if (existing.isEmpty()) {
            // Địa chỉ đầu tiên → bắt buộc làm mặc định, không cần user chọn
            address.setIsDefault(true);
        } else if (Boolean.TRUE.equals(address.getIsDefault())) {
            // User muốn địa chỉ mới là mặc định → bỏ mặc định địa chỉ cũ trước
            addressRepository.findByUserIdAndIsDefaultTrue(userId)
                    .ifPresent(old -> { old.setIsDefault(false); addressRepository.save(old); });
        }

        return addressRepository.save(address);
    }

    /**
     * Cập nhật địa chỉ. Kiểm tra quyền sở hữu trước.
     * Xử lý thay đổi trạng thái isDefault:
     * - Bật mặc định: bỏ mặc định cũ.
     * - Tắt mặc định: cho phép (user tự quản lý).
     *
     * @param id      ID địa chỉ cần cập nhật
     * @param userId  ID user (xác thực quyền)
     * @param updated dữ liệu mới
     */
    public Address update(Long id, Long userId, Address updated) {
        Address address = getByIdAndUser(id, userId);
        address.setFullName(updated.getFullName());
        address.setPhone(updated.getPhone());
        address.setCity(updated.getCity());
        address.setDistrict(updated.getDistrict());
        address.setWard(updated.getWard());
        address.setAddressLine(updated.getAddressLine());

        boolean wasDefault   = Boolean.TRUE.equals(address.getIsDefault());
        boolean wantsDefault = Boolean.TRUE.equals(updated.getIsDefault());

        if (!wasDefault && wantsDefault) {
            // Chuyển địa chỉ này thành mặc định → bỏ mặc định cũ
            addressRepository.findByUserIdAndIsDefaultTrue(userId)
                    .ifPresent(old -> { old.setIsDefault(false); addressRepository.save(old); });
            address.setIsDefault(true);
        } else if (wasDefault && !wantsDefault) {
            // User tắt mặc định của địa chỉ này — cho phép (không bắt buộc có mặc định)
            address.setIsDefault(false);
        }

        return addressRepository.save(address);
    }

    /**
     * Xóa địa chỉ. Kiểm tra quyền sở hữu.
     * Nếu vừa xóa địa chỉ mặc định → tự gán địa chỉ đầu tiên còn lại làm mặc định.
     *
     * @param id     ID địa chỉ cần xóa
     * @param userId ID user (xác thực quyền)
     */
    public void delete(Long id, Long userId) {
        Address address = getByIdAndUser(id, userId);
        boolean wasDefault = Boolean.TRUE.equals(address.getIsDefault());
        addressRepository.delete(address);

        // Sau khi xóa địa chỉ mặc định, tự động chọn địa chỉ đầu tiên còn lại
        if (wasDefault) {
            List<Address> remaining = addressRepository.findByUserId(userId);
            if (!remaining.isEmpty()) {
                remaining.get(0).setIsDefault(true);
                addressRepository.save(remaining.get(0));
            }
        }
    }

    /**
     * Đặt một địa chỉ làm mặc định (bỏ mặc định cũ trước).
     *
     * @param id     ID địa chỉ cần đặt làm mặc định
     * @param userId ID user (xác thực quyền)
     */
    public void setDefault(Long id, Long userId) {
        // Bỏ mặc định địa chỉ hiện tại (nếu có)
        addressRepository.findByUserIdAndIsDefaultTrue(userId)
                .ifPresent(a -> { a.setIsDefault(false); addressRepository.save(a); });
        Address address = getByIdAndUser(id, userId);
        address.setIsDefault(true);
        addressRepository.save(address);
    }

    /**
     * Tìm địa chỉ theo ID và xác thực thuộc về đúng user.
     * Dùng nội bộ bởi update, delete, setDefault.
     *
     * @throws ResourceNotFoundException nếu không tìm thấy địa chỉ
     * @throws BadRequestException       nếu địa chỉ không thuộc user này
     */
    private Address getByIdAndUser(Long id, Long userId) {
        Address address = addressRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy địa chỉ: " + id));
        if (!address.getUser().getId().equals(userId)) {
            throw new BadRequestException("Không có quyền truy cập địa chỉ này");
        }
        return address;
    }
}