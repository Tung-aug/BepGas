package com.bepgas.entity;

/**
 * Vị trí hiển thị banner trên giao diện.
 */
public enum BannerPosition {
    hero,    // Slider ảnh lớn đầu trang chủ — thường là banner chính quảng cáo sản phẩm nổi bật
    sidebar, // Cột bên phải/trái — quảng cáo nhỏ bên cạnh danh sách sản phẩm
    popup,   // Popup hiện khi vào trang — thường dùng cho khuyến mãi thời hạn ngắn
    scroll   // Băng chuyền thương hiệu cuộn ngang — hiển thị logo các hãng đang bán
}
