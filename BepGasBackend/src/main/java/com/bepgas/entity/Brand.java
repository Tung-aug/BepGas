package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

/**
 * Thương hiệu sản phẩm (Namilux, Rinnai, Paloma...).
 * slug dùng cho URL filter: /products?brand=namilux.
 * logoUrl: link ảnh logo đã upload lên ImgBB.
 * isActive=false: ẩn thương hiệu khỏi trang lọc, nhưng sản phẩm thuộc thương hiệu vẫn hiện.
 */
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "brands")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Brand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "brand_id")
    private Long id;

    @Column(name = "brand_name", nullable = false, length = 100)
    private String brandName;

    @Column(unique = true, length = 100)
    private String slug;

    @Column(name = "logo_url", length = 255)
    private String logoUrl;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @JsonProperty("isActive")
    @Column(name = "is_active")
    @Builder.Default
    private boolean isActive = true;

    @JsonIgnore
    @OneToMany(mappedBy = "brand", fetch = FetchType.LAZY)
    private List<Product> products;
}