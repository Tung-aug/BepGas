package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Entity sản phẩm trong danh mục bếp gas và thiết bị nhà bếp.
 * Trạng thái: active (đang bán), inactive (ẩn khỏi public), out_of_stock (hết hàng, vẫn hiển thị).
 * Slug duy nhất dùng cho URL SEO-friendly (ví dụ: "bep-gas-namilux-na-399t").
 * salePrice: giá khuyến mãi — null nếu không khuyến mãi, lúc này dùng price gốc.
 * specifications: lưu dạng JSON string để linh hoạt per-product mà không cần thêm cột.
 * installationFee: null → dùng phí mặc định 150.000đ được tính trong OrderService.
 */
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "products")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "product_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private Brand brand;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(unique = true, nullable = false, length = 255)
    private String slug;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @Column(name = "short_desc", length = 500)
    private String shortDesc;

    @Column(unique = true, length = 100)
    private String sku;

    @Column(columnDefinition = "JSON")
    private String specifications;

    @Column(name = "warranty_months")
    @Builder.Default
    private int warrantyMonths = 0;

    @Column(name = "requires_installation")
    @Builder.Default
    private boolean requiresInstallation = false;

    /** Phí lắp đặt riêng — null thì dùng phí mặc định 150.000đ */
    @Column(name = "installation_fee", precision = 12, scale = 2)
    private BigDecimal installationFee;

    @Column(precision = 8, scale = 2)
    private BigDecimal weight;

    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "sale_price", precision = 12, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "stock_qty")
    @Builder.Default
    private int stockQty = 0;

    @Column(name = "sold_qty")
    @Builder.Default
    private int soldQty = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProductStatus status = ProductStatus.active;

    @com.fasterxml.jackson.annotation.JsonProperty("isFeatured")
    @Column(name = "is_featured")
    @Builder.Default
    private boolean isFeatured = false;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductImage> images;

    @JsonIgnore
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Review> reviews;
}
