package com.bepgas.service;

import com.bepgas.entity.Coupon;
import com.bepgas.entity.DiscountType;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Quản lý mã giảm giá (Coupon): CRUD cho admin và validate khi thanh toán.
 * Hỗ trợ 2 loại giảm giá: percent (%) và fixed (số tiền cố định).
 * Kiểm tra đầy đủ: trạng thái, ngày hiệu lực, số lượt sử dụng, giá trị đơn tối thiểu.
 */
@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository couponRepository;

    /**
     * Lấy danh sách coupon đang kích hoạt — dùng để hiển thị gợi ý ở trang checkout.
     */
    public List<Coupon> getActiveCoupons() {
        return couponRepository.findByIsActiveTrue();
    }

    /**
     * Lấy toàn bộ coupon (kể cả đã tắt) — dùng cho trang Admin quản lý coupon.
     */
    public List<Coupon> getAll() {
        return couponRepository.findAll();
    }

    /**
     * Tìm coupon theo ID.
     *
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public Coupon getById(Long id) {
        return couponRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy coupon: " + id));
    }

    /** Validate các trường dữ liệu coupon — dùng cho cả create và update */
    private void validateFields(Coupon c) {
        if (c.getValue() == null || c.getValue().compareTo(BigDecimal.ZERO) <= 0)
            throw new BadRequestException("Giá trị giảm phải lớn hơn 0");
        if (c.getType() == DiscountType.percent && c.getValue().compareTo(BigDecimal.valueOf(100)) > 0)
            throw new BadRequestException("Giảm phần trăm không được vượt quá 100%");
        if (c.getMaxDiscount() != null && c.getMaxDiscount().compareTo(BigDecimal.ZERO) < 0)
            throw new BadRequestException("Giảm tối đa không được âm");
        if (c.getUsageLimit() != null && c.getUsageLimit() < 0)
            throw new BadRequestException("Số lần dùng không được âm");
        if (c.getStartDate() != null && c.getEndDate() != null
                && !c.getEndDate().isAfter(c.getStartDate()))
            throw new BadRequestException("Thời gian kết thúc phải sau thời gian bắt đầu");
    }

    /**
     * Tạo coupon mới. Chuẩn hoá mã về chữ hoa, kiểm tra trùng và validate dữ liệu.
     */
    public Coupon create(Coupon coupon) {
        if (coupon.getCode() == null || coupon.getCode().isBlank())
            throw new BadRequestException("Mã coupon không được để trống");
        coupon.setCode(coupon.getCode().trim().toUpperCase());
        validateFields(coupon);
        if (couponRepository.existsByCode(coupon.getCode()))
            throw new BadRequestException("Mã coupon đã tồn tại");
        return couponRepository.save(coupon);
    }

    /**
     * Cập nhật thông tin coupon (không cho đổi mã code sau khi tạo).
     */
    public Coupon update(Long id, Coupon updated) {
        validateFields(updated);
        Coupon coupon = getById(id);
        coupon.setType(updated.getType());
        coupon.setValue(updated.getValue());
        coupon.setMinOrderValue(updated.getMinOrderValue());
        coupon.setMaxDiscount(updated.getMaxDiscount());
        coupon.setUsageLimit(updated.getUsageLimit());
        coupon.setStartDate(updated.getStartDate());
        coupon.setEndDate(updated.getEndDate());
        coupon.setActive(updated.isActive());
        return couponRepository.save(coupon);
    }

    /**
     * Xóa coupon. Từ chối nếu mã đã được dùng trong đơn hàng — nên tắt thay vì xóa.
     */
    public void delete(Long id) {
        Coupon coupon = getById(id);
        if (coupon.getUsedCount() > 0)
            throw new BadRequestException(
                "Mã coupon đã được dùng " + coupon.getUsedCount() + " lần. Hãy tắt mã thay vì xóa.");
        couponRepository.deleteById(id);
    }

    /**
     * Validate mã coupon và tính số tiền giảm giá áp dụng cho đơn hàng.
     * Kiểm tra theo thứ tự: tồn tại → đang active → trong thời hạn → còn lượt dùng → đủ giá trị tối thiểu.
     * Tính discount:
     * - percent: orderTotal × value / 100, giới hạn bởi maxDiscount nếu có
     * - fixed: lấy value cố định
     * Kết quả không vượt quá orderTotal (tránh giảm giá âm).
     *
     * @param code       mã coupon người dùng nhập
     * @param orderTotal tổng tiền đơn hàng trước giảm giá
     * @return số tiền được giảm (>= 0, <= orderTotal)
     * @throws BadRequestException nếu coupon không hợp lệ ở bất kỳ bước kiểm tra nào
     */
    public BigDecimal validate(String code, BigDecimal orderTotal) {
        Coupon coupon = couponRepository.findByCode(code.trim().toUpperCase())
                .orElseThrow(() -> new BadRequestException("Mã giảm giá không hợp lệ"));

        if (!coupon.isActive()) throw new BadRequestException("Mã giảm giá không còn hiệu lực");

        LocalDateTime now = LocalDateTime.now();
        if (coupon.getStartDate() != null && now.isBefore(coupon.getStartDate()))
            throw new BadRequestException("Mã giảm giá chưa đến ngày sử dụng");
        if (coupon.getEndDate() != null && now.isAfter(coupon.getEndDate()))
            throw new BadRequestException("Mã giảm giá đã hết hạn");

        if (coupon.getUsageLimit() != null && coupon.getUsedCount() >= coupon.getUsageLimit())
            throw new BadRequestException("Mã giảm giá đã hết lượt sử dụng");

        if (coupon.getMinOrderValue() != null && orderTotal.compareTo(coupon.getMinOrderValue()) < 0)
            throw new BadRequestException("Đơn hàng chưa đạt giá trị tối thiểu để dùng coupon");

        BigDecimal discount;
        if (coupon.getType() == DiscountType.percent) {
            // Tính % giảm, áp trần maxDiscount nếu kết quả vượt ngưỡng
            discount = orderTotal.multiply(coupon.getValue()).divide(BigDecimal.valueOf(100));
            if (coupon.getMaxDiscount() != null && discount.compareTo(coupon.getMaxDiscount()) > 0) {
                discount = coupon.getMaxDiscount();
            }
        } else {
            // fixed: giảm thẳng số tiền cố định
            discount = coupon.getValue();
        }

        // Đảm bảo discount không vượt quá tổng tiền đơn (không giảm âm)
        return discount.min(orderTotal);
    }
}
