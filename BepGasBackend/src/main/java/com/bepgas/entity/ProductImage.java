package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

/**
 * Ảnh của sản phẩm — một sản phẩm có thể có nhiều ảnh.
 * sortOrder dùng để sắp xếp thứ tự hiển thị trong gallery.
 * isPrimary=true: ảnh đại diện hiển thị ở trang danh sách và thumbnail giỏ hàng.
 * Ảnh được lưu trên ImgBB (URL), không lưu file trực tiếp trên server.
 */
@Entity
@Table(name = "product_images")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long id;

    // Ẩn product khỏi JSON của ProductImage để tránh serialize vòng tròn Product → images → product
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // URL ảnh trên ImgBB dạng https://i.ibb.co/...
    @Column(name = "image_url", nullable = false, length = 255)
    private String imageUrl;

    // Thứ tự hiển thị trong gallery — số nhỏ hơn hiện trước
    @Column(name = "sort_order")
    @Builder.Default
    private int sortOrder = 0;

    // Ảnh chính dùng cho thumbnail — chỉ 1 ảnh được đặt true mỗi sản phẩm
    @Column(name = "is_primary")
    @Builder.Default
    private boolean isPrimary = false;
}
