package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Banner quảng cáo hiển thị trên các vị trí của trang web.
 * Hỗ trợ lịch trình theo startDate/endDate — null nghĩa là không giới hạn thời gian.
 * linkUrl: đường dẫn khi click vào banner (null = không click được).
 * sortOrder: thứ tự hiển thị trong từng vị trí (position) — số nhỏ hiện trước.
 */
@Entity
@Table(name = "banners")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Banner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "banner_id")
    private Long id;

    // Tiêu đề nội bộ — admin đặt tên để phân biệt, không hiện ra frontend
    @Column(name = "banner_title", length = 200)
    private String bannerTitle;

    // URL ảnh banner đã upload lên ImgBB
    @Column(name = "image_url", nullable = false, length = 255)
    private String imageUrl;

    // Khi click banner → redirect đến URL này (null = chỉ trang trí, không điều hướng)
    @Column(name = "link_url", length = 255)
    private String linkUrl;

    // Vị trí hiển thị: hero (slider trang chủ), sidebar, popup, scroll (cuộn thương hiệu)
    @Enumerated(EnumType.STRING)
    private BannerPosition position;

    // Thứ tự trong cùng vị trí — số nhỏ hơn hiện trước
    @Column(name = "sort_order")
    @Builder.Default
    private int sortOrder = 0;

    // Ngày bắt đầu hiển thị — null = hiện ngay từ khi tạo
    @Column(name = "start_date")
    private LocalDateTime startDate;

    // Ngày kết thúc hiển thị — null = hiện vô thời hạn
    @Column(name = "end_date")
    private LocalDateTime endDate;

    // isActive=false: admin tắt tạm thời mà không cần xóa
    @JsonProperty("isActive")
    @Column(name = "is_active")
    @Builder.Default
    private boolean isActive = true;

}
