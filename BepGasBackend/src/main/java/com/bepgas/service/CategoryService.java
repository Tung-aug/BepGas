package com.bepgas.service;

import com.bepgas.entity.Category;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.CategoryRepository;
import com.bepgas.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Quản lý danh mục sản phẩm 2 cấp (cha → con).
 * Danh mục gốc có parentCategoryId=null; danh mục con có parentCategoryId trỏ về cha.
 * Hỗ trợ kéo thả sắp xếp (reorder) và hiển thị theo sortOrder ASC.
 */
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository  productRepository;

    /**
     * Lấy toàn bộ danh mục — dùng cho admin (bao gồm cả danh mục đang ẩn).
     */
    public List<Category> getAllForAdmin() {
        return categoryRepository.findAllByOrderBySortOrderAsc();
    }

    /**
     * Lấy danh mục active — public API, chỉ trả danh mục đang hiển thị.
     * Frontend tự phân cấp cha-con dựa trên parentCategoryId.
     */
    public List<Category> getAll() {
        return categoryRepository.findByIsActiveTrueOrderBySortOrderAsc();
    }

    /**
     * Tìm danh mục theo ID.
     *
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public Category getById(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục: " + id));
    }

    /**
     * Tạo danh mục mới.
     * Kiểm tra: slug không trống, slug chưa tồn tại, danh mục cha tồn tại (nếu có).
     *
     * @param category thông tin danh mục mới
     * @throws BadRequestException nếu slug trùng hoặc danh mục cha không tồn tại
     */
    @Transactional
    public Category create(Category category) {
        if (category.getSlug() == null || category.getSlug().isBlank()) {
            throw new BadRequestException("Slug không được để trống");
        }
        if (categoryRepository.existsBySlug(category.getSlug())) {
            throw new BadRequestException("Slug đã tồn tại: " + category.getSlug());
        }
        // Xác nhận danh mục cha tồn tại nếu được chỉ định
        Long pid = category.getParentCategoryId();
        if (pid != null && !categoryRepository.existsById(pid)) {
            throw new BadRequestException("Danh mục cha không tồn tại: " + pid);
        }
        return categoryRepository.save(category);
    }

    /**
     * Cập nhật danh mục.
     * Slug chỉ đổi khi được gửi lên và khác slug cũ.
     * Danh mục không thể tự đặt mình làm cha (circular reference).
     *
     * @param id      ID danh mục cần cập nhật
     * @param updated dữ liệu mới
     * @throws BadRequestException nếu slug trùng hoặc tham chiếu vòng
     */
    @Transactional
    public Category update(Long id, Category updated) {
        Category category = getById(id);
        category.setCategoryName(updated.getCategoryName());
        category.setImageUrl(updated.getImageUrl());
        category.setSortOrder(updated.getSortOrder());
        category.setActive(updated.isActive());

        // Chỉ đổi slug khi được gửi lên và khác slug hiện tại
        String newSlug = updated.getSlug();
        if (newSlug != null && !newSlug.isBlank() && !newSlug.equals(category.getSlug())) {
            if (categoryRepository.existsBySlug(newSlug)) {
                throw new BadRequestException("Slug đã tồn tại: " + newSlug);
            }
            category.setSlug(newSlug);
        }

        // Kiểm tra vòng lặp cha-con (bao gồm cả vòng lặp sâu nhiều cấp)
        Long pid = updated.getParentCategoryId();
        if (pid != null) {
            if (pid.equals(id))
                throw new BadRequestException("Danh mục không thể là cha của chính nó");
            if (!categoryRepository.existsById(pid))
                throw new BadRequestException("Danh mục cha không tồn tại: " + pid);
            if (wouldCreateCycle(id, pid))
                throw new BadRequestException("Không thể đặt cha: sẽ tạo vòng lặp trong cây danh mục");
        }
        category.setParentCategoryId(pid);

        return categoryRepository.save(category);
    }

    /**
     * Lấy danh sách danh mục con của một danh mục cha.
     *
     * @param parentId ID danh mục cha
     */
    public List<Category> getChildren(Long parentId) {
        return categoryRepository.findByParentCategoryIdOrderBySortOrderAsc(parentId);
    }

    /**
     * Lấy danh sách danh mục gốc (parentCategoryId=null).
     * Dùng để build menu cấp 1.
     */
    public List<Category> getRoots() {
        return categoryRepository.findByParentCategoryIdIsNullOrderBySortOrderAsc();
    }

    /**
     * Xóa danh mục.
     * Không cho xóa nếu còn danh mục con hoặc đang có sản phẩm thuộc danh mục này.
     */
    @Transactional
    public void delete(Long id) {
        if (categoryRepository.existsByParentCategoryId(id)) {
            throw new BadRequestException("Không thể xóa: danh mục còn con. Hãy xóa hoặc chuyển danh mục con trước.");
        }
        long productCount = productRepository.countByCategoryId(id);
        if (productCount > 0) {
            throw new BadRequestException(
                "Không thể xóa: danh mục đang có " + productCount + " sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.");
        }
        categoryRepository.deleteById(id);
    }

    /**
     * Cập nhật thứ tự hàng loạt — dùng cho kéo thả sắp xếp ở Admin.
     * Ném lỗi nếu có ID không tồn tại để tránh admin tưởng nhầm đã lưu thành công.
     */
    @Transactional
    public void reorder(List<Map<String, Object>> items) {
        for (Map<String, Object> item : items) {
            Long catId     = Long.valueOf(item.get("id").toString());
            int  sortOrder = Integer.parseInt(item.get("sortOrder").toString());
            Category cat   = categoryRepository.findById(catId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục khi sắp xếp: " + catId));
            cat.setSortOrder(sortOrder);
            categoryRepository.save(cat);
        }
    }

    /** Kiểm tra nếu đặt `id` làm con của `proposedParentId` có tạo vòng lặp không */
    private boolean wouldCreateCycle(Long id, Long proposedParentId) {
        Long cursor = proposedParentId;
        while (cursor != null) {
            if (cursor.equals(id)) return true;
            Category parent = categoryRepository.findById(cursor).orElse(null);
            if (parent == null) break;
            cursor = parent.getParentCategoryId();
        }
        return false;
    }
}