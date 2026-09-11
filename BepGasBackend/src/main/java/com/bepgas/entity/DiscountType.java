package com.bepgas.entity;

/**
 * Loại giảm giá của mã coupon.
 */
public enum DiscountType {
    percent, // Giảm theo % tổng đơn — ví dụ: 10% đơn 500k → giảm 50k (có thể bị giới hạn bởi maxDiscount)
    fixed    // Giảm số tiền cố định — ví dụ: giảm thẳng 30.000đ bất kể tổng đơn bao nhiêu
}
