package com.bepgas.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Response đầy đủ thông tin sản phẩm trả về cho client (cả public lẫn admin).
 * rating và reviewCount được tính live từ DB mỗi lần gọi toResponse() trong ProductService.
 */
@Data
@Builder
public class ProductResponse {
    private Long        id;
    private String      name;            // Tên sản phẩm
    private String      slug;            // Slug URL: "bep-gas-namilux-na-399t"
    private String      description;     // Mô tả chi tiết (HTML)
    private String      shortDesc;       // Mô tả ngắn hiện trên card danh sách
    private String      sku;             // Mã SKU nội bộ để quản lý kho
    private Long        categoryId;
    private String      categoryName;    // Tên danh mục — để hiện breadcrumb
    private Long        brandId;
    private String      brandName;       // Tên thương hiệu
    private BigDecimal  price;           // Giá gốc
    private BigDecimal  salePrice;       // Giá khuyến mãi — null nếu không giảm giá
    private int         stockQty;        // Tồn kho hiện tại
    private int         soldQty;         // Tổng đã bán — dùng để tính "Top bán chạy"
    private int         warrantyMonths;  // Bảo hành bao nhiêu tháng (0 = không bảo hành)
    @com.fasterxml.jackson.annotation.JsonProperty("isFeatured")
    private boolean     isFeatured;      // Sản phẩm nổi bật — hiện ở trang chủ, badge "Hot"
    private boolean     requiresInstallation; // Cần lắp đặt — tính thêm phí installationFee
    private BigDecimal  installationFee; // null = dùng phí mặc định 150k
    private BigDecimal  weight;          // Cân nặng (kg) — dùng để tính phí vận chuyển sau này
    private String      status;          // "active" / "inactive" / "out_of_stock"
    private String      specifications;  // JSON string thông số kỹ thuật (công suất, kích thước...)
    private String      primaryImageUrl; // Ảnh đại diện (isPrimary=true) — hiện ở card và thumbnail
    private List<String> imageUrls;      // Toàn bộ URL ảnh theo sortOrder — dùng cho gallery
    private LocalDateTime createdAt;
    private Double      rating;          // Điểm trung bình đánh giá (null nếu chưa có review)
    private int         reviewCount;     // Số lượng đánh giá đang visible
}
