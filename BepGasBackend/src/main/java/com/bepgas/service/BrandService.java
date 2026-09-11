package com.bepgas.service;

import com.bepgas.entity.Brand;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.BrandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Quản lý thương hiệu sản phẩm (Brand): CRUD cho Admin.
 * Mỗi thương hiệu có slug duy nhất dùng làm URL filter trên trang sản phẩm.
 * Logo được lưu dưới dạng URL (upload qua ImgBB từ phía client/admin).
 */
@Service
@RequiredArgsConstructor
public class BrandService {

    private final BrandRepository brandRepository;

    /**
     * Lấy danh sách thương hiệu có phân trang.
     */
    public Page<Brand> getAll(Pageable pageable) {
        return brandRepository.findAll(pageable);
    }

    /**
     * Tìm thương hiệu theo ID.
     *
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public Brand getById(Long id) {
        return brandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thương hiệu: " + id));
    }

    /**
     * Tạo thương hiệu mới. Kiểm tra slug chưa tồn tại.
     *
     * @param brand thông tin thương hiệu mới (slug phải unique)
     * @throws BadRequestException nếu slug đã tồn tại
     */
    public Brand create(Brand brand) {
        if (brandRepository.existsBySlug(brand.getSlug())) {
            throw new BadRequestException("Slug đã tồn tại: " + brand.getSlug());
        }
        return brandRepository.save(brand);
    }

    /**
     * Cập nhật thương hiệu.
     * Slug chỉ cập nhật khi admin gửi giá trị mới khác slug cũ,
     * và kiểm tra slug mới chưa bị dùng bởi thương hiệu khác.
     *
     * @param id      ID thương hiệu cần cập nhật
     * @param updated dữ liệu mới
     * @throws BadRequestException nếu slug mới đã tồn tại
     */
    public Brand update(Long id, Brand updated) {
        Brand brand = getById(id);
        brand.setBrandName(updated.getBrandName());
        brand.setLogoUrl(updated.getLogoUrl());
        brand.setDescription(updated.getDescription());
        brand.setActive(updated.isActive());
        // Chỉ đổi slug khi được gửi lên và khác slug hiện tại (tránh unique constraint)
        String newSlug = updated.getSlug();
        if (newSlug != null && !newSlug.isBlank() && !newSlug.equals(brand.getSlug())) {
            if (brandRepository.existsBySlug(newSlug))
                throw new BadRequestException("Slug đã tồn tại: " + newSlug);
            brand.setSlug(newSlug);
        }
        return brandRepository.save(brand);
    }

    /**
     * Xóa thương hiệu. Sản phẩm thuộc thương hiệu bị xóa sẽ có brand=null (SET NULL cascade).
     *
     * @param id ID thương hiệu cần xóa
     */
    public void delete(Long id) {
        brandRepository.deleteById(id);
    }
}
