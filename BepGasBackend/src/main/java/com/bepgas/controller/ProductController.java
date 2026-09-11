package com.bepgas.controller;

import com.bepgas.dto.request.ProductRequest;
import com.bepgas.dto.response.ApiResponse;
import com.bepgas.dto.response.ProductResponse;
import com.bepgas.entity.ProductImage;
import com.bepgas.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * REST API sản phẩm.
 * Base URL: /api/products
 * Public  : GET / search / category / brand / slug / /{id} / /{id}/images
 * Admin   : POST/PUT/DELETE sản phẩm và quản lý ảnh (upload ImgBB, xóa, đặt ảnh chính)
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    /** Lấy danh sách sản phẩm active (phân trang). */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getAll(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(productService.getAll(pageable)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> search(
            @RequestParam String keyword, Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(productService.search(keyword, pageable)));
    }

    @GetMapping("/category/{categoryId}")
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getByCategory(
            @PathVariable Long categoryId, Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(productService.getByCategory(categoryId, pageable)));
    }

    /** Danh mục cha + toàn bộ con (mọi cấp) — một lần gọi thay vì N lần song song. */
    @GetMapping("/category/{categoryId}/tree")
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getByCategoryTree(
            @PathVariable Long categoryId, Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(productService.getByCategoryTree(categoryId, pageable)));
    }

    @GetMapping("/brand/{brandId}")
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getByBrand(
            @PathVariable Long brandId, Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(productService.getByBrand(brandId, pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(productService.getById(id)));
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<ApiResponse<ProductResponse>> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(productService.getBySlug(slug)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductResponse>> create(
            @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Tạo sản phẩm thành công",
                productService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                productService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        productService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa sản phẩm thành công", null));
    }

    // ── QUẢN LÝ ẢNH SẢN PHẨM ────────────────────────────────

    @GetMapping("/{id}/images")
    public ResponseEntity<ApiResponse<List<ProductImage>>> getImages(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(productService.getImages(id)));
    }

    @PostMapping("/{id}/images/url")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductImage>> saveImageUrl(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        String imageUrl = body.get("imageUrl");
        String altText  = body.getOrDefault("altText", "");
        return ResponseEntity.ok(ApiResponse.success("Lưu ảnh thành công",
                productService.saveImageUrl(id, imageUrl, altText)));
    }

    @PostMapping("/{id}/images")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ProductImage>>> uploadImages(
            @PathVariable Long id,
            @RequestParam("files") List<MultipartFile> files) {
        return ResponseEntity.ok(ApiResponse.success("Upload ảnh thành công",
                productService.uploadImages(id, files)));
    }

    @DeleteMapping("/images/{imageId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteImage(@PathVariable Long imageId) {
        productService.deleteImage(imageId);
        return ResponseEntity.ok(ApiResponse.success("Xóa ảnh thành công", null));
    }

    @PutMapping("/images/{imageId}/primary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> setPrimaryImage(@PathVariable Long imageId) {
        productService.setPrimaryImage(imageId);
        return ResponseEntity.ok(ApiResponse.success("Đặt ảnh chính thành công", null));
    }
}
