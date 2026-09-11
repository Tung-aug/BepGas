package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.service.ImgBBService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Endpoint upload ảnh dùng chung cho khách hàng đã đăng nhập.
 * Base URL: /api/uploads
 * Dùng cho: ảnh đánh giá sản phẩm, ảnh minh chứng hoàn trả đơn hàng.
 */
@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final ImgBBService imgBBService;

    // POST /api/uploads/image — yêu cầu đăng nhập, không cần ADMIN
    @PostMapping("/image")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> uploadImage(
            @RequestParam("file") MultipartFile file) {
        String url = imgBBService.upload(file);
        return ResponseEntity.ok(ApiResponse.success("Upload thành công", url));
    }
}
