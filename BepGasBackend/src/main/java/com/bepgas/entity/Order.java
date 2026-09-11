package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Entity đơn hàng — trung tâm của luồng mua hàng.
 * orderCode: mã hiển thị cho khách (dạng ORD-XXXXXXXX), unique.
 * Phí giao hàng và lắp đặt được tính khi tạo đơn và lưu vào đây (snapshot).
 * coupon: null nếu không áp mã giảm giá.
 * paymentReceiptUrl: ảnh biên lai chuyển khoản do khách upload để admin xác nhận.
 * refundReceiptUrl: ảnh biên lai hoàn tiền do admin upload sau khi duyệt hoàn trả.
 * deliveredAt: timestamp giao hàng thành công — dùng để tính deadline hoàn trả 7 ngày.
 */
@Entity
@Table(name = "orders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coupon_id")
    private Coupon coupon;

    @Column(name = "order_code", unique = true, nullable = false, length = 50)
    private String orderCode;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private OrderStatus status = OrderStatus.pending;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "shipping_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "installation_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal installationFee = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.unpaid;

    @Column(columnDefinition = "LONGTEXT")
    private String note;

    @Column(name = "shipping_name", length = 100)
    private String shippingName;

    @Column(name = "shipping_phone", length = 20)
    private String shippingPhone;

    @Column(name = "shipping_address", length = 500)
    private String shippingAddress;

    /** Thời điểm giao hàng thành công — dùng để tính ngày hết bảo hành */
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    /** URL biên lai chuyển khoản của khách */
    @Column(name = "payment_receipt_url", length = 255)
    private String paymentReceiptUrl;

    /** URL biên lai chuyển khoản hoàn tiền cho khách */
    @Column(name = "refund_receipt_url", length = 255)
    private String refundReceiptUrl;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @JsonIgnore
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<OrderItem> items;
}
