package com.bepgas.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Dữ liệu gửi lên khi tạo/cập nhật sản phẩm — POST/PUT /api/products.
 * Hỗ trợ partial update: field nào null thì ProductService.buildProduct() giữ nguyên giá trị cũ.
 * Chỉ name bắt buộc khi tạo mới; khi cập nhật tất cả field đều tùy chọn.
 */
@Data
public class ProductRequest {

    @NotBlank // Tên sản phẩm bắt buộc khi tạo mới
    private String name;

    private String slug;           // Slug URL — null: giữ nguyên; không null: validate unique
    private String description;    // Mô tả chi tiết (HTML)
    private String shortDesc;      // Mô tả ngắn hiện trên card danh sách
    private String sku;            // Mã SKU nội bộ
    private String specifications; // JSON string thông số kỹ thuật
    private Long   categoryId;     // ID danh mục — null: giữ danh mục cũ
    private Long   brandId;        // ID thương hiệu — null: giữ thương hiệu cũ

    @Min(value = 0, message = "Thời gian bảo hành không được âm")
    private Integer warrantyMonths; // Số tháng bảo hành (0 = không bảo hành)

    private Boolean requiresInstallation; // true = sẽ tính thêm phí lắp đặt

    @DecimalMin(value = "0", inclusive = true, message = "Phí lắp đặt không được âm")
    private BigDecimal installationFee; // null = dùng phí mặc định 150k trong OrderService

    @DecimalMin(value = "0", inclusive = true, message = "Cân nặng không được âm")
    private Double weight; // kg

    private Boolean isFeatured; // true = hiện ở trang chủ khu vực "Sản phẩm nổi bật"
    private String  status;     // "active" / "inactive" / "out_of_stock"

    @DecimalMin(value = "0.01", message = "Giá phải lớn hơn 0")
    private BigDecimal price; // Giá gốc

    @DecimalMin(value = "0", inclusive = true, message = "Giá khuyến mãi không được âm")
    private BigDecimal salePrice; // Giá khuyến mãi — null = không khuyến mãi

    @Min(value = 0, message = "Tồn kho không được âm")
    private Integer stockQty; // Tồn kho — buildProduct() tự đồng bộ status dựa trên giá trị này
}
