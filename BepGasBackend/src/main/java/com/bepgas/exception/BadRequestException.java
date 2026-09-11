package com.bepgas.exception;

/**
 * Exception ném khi request vi phạm business rule hoặc dữ liệu không hợp lệ.
 * GlobalExceptionHandler bắt và trả HTTP 400 Bad Request.
 * Ví dụ: tồn kho không đủ, coupon hết hạn, trạng thái đơn sai, rate limit vượt ngưỡng.
 */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
