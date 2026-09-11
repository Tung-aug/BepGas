package com.bepgas.entity;

/**
 * Trạng thái hiển thị của sản phẩm.
 * Được đồng bộ tự động với tồn kho trong ProductService.buildProduct():
 * stockQty = 0 → out_of_stock; stockQty > 0 + out_of_stock → active.
 */
public enum ProductStatus {
    active,       // Đang bán — hiển thị công khai, khách có thể mua
    inactive,     // Ẩn — admin tạm ngừng bán, không hiện ở trang khách hàng
    out_of_stock  // Hết hàng — vẫn hiển thị trang sản phẩm với badge "Hết hàng", không thể thêm vào giỏ
}
