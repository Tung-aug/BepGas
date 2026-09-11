package com.bepgas.controller;

import com.bepgas.dto.response.ApiResponse;
import com.bepgas.entity.Category;
import com.bepgas.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API danh mục sản phẩm.
 * Base URL: /api/categories
 * Public : GET / (tất cả), GET /{id}, GET /roots (danh mục gốc), GET /{id}/children (danh mục con)
 * Admin  : POST / (tạo), PUT /{id} (sửa), DELETE /{id} (xóa), PUT /reorder (kéo-thả sắp xếp)
 */
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    /** Public — chỉ trả danh mục đang active */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Category>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getAll()));
    }

    /** Admin/Staff — trả toàn bộ (kể cả đang ẩn) */
    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<ApiResponse<List<Category>>> getAllForAdmin() {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getAllForAdmin()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Category>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getById(id)));
    }

    // GET /api/categories/roots — chỉ danh mục gốc (parent_category_id IS NULL)
    @GetMapping("/roots")
    public ResponseEntity<ApiResponse<List<Category>>> getRoots() {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getRoots()));
    }

    // GET /api/categories/{id}/children — danh mục con của một cha
    @GetMapping("/{id}/children")
    public ResponseEntity<ApiResponse<List<Category>>> getChildren(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getChildren(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Category>> create(@RequestBody Category category) {
        return ResponseEntity.ok(ApiResponse.success("Tạo danh mục thành công",
                categoryService.create(category)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Category>> update(
            @PathVariable Long id,
            @RequestBody Category category) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công",
                categoryService.update(id, category)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa danh mục thành công", null));
    }

    // PUT /api/categories/reorder — cập nhật thứ tự hàng loạt (kéo-thả)
    @PutMapping("/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> reorder(@RequestBody List<Map<String, Object>> items) {
        categoryService.reorder(items);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thứ tự thành công", null));
    }
}
