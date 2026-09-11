package com.bepgas.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Wrapper chuẩn cho mọi response của API.
 * Frontend kiểm tra success=true/false để xử lý, đọc message để hiện thông báo.
 * Generic type T cho phép dùng chung: ApiResponse<User>, ApiResponse<List<Product>>...
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    private boolean success; // true = thành công, false = có lỗi
    private String message;  // thông báo hiển thị cho người dùng (null nếu không cần)
    private T data;          // dữ liệu trả về (null khi lỗi hoặc thao tác không cần dữ liệu)

    // Dùng khi chỉ trả dữ liệu, không cần thông báo (ví dụ: GET danh sách)
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, null, data);
    }

    // Dùng khi cần cả thông báo lẫn dữ liệu (ví dụ: "Đặt hàng thành công" + thông tin đơn)
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    // Dùng cho mọi loại lỗi — GlobalExceptionHandler gọi hàm này
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
