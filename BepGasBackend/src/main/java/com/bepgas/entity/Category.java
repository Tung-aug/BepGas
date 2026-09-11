package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

/**
 * Danh mục sản phẩm hỗ trợ 2 cấp (cha → con).
 * parentCategoryId=null: danh mục gốc (cấp 1), hiện ở menu chính.
 * parentCategoryId!=null: danh mục con (cấp 2), hiện ở dropdown/submenu.
 * sortOrder: thứ tự hiển thị trong cùng cấp, hỗ trợ kéo-thả sắp xếp từ admin.
 */
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "categories")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "category_id")
    private Long id;

    @Column(name = "category_name", nullable = false, length = 100)
    private String categoryName;

    @Column(unique = true, nullable = false, length = 100)
    private String slug;

    @Column(name = "image_url", length = 255)
    private String imageUrl;

    @Column(name = "sort_order")
    @Builder.Default
    private int sortOrder = 0;

    @JsonProperty("isActive")
    @Column(name = "is_active")
    @Builder.Default
    private boolean isActive = true;

    /**
     * Danh mục cha — NULL nếu là danh mục gốc.
     * Lưu trực tiếp dưới dạng Long (không dùng @ManyToOne)
     * để tránh circular JSON và N+1 queries.
     */
    @JsonProperty("parentCategoryId")
    @Column(name = "parent_category_id")
    private Long parentCategoryId;

    @JsonIgnore
    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    private List<Product> products;
}
