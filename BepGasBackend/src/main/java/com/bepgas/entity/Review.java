package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "reviews")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long id;

    // Chỉ lấy id + tên sản phẩm để hiển thị trong admin — bỏ các field thừa tránh vòng lặp JSON
    @JsonIgnoreProperties({"category","brand","description","shortDesc","sku",
            "specifications","warrantyMonths","requiresInstallation","weight",
            "price","salePrice","stockQty","soldQty","status","isFeatured",
            "createdAt","updatedAt","images","reviews","hibernateLazyInitializer","handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // Ẩn order khỏi JSON — tránh serialize vòng tròn Review → Order → OrderItem → Product
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(nullable = false)
    private int rating;

    @Column(length = 200)
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String comment;

    @Column(name = "is_visible")
    @Builder.Default
    private boolean isVisible = true;

    /** Phản hồi của shop — null nếu chưa phản hồi */
    @Column(name = "admin_reply", columnDefinition = "LONGTEXT")
    private String adminReply;

    /** TRUE nếu người đánh giá đã mua & nhận hàng thành công */
    @Column(name = "verified_purchase")
    @Builder.Default
    private boolean verifiedPurchase = false;

    /** URL ảnh đính kèm đánh giá (JSON array) */
    @Column(name = "image_url", length = 255)
    private String imageUrl;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}