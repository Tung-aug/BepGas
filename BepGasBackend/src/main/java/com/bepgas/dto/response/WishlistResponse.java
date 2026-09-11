package com.bepgas.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Response cho mỗi item trong danh sách yêu thích.
 * Chứa đủ thông tin để hiển thị card sản phẩm trên trang Wishlist mà không cần gọi thêm API.
 */
@Data
@Builder
public class WishlistResponse {
    private Long       id;              // ID wishlist item (dùng để xóa)
    private Long       productId;       // ID sản phẩm
    private String     productName;     // Tên sản phẩm hiển thị trên card
    private String     slug;            // Slug để tạo link chi tiết sản phẩm
    private BigDecimal price;           // Giá gốc
    private BigDecimal salePrice;       // Giá khuyến mãi — null nếu không đang khuyến mãi
    private String     primaryImageUrl; // Ảnh đại diện sản phẩm
    private Boolean    isFeatured;      // true = sản phẩm nổi bật — có thể hiện badge "Hot"
}