package com.bepgas.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Dữ liệu khách gửi lên khi yêu cầu hoàn trả — POST /api/orders/{orderId}/return-request.
 * Cho phép chọn nhiều sản phẩm, mỗi sản phẩm 1 số lượng riêng (hoàn 1 phần đơn hàng).
 */
@Data
public class ReturnRequest {

    private String reason; // lý do hoàn trả — validate not-blank ở service vì cần thông báo tiếng Việt cụ thể

    private List<String> images; // ảnh minh chứng, có thể rỗng

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 sản phẩm cần hoàn trả")
    @Valid
    private List<ItemLine> items;

    @Data
    public static class ItemLine {
        @NotNull(message = "Thiếu mã sản phẩm trong đơn")
        private Long orderItemId;

        private long qty;
    }
}
