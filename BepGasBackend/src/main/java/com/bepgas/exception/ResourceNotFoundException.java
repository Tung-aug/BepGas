package com.bepgas.exception;

/**
 * Exception ném khi không tìm thấy tài nguyên trong DB.
 * GlobalExceptionHandler bắt và trả HTTP 404 Not Found.
 * Dùng RuntimeException để không bắt buộc try-catch ở nơi ném.
 */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
