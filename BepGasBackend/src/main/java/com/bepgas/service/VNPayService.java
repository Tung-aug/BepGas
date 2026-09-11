package com.bepgas.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.Iterator;

/**
 * Tích hợp cổng thanh toán VNPay.
 * Chức năng chính:
 * - createPaymentUrl: tạo URL redirect sang VNPay để khách thanh toán
 * - validateResponse: xác thực chữ ký HMAC-SHA512 từ callback VNPay trả về
 * Cấu hình (application.properties): vnpay.url, vnpay.tmn-code, vnpay.hash-secret, vnpay.return-url
 */
@Service
public class VNPayService {

    @Value("${vnpay.url}")
    private String vnpUrl;           // URL cổng thanh toán VNPay (sandbox hoặc production)

    @Value("${vnpay.tmn-code}")
    private String tmnCode;          // Mã merchant do VNPay cấp

    @Value("${vnpay.hash-secret}")
    private String hashSecret;       // Secret key dùng ký HMAC-SHA512

    @Value("${vnpay.return-url}")
    private String returnUrl;        // URL backend nhận callback sau khi thanh toán

    /**
     * Tạo URL thanh toán VNPay để redirect khách hàng.
     * Luồng: tạo params → sắp xếp theo TreeMap (alphabetical) → encode → ký HMAC-SHA512 → append hash vào URL.
     * vnpTxnRef = orderId + timestamp để đảm bảo duy nhất (VNPay không chấp nhận TxnRef trùng).
     * Thời hạn thanh toán: 15 phút kể từ lúc tạo URL.
     * Số tiền: VNPay yêu cầu nhân 100 (VNĐ × 100 = đơn vị tính của VNPay).
     *
     * @param orderId   ID đơn hàng cần thanh toán
     * @param amount    số tiền (VNĐ, chưa nhân 100)
     * @param orderInfo mô tả đơn hàng (hiển thị trên trang VNPay)
     * @param request   HTTP request gốc (để lấy IP khách hàng)
     * @return URL đầy đủ để redirect khách sang VNPay
     */
    public String createPaymentUrl(Long orderId, long amount, String orderInfo, HttpServletRequest request) {
        String vnpVersion    = "2.1.0";
        String vnpCommand    = "pay";
        String vnpOrderType  = "other";
        // TxnRef = orderId_timestamp để đảm bảo unique mỗi lần tạo URL (VNPay reject trùng)
        String vnpTxnRef     = orderId + "_" + System.currentTimeMillis();
        String vnpIpAddr     = getIpAddress(request);
        String vnpCreateDate = new SimpleDateFormat("yyyyMMddHHmmss").format(new Date());
        // Thời hạn thanh toán: 15 phút
        String vnpExpireDate = new SimpleDateFormat("yyyyMMddHHmmss")
                .format(new Date(System.currentTimeMillis() + 15 * 60 * 1000));

        // TreeMap tự động sắp xếp key alphabetical — bắt buộc theo spec VNPay khi tính hash
        Map<String, String> vnpParams = new TreeMap<>();
        vnpParams.put("vnp_Version",    vnpVersion);
        vnpParams.put("vnp_Command",    vnpCommand);
        vnpParams.put("vnp_TmnCode",    tmnCode);
        vnpParams.put("vnp_Amount",     String.valueOf(amount * 100)); // VNPay tính theo đơn vị ×100
        vnpParams.put("vnp_CurrCode",   "VND");
        vnpParams.put("vnp_TxnRef",     vnpTxnRef);
        vnpParams.put("vnp_OrderInfo",  orderInfo);
        vnpParams.put("vnp_OrderType",  vnpOrderType);
        vnpParams.put("vnp_Locale",     "vn");
        vnpParams.put("vnp_ReturnUrl",  returnUrl);
        vnpParams.put("vnp_IpAddr",     vnpIpAddr);
        vnpParams.put("vnp_CreateDate", vnpCreateDate);
        vnpParams.put("vnp_ExpireDate", vnpExpireDate);

        // Build query string và hashData song song — hashData dùng URL-encoded values (theo tài liệu VNPay)
        StringBuilder query    = new StringBuilder();
        StringBuilder hashData = new StringBuilder();

        for (Iterator<Map.Entry<String, String>> it = vnpParams.entrySet().iterator(); it.hasNext();) {
            Map.Entry<String, String> entry = it.next();
            String encodedValue = URLEncoder.encode(entry.getValue(), StandardCharsets.US_ASCII);
            hashData.append(entry.getKey()).append('=').append(encodedValue);
            query.append(entry.getKey()).append('=').append(encodedValue);
            if (it.hasNext()) { hashData.append('&'); query.append('&'); }
        }

        // Ký toàn bộ hashData, append vào cuối URL
        String secureHash = hmacSHA512(hashSecret, hashData.toString());
        query.append("&vnp_SecureHash=").append(secureHash);

        return vnpUrl + "?" + query;
    }

    /**
     * Xác thực chữ ký HMAC-SHA512 từ callback VNPay.
     * Loại bỏ vnp_SecureHash và vnp_SecureHashType khỏi params,
     * tính lại hash từ các param còn lại rồi so sánh với hash VNPay gửi về.
     * Nếu khớp → response hợp lệ (không bị giả mạo).
     *
     * @param params toàn bộ query params từ VNPay callback (bao gồm vnp_SecureHash)
     * @return true nếu chữ ký hợp lệ, false nếu bị giả mạo hoặc thiếu hash
     */
    public boolean validateResponse(Map<String, String> params) {
        String vnpSecureHash = params.get("vnp_SecureHash");
        if (vnpSecureHash == null) return false; // thiếu hash → reject

        // Loại bỏ các field hash trước khi tính lại — chỉ giữ data params
        Map<String, String> filtered = new TreeMap<>();
        params.forEach((k, v) -> {
            if (!k.equals("vnp_SecureHash") && !k.equals("vnp_SecureHashType")) {
                filtered.put(k, v);
            }
        });

        // Build hashData với URL-encoded values — phải giống hệt cách tạo URL ban đầu
        StringBuilder hashData = new StringBuilder();
        for (Iterator<Map.Entry<String, String>> it = filtered.entrySet().iterator(); it.hasNext();) {
            Map.Entry<String, String> entry = it.next();
            String encodedValue = URLEncoder.encode(entry.getValue(), StandardCharsets.US_ASCII);
            hashData.append(entry.getKey()).append('=').append(encodedValue);
            if (it.hasNext()) hashData.append('&');
        }

        // So sánh hash tính được với hash VNPay gửi về (case-insensitive)
        String calculated = hmacSHA512(hashSecret, hashData.toString());
        return calculated.equalsIgnoreCase(vnpSecureHash);
    }

    /**
     * Tính HMAC-SHA512 của data với key cho trước.
     * Kết quả trả về chuỗi hex lowercase (64 ký tự cho SHA-512).
     *
     * @param key  secret key (vnpay.hash-secret)
     * @param data chuỗi cần ký (query string đã encode)
     */
    private String hmacSHA512(String key, String data) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA512");
            hmac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] bytes = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException("Lỗi HMAC: " + e.getMessage()); }
    }

    /**
     * Lấy IP thực của client, hỗ trợ proxy/load balancer qua header X-Forwarded-For.
     * Nếu qua nhiều proxy, lấy IP đầu tiên (IP client gốc).
     *
     * @param request HTTP request
     * @return địa chỉ IP của client
     */
    private String getIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        // X-Forwarded-For có thể chứa nhiều IP: "clientIP, proxy1IP, proxy2IP" → lấy đầu tiên
        return (ip == null || ip.isEmpty()) ? request.getRemoteAddr() : ip.split(",")[0].trim();
    }
}
