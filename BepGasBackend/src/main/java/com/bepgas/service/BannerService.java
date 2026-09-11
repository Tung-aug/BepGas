package com.bepgas.service;

import com.bepgas.entity.Banner;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.BannerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Quản lý banner quảng cáo hiển thị trên trang web.
 * Banner có 3 vị trí (BannerPosition): hero (slider lớn trang chủ), scroll (cuộn thương hiệu), sidebar.
 * Hỗ trợ lịch trình hiển thị theo startDate/endDate và sắp xếp theo sortOrder.
 */
@Service
@RequiredArgsConstructor
public class BannerService {

    private final BannerRepository bannerRepository;

    /**
     * Lấy danh sách banner hiển thị cho trang public: isActive=true VÀ đang trong
     * khoảng startDate/endDate (null = không giới hạn), sắp xếp theo sortOrder tăng dần.
     * Banner hết endDate sẽ tự ẩn mà không cần admin tắt tay.
     */
    public List<Banner> getActiveBanners() {
        return bannerRepository.findVisibleBanners(LocalDateTime.now());
    }

    /**
     * Lấy toàn bộ banner (kể cả đã tắt) — dùng cho Admin quản lý.
     */
    public List<Banner> getAll() {
        return bannerRepository.findAll();
    }

    /**
     * Lấy banner có phân trang (dùng cho Admin danh sách nhiều banner).
     */
    public Page<Banner> getAllPaged(Pageable pageable) {
        return bannerRepository.findAll(pageable);
    }

    /**
     * Tìm banner theo ID.
     *
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public Banner getById(Long id) {
        return bannerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy banner: " + id));
    }

    /**
     * Tạo banner mới. Không cần validate gì thêm ngoài dữ liệu từ request.
     *
     * @param banner thông tin banner mới (title, imageUrl, position, sortOrder...)
     */
    public Banner create(Banner banner) {
        return bannerRepository.save(banner);
    }

    /**
     * Cập nhật thông tin banner.
     * Cập nhật đầy đủ tất cả field (full update, không partial).
     *
     * @param id      ID banner cần cập nhật
     * @param updated dữ liệu mới từ admin
     */
    public Banner update(Long id, Banner updated) {
        Banner banner = getById(id);
        banner.setBannerTitle(updated.getBannerTitle());
        banner.setImageUrl(updated.getImageUrl());
        banner.setLinkUrl(updated.getLinkUrl());
        banner.setPosition(updated.getPosition());    // vị trí hiển thị (hero/scroll/sidebar)
        banner.setSortOrder(updated.getSortOrder());
        banner.setActive(updated.isActive());
        banner.setStartDate(updated.getStartDate());  // null = không giới hạn ngày bắt đầu
        banner.setEndDate(updated.getEndDate());      // null = không giới hạn ngày kết thúc
        return bannerRepository.save(banner);
    }

    /**
     * Xóa banner khỏi hệ thống.
     *
     * @param id ID banner cần xóa
     */
    public void delete(Long id) {
        bannerRepository.deleteById(id);
    }
}
