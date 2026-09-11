package com.bepgas.entity;

/**
 * Phương thức thanh toán của đơn hàng.
 */
public enum PaymentMethod {
    cod,   // Cash On Delivery — thanh toán tiền mặt khi nhận hàng, staff xác nhận thu tiền thủ công
    vnpay  // Thanh toán online qua cổng VNPay — tự động cập nhật paid qua IPN/callback
}
