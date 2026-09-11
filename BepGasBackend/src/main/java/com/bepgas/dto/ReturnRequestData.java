package com.bepgas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Cấu trúc JSON lưu trong OrderStatusHistory.note khi khách gửi yêu cầu hoàn trả từng sản phẩm.
 * Mỗi yêu cầu là 1 dòng history với status="return_pending" — không thêm bảng mới.
 * reqCode là khóa logic nối dòng yêu cầu này với dòng quyết định (ReturnDecisionData) sau đó.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnRequestData {
    private String type; // luôn "return_request" — dùng để phân biệt với dữ liệu cũ/JSON khác khi parse
    private String reqCode;
    private String reason;
    private List<String> images;
    private List<ReturnItemLine> items;
    private BigDecimal refundAmount;
    private String reqStatus; // "pending" tại thời điểm tạo — trạng thái thực tế suy ra từ việc có dòng quyết định hay không

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReturnItemLine {
        private Long orderItemId;
        private String name;
        private long qty;
        private BigDecimal unitPrice;
        private BigDecimal lineRefund;
    }
}
