package com.bepgas.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.Map;

/**
 * Dịch vụ upload ảnh lên ImgBB (dịch vụ lưu trữ ảnh miễn phí).
 * API key cấu hình trong application.properties (imgbb.api-key).
 * Lưu ý: ImgBB free plan không hỗ trợ xóa ảnh qua API
 * nên khi xóa ảnh trong DB, file vẫn còn trên ImgBB.
 */
@Service
public class ImgBBService {

    @Value("${imgbb.api-key}")
    private String apiKey; // API key lấy từ imgbb.com → Account → API

    private final RestTemplate restTemplate = new RestTemplate();

    private static final String IMGBB_URL = "https://api.imgbb.com/1/upload";

    /**
     * Upload một file ảnh lên ImgBB và trả về URL công khai của ảnh.
     * Quy trình: đọc bytes → encode base64 → POST form-urlencoded lên ImgBB API
     * → parse JSON response → lấy data.url.
     *
     * @param file file ảnh từ multipart request
     * @return URL ảnh công khai trên ImgBB (dạng https://i.ibb.co/...)
     * @throws RuntimeException nếu upload thất bại hoặc response không hợp lệ
     */
    public String upload(MultipartFile file) {
        try {
            // ImgBB API nhận ảnh dưới dạng base64 string trong form body
            String base64 = Base64.getEncoder().encodeToString(file.getBytes());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("image", base64);
            body.add("name", file.getOriginalFilename()); // tên file để đặt tên trên ImgBB

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

            // API key truyền qua query param, không phải header
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    IMGBB_URL + "?key=" + apiKey, request, Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                // Response structure: { success: true, data: { url: "...", display_url: "..." } }
                Map<?, ?> data = (Map<?, ?>) response.getBody().get("data");
                if (data != null) {
                    return (String) data.get("url"); // URL ảnh full size
                }
            }
            throw new RuntimeException("ImgBB trả về kết quả không hợp lệ");

        } catch (Exception e) {
            throw new RuntimeException("Lỗi upload ảnh lên ImgBB: " + e.getMessage());
        }
    }
}
