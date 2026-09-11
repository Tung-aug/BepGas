package com.bepgas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Cấu trúc JSON lưu trong OrderStatusHistory.note khi admin duyệt/từ chối một yêu cầu hoàn trả.
 * Ghi thêm 1 dòng history mới (status="returned" khi duyệt / "delivered" khi từ chối) —
 * không sửa dòng yêu cầu gốc, giữ đúng tính chất append-only của bảng lịch sử.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnDecisionData {
    private String type; // luôn "return_decision"
    private String reqCode; // khớp với reqCode của ReturnRequestData tương ứng
    private boolean approved;
    private Boolean restocked;    // true nếu đã cộng lại tồn kho cho các item trong yêu cầu này
    private Boolean refunded;     // true nếu đã đánh dấu hoàn tiền cho yêu cầu này
    private String rejectReason;  // lý do từ chối — null nếu approved=true
}
