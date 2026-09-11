package com.bepgas.repository;

import com.bepgas.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AddressRepository extends JpaRepository<Address, Long> {

    // Lấy tất cả địa chỉ của user — dùng trong AddressService và AddressController
    List<Address> findByUserId(Long userId);

    // Tìm địa chỉ mặc định hiện tại — dùng khi thêm/đổi địa chỉ mặc định để bỏ địa chỉ cũ
    Optional<Address> findByUserIdAndIsDefaultTrue(Long userId);
}
