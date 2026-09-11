package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Brand;
import com.bepgas.service.BrandService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * REST API thương hiệu sản phẩm.
 * Base URL: /api/brands
 * Public : GET / (danh sách phân trang), GET /{id} (chi tiết)
 * Admin  : POST / (tạo), PUT /{id} (sửa), DELETE /{id} (xóa)
 * Logo thương hiệu upload qua ImgBB từ phía frontend, truyền URL vào body.
 */
@RestController
@RequestMapping("/api/brands")
@RequiredArgsConstructor
public class BrandController {

    private final BrandService brandService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Brand>>> getAll(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(brandService.getAll(pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Brand>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(brandService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Brand>> create(@RequestBody Brand brand) {
        return ResponseEntity.ok(ApiResponse.success("Tạo thương hiệu thành công",
                brandService.create(brand)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Brand>> update(
            @PathVariable Long id,
            @RequestBody Brand brand) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                brandService.update(id, brand)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        brandService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa thương hiệu thành công", null));
    }
}
