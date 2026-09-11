package com.bepgas.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Dữ liệu gửi khi viết đánh giá sản phẩm — POST /api/reviews/product/{productId}.
 */
@Data
public class ReviewRequest {

    @NotNull
    @Min(1) @Max(5) // Điểm đánh giá từ 1 đến 5 sao
    private int rating;

    private String comment;  // Nội dung đánh giá — không bắt buộc

    private String imageUrl; // URL ảnh đính kèm (đã upload ImgBB từ phía client) — không bắt buộc
}
