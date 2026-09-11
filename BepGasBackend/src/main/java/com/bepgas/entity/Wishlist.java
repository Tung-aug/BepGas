package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Sản phẩm yêu thích của người dùng (cặp user–product duy nhất).
 * Không cho phép thêm trùng — WishlistService kiểm tra bằng existsByUserIdAndProductId.
 */
@Entity
@Table(name = "wishlists")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Wishlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "wishlist_id")
    private Long id;

    // user ẩn khỏi JSON vì WishlistResponse đã có userId riêng, tránh serialize thừa
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // EAGER để luôn load product khi lấy wishlist — cần thông tin sản phẩm để hiển thị ngay
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @CreationTimestamp
    @Column(name = "added_at")
    private LocalDateTime addedAt;
}
