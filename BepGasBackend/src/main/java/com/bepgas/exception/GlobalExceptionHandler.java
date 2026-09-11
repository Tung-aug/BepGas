package com.bepgas.exception;

import com.bepgas.dto.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

/**
 * Xử lý tập trung tất cả exception của ứng dụng.
 * @RestControllerAdvice: áp dụng cho mọi @RestController, trả JSON thay vì HTML error page.
 * Thứ tự ưu tiên: exception cụ thể hơn được xử lý trước (ResourceNotFoundException > Exception).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 404 Not Found — khi không tìm thấy tài nguyên trong DB.
     * Ném bởi: hầu hết service khi findById() trả Optional.empty().
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage()));
    }

    /**
     * 400 Bad Request — lỗi nghiệp vụ: vi phạm rule, dữ liệu không hợp lệ, thiếu quyền nhỏ.
     * Ném bởi: service khi kiểm tra business rule (tồn kho, trạng thái đơn, rate limit...).
     */
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(BadRequestException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    /**
     * 400 Bad Request — lỗi validate @Valid từ request body.
     * Tập hợp tất cả field error thành Map<fieldName, message> để frontend hiển thị.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = ((FieldError) error).getField();
            errors.put(field, error.getDefaultMessage());
        });
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, "Dữ liệu không hợp lệ", errors));
    }

    /**
     * 400 Bad Request — file upload vượt quá giới hạn kích thước
     * (spring.servlet.multipart.max-file-size/max-request-size trong application.properties).
     * Không có handler này thì lỗi rơi vào nhánh Exception chung, có thể trả 500 khó hiểu
     * hoặc bị container chặn trước khi tới Spring, khiến FE chỉ thấy lỗi network chung.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("File quá lớn — vui lòng chọn ảnh nhỏ hơn (tối đa 10MB)."));
    }

    /**
     * 500 Internal Server Error — catch-all cho mọi exception không được xử lý ở trên.
     * Trả message lỗi để dễ debug; production nên ẩn chi tiết và log ra file.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Lỗi server: " + ex.getMessage()));
    }
}
