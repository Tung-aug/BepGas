package com.bepgas.service;

import com.bepgas.dto.ReturnDecisionData;
import com.bepgas.dto.ReturnRequestData;
import com.bepgas.entity.OrderStatusHistory;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Tiện ích đọc/ghi JSON hoàn trả từng sản phẩm lưu trong OrderStatusHistory.note.
 * Không truy cập DB trực tiếp — nhận List<OrderStatusHistory> đã load sẵn từ OrderService,
 * tránh query lại history nhiều lần cho cùng 1 đơn trong cùng 1 request.
 *
 * Quy ước: 1 dòng "return_request" (status=return_pending) ghép với tối đa 1 dòng
 * "return_decision" (status=returned/delivered) có cùng reqCode. Dòng nào parse JSON lỗi
 * (dữ liệu cũ trước khi có tính năng này, hoặc note thường) đều bị bỏ qua an toàn — không throw.
 */
@Component
@RequiredArgsConstructor
public class ReturnRequestHelper {

    private final ObjectMapper objectMapper;

    public String serializeRequest(ReturnRequestData data) {
        return serialize(data);
    }

    public String serializeDecision(ReturnDecisionData data) {
        return serialize(data);
    }

    private String serialize(Object data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tạo dữ liệu hoàn trả: " + e.getMessage());
        }
    }

    /** Parse note thành ReturnRequestData — trả null nếu không phải JSON hợp lệ của loại này (dữ liệu cũ). */
    public ReturnRequestData parseRequest(String note) {
        if (note == null || note.isBlank()) return null;
        try {
            ReturnRequestData data = objectMapper.readValue(note, ReturnRequestData.class);
            return "return_request".equals(data.getType()) ? data : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Parse note thành ReturnDecisionData — trả null nếu không phải JSON hợp lệ của loại này. */
    public ReturnDecisionData parseDecision(String note) {
        if (note == null || note.isBlank()) return null;
        try {
            ReturnDecisionData data = objectMapper.readValue(note, ReturnDecisionData.class);
            return "return_decision".equals(data.getType()) ? data : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Map reqCode -> quyết định, chỉ gồm các yêu cầu đã được admin xử lý (duyệt hoặc từ chối). */
    private Map<String, ReturnDecisionData> decisionsByReqCode(List<OrderStatusHistory> history) {
        Map<String, ReturnDecisionData> result = new HashMap<>();
        for (OrderStatusHistory h : history) {
            ReturnDecisionData d = parseDecision(h.getNote());
            if (d != null && d.getReqCode() != null) result.put(d.getReqCode(), d);
        }
        return result;
    }

    /** Toàn bộ yêu cầu hoàn trả (parse được) trong lịch sử đơn, không phân biệt đã xử lý hay chưa. */
    private List<ReturnRequestData> allRequests(List<OrderStatusHistory> history) {
        List<ReturnRequestData> result = new ArrayList<>();
        for (OrderStatusHistory h : history) {
            ReturnRequestData r = parseRequest(h.getNote());
            if (r != null) result.add(r);
        }
        return result;
    }

    /** Các yêu cầu hoàn trả còn đang chờ duyệt (chưa có dòng quyết định tương ứng). */
    public List<ReturnRequestData> getPendingRequests(List<OrderStatusHistory> history) {
        Map<String, ReturnDecisionData> decisions = decisionsByReqCode(history);
        List<ReturnRequestData> pending = new ArrayList<>();
        for (ReturnRequestData req : allRequests(history)) {
            if (!decisions.containsKey(req.getReqCode())) pending.add(req);
        }
        return pending;
    }

    /** Tìm yêu cầu hoàn trả theo reqCode — null nếu không có. */
    public ReturnRequestData findRequest(List<OrderStatusHistory> history, String reqCode) {
        for (ReturnRequestData req : allRequests(history)) {
            if (req.getReqCode().equals(reqCode)) return req;
        }
        return null;
    }

    /** true nếu reqCode đã có quyết định (duyệt hoặc từ chối) — dùng chặn xử lý lại (idempotent). */
    public boolean isDecided(List<OrderStatusHistory> history, String reqCode) {
        return decisionsByReqCode(history).containsKey(reqCode);
    }

    /**
     * Quyết định MỚI NHẤT của reqCode — null nếu chưa có. Vì history sắp xếp cũ→mới và
     * decisionsByReqCode ghi đè theo thứ tự, dòng quyết định thêm sau (VD: xác nhận hoàn tiền
     * sau khi đã duyệt trước đó) sẽ thắng — cho phép "cập nhật" 1 quyết định cũ bằng cách
     * append thêm dòng mới cùng reqCode, giữ đúng tính chất append-only của bảng lịch sử.
     */
    public ReturnDecisionData findDecision(List<OrderStatusHistory> history, String reqCode) {
        return decisionsByReqCode(history).get(reqCode);
    }

    /**
     * Tổng số lượng đang "giữ chỗ" hoàn trả theo từng orderItemId — gồm yêu cầu đang chờ duyệt
     * VÀ yêu cầu đã được duyệt (approved=true). Yêu cầu bị từ chối không tính.
     * Dùng để chặn trả vượt số lượng đã mua khi khách gửi yêu cầu mới.
     */
    public Map<Long, Long> aggregateReturnedQty(List<OrderStatusHistory> history) {
        Map<String, ReturnDecisionData> decisions = decisionsByReqCode(history);
        Map<Long, Long> result = new HashMap<>();
        for (ReturnRequestData req : allRequests(history)) {
            ReturnDecisionData decision = decisions.get(req.getReqCode());
            // Đã có quyết định và là từ chối → không tính vào số lượng giữ chỗ
            if (decision != null && !decision.isApproved()) continue;
            if (req.getItems() == null) continue;
            for (ReturnRequestData.ReturnItemLine line : req.getItems()) {
                if (line.getOrderItemId() == null) continue;
                result.merge(line.getOrderItemId(), line.getQty(), Long::sum);
            }
        }
        return result;
    }

    /** Tổng số tiền đã hoàn cho các yêu cầu đã được duyệt VÀ đánh dấu refunded=true. */
    public BigDecimal sumApprovedRefundAmount(List<OrderStatusHistory> history) {
        Map<String, ReturnRequestData> requestsByCode = new HashMap<>();
        for (ReturnRequestData req : allRequests(history)) requestsByCode.put(req.getReqCode(), req);

        BigDecimal sum = BigDecimal.ZERO;
        for (OrderStatusHistory h : history) {
            ReturnDecisionData d = parseDecision(h.getNote());
            if (d == null || !d.isApproved() || !Boolean.TRUE.equals(d.getRefunded())) continue;
            ReturnRequestData req = requestsByCode.get(d.getReqCode());
            if (req != null && req.getRefundAmount() != null) sum = sum.add(req.getRefundAmount());
        }
        return sum;
    }
}
