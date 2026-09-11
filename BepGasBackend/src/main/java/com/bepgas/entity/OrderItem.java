package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Một dòng sản phẩm trong đơn hàng (Order).
 * productName và productImage được snapshot tại thời điểm đặt hàng —
 * đảm bảo lịch sử đơn đúng dù admin sau đó đổi tên/ảnh sản phẩm.
 * product có thể null nếu sản phẩm bị xóa khỏi DB (vẫn giữ tên/ảnh đã snapshot).
 */
@Entity
@Table(name = "order_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_item_id")
    private Long id;

    // Ẩn order khỏi JSON để tránh vòng lặp tuần hoàn khi serialize
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    // product có thể null nếu sản phẩm đã bị xóa — lúc đó dùng productName (snapshot) để hiển thị
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    // Snapshot tên sản phẩm tại thời điểm mua — không bị ảnh hưởng khi admin đổi tên sau
    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    // Snapshot ảnh đại diện tại thời điểm mua
    @Column(name = "product_image", length = 255)
    private String productImage;

    @Column(nullable = false)
    private long quantity;

    // Giá thực tế tại thời điểm mua (salePrice nếu có, ngược lại price gốc)
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "requires_installation")
    @Builder.Default
    private boolean requiresInstallation = false;

    /** Snapshot số tháng bảo hành tại thời điểm mua — tránh sai khi product thay đổi sau */
    @Column(name = "warranty_months")
    @Builder.Default
    private long warrantyMonths = 0;
}
