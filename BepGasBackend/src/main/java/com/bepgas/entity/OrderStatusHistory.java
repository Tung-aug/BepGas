package com.bepgas.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Lịch sử thay đổi trạng thái của đơn hàng — append-only, không xóa hay sửa.
 * Mỗi lần đổi trạng thái (pending → confirmed, ...) thêm 1 dòng vào đây.
 * Frontend dùng để hiển thị timeline đơn hàng theo thứ tự thời gian.
 */
@Entity
@Table(name = "order_status_history")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OrderStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_status_history_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(nullable = false, length = 30)
    private String status;

    /** Lý do thay đổi trạng thái (hủy, hoàn trả, giao thất bại...) */
    @Column(columnDefinition = "TEXT")
    private String note;

    /** Ảnh minh chứng (URL, dùng cho hoàn hàng, giao thất bại) */
    @Column(name = "image_url", length = 255)
    private String imageUrl;

    /** Email admin/staff thực hiện — null nếu khách tự thao tác */
    @Column(name = "changed_by", length = 150)
    private String changedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
