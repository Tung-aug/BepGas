package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Banner;
import com.bepgas.service.BannerService;
import com.bepgas.service.ImgBBService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * REST API banner quảng cáo.
 * Base URL: /api/banners
 * Public : GET /api/banners — chỉ trả banner đang active (sắp xếp theo sortOrder)
 * Admin  : GET /all, POST / (tạo), PUT /{id} (sửa), DELETE /{id} (xóa)
 *          POST /upload-image — upload ảnh banner lên ImgBB, trả về URL để điền vào form
 */
@RestController
@RequestMapping("/api/banners")
@RequiredArgsConstructor
public class BannerController {

    private final BannerService bannerService;
    private final ImgBBService  imgBBService;

    // POST /api/banners/upload-image — upload ảnh banner/icon lên ImgBB, chỉ dành cho Admin
    @PostMapping("/upload-image")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> uploadImage(
            @RequestParam("file") MultipartFile file) {
        String url = imgBBService.upload(file);
        return ResponseEntity.ok(ApiResponse.success("Upload thành công", url));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Banner>>> getActiveBanners() {
        return ResponseEntity.ok(ApiResponse.success(bannerService.getActiveBanners()));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Banner>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(bannerService.getAll()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Banner>> create(@RequestBody Banner banner) {
        return ResponseEntity.ok(ApiResponse.success("Tạo banner thành công",
                bannerService.create(banner)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Banner>> update(
            @PathVariable Long id,
            @RequestBody Banner banner) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                bannerService.update(id, banner)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        bannerService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa banner thành công", null));
    }
}
