package com.bepgas.entity;

/**
 * Vai trò người dùng trong hệ thống.
 * Được lưu vào DB dạng chuỗi (EnumType.STRING) thay vì số nguyên để dễ đọc.
 */
public enum Role {
    customer,  // Khách hàng thông thường — mua hàng, xem đơn, đánh giá
    admin,     // Quản trị viên — toàn quyền: sản phẩm, đơn hàng, user, coupon, banner
    staff      // Nhân viên — xem & xử lý đơn hàng, quản lý khách hàng, không được vào dashboard tài chính
}
