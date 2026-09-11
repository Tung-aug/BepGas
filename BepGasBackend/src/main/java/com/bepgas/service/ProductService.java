package com.bepgas.service;

import com.bepgas.dto.request.ProductRequest;
import com.bepgas.dto.response.ProductResponse;
import com.bepgas.entity.*;
import com.bepgas.exception.BadRequestException;
import com.bepgas.exception.ResourceNotFoundException;
import com.bepgas.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import java.math.BigDecimal;
import java.util.List;

/**
 * Xử lý nghiệp vụ sản phẩm: CRUD, lọc theo danh mục/thương hiệu/từ khóa,
 * quản lý ảnh sản phẩm (upload ImgBB, xóa, đặt ảnh chính).
 * Public API trả active + out_of_stock; chỉ ẩn inactive.
 */
@Service
@RequiredArgsConstructor
public class ProductService {

    private static final List<ProductStatus> PUBLIC_STATUSES =
        List.of(ProductStatus.active, ProductStatus.out_of_stock);

    private final ProductRepository        productRepository;
    private final CategoryRepository       categoryRepository;
    private final BrandRepository          brandRepository;
    private final ProductImageRepository   productImageRepository;
    private final ImgBBService             imgBBService;
    private final ReviewRepository         reviewRepository;

    /**
     * Lấy danh sách sản phẩm public (active + out_of_stock). Chỉ ẩn inactive.
     */
    @Transactional(readOnly = true)
    public Page<ProductResponse> getAll(Pageable pageable) {
        return productRepository.findByStatusIn(PUBLIC_STATUSES, pageable).map(this::toResponse);
    }

    /**
     * Tìm kiếm sản phẩm theo tên — trả active + out_of_stock.
     */
    @Transactional(readOnly = true)
    public Page<ProductResponse> search(String keyword, Pageable pageable) {
        return productRepository.findByProductNameContainingIgnoreCaseAndStatusIn(keyword, PUBLIC_STATUSES, pageable)
                .map(this::toResponse);
    }

    /**
     * Lấy sản phẩm public theo danh mục — active + out_of_stock.
     */
    @Transactional(readOnly = true)
    public Page<ProductResponse> getByCategory(Long categoryId, Pageable pageable) {
        return productRepository.findByCategoryIdAndStatusIn(categoryId, PUBLIC_STATUSES, pageable).map(this::toResponse);
    }

    /**
     * Lấy sản phẩm public theo thương hiệu — active + out_of_stock.
     */
    @Transactional(readOnly = true)
    public Page<ProductResponse> getByBrand(Long brandId, Pageable pageable) {
        return productRepository.findByBrandIdAndStatusIn(brandId, PUBLIC_STATUSES, pageable).map(this::toResponse);
    }

    /**
     * Lấy sản phẩm của danh mục cha + toàn bộ danh mục con (BFS, mọi cấp).
     * Dùng cho /products/category/{id}/tree — giúp frontend một lần gọi thay vì N lần song song.
     */
    @Transactional(readOnly = true)
    public Page<ProductResponse> getByCategoryTree(Long categoryId, Pageable pageable) {
        // BFS thu thập tất cả ID (cha + con ở mọi cấp)
        List<Long> ids = new java.util.ArrayList<>();
        java.util.Queue<Long> queue = new java.util.LinkedList<>();
        queue.add(categoryId);
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            ids.add(current);
            categoryRepository.findByParentCategoryIdOrderBySortOrderAsc(current)
                    .forEach(c -> queue.add(c.getId()));
        }
        return productRepository.findByCategoryIdInAndStatusIn(ids, PUBLIC_STATUSES, pageable)
                .map(this::toResponse);
    }

    /**
     * Lấy chi tiết sản phẩm theo ID — trả 404 nếu inactive.
     * out_of_stock vẫn hiển thị để khách xem + badge "Hết hàng".
     */
    @Transactional(readOnly = true)
    public ProductResponse getById(Long id) {
        Product product = findById(id);
        if (!PUBLIC_STATUSES.contains(product.getStatus())) {
            throw new ResourceNotFoundException("Không tìm thấy sản phẩm: " + id);
        }
        return toResponse(product);
    }

    /**
     * Top sản phẩm bán chạy nhất (cho Dashboard admin).
     * Query dùng JOIN FETCH brand+category nên không cần lazy load sau session.
     *
     * @param limit số sản phẩm tối đa cần lấy
     */
    @Transactional(readOnly = true)
    public java.util.List<ProductResponse> getTopSelling(int limit) {
        org.springframework.data.domain.Pageable pageable =
            org.springframework.data.domain.PageRequest.of(0, limit,
                org.springframework.data.domain.Sort.unsorted()); // sort đã có trong @Query
        return productRepository
            .findTopSelling(0, pageable) // không lọc status — tính theo lịch sử soldQty
            .stream().map(this::toResponse).toList();
    }

    /**
     * Sản phẩm sắp hết hàng (stockQty <= maxStock) — cho Dashboard admin.
     * Query dùng JOIN FETCH, sort đã có trong @Query.
     *
     * @param limit    số sản phẩm tối đa
     * @param maxStock ngưỡng tồn kho thấp (ví dụ: 5)
     */
    @Transactional(readOnly = true)
    public java.util.List<ProductResponse> getLowStock(int limit, int maxStock) {
        org.springframework.data.domain.Pageable pageable =
            org.springframework.data.domain.PageRequest.of(0, limit,
                org.springframework.data.domain.Sort.unsorted()); // sort đã có trong @Query
        // stockQty=0 → status tự động chuyển thành out_of_stock, không còn là active
        ProductStatus status = maxStock == 0 ? ProductStatus.out_of_stock : ProductStatus.active;
        return productRepository
            .findLowStock(status, maxStock, pageable)
            .stream().map(this::toResponse).toList();
    }

    /**
     * Danh sách sản phẩm cho Admin với filter tùy chọn (search, status).
     * Chạy trong @Transactional nên p.getBrand(), p.getCategory() không ném LazyInitException
     * — JPA session vẫn mở khi map sang DTO.
     *
     * @param search  tên sản phẩm cần tìm (null = không lọc)
     * @param status  trạng thái (active/inactive/out_of_stock — null = tất cả)
     * @param pageable phân trang
     */
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<ProductResponse> getAdminPage(
            String search, String status,
            org.springframework.data.domain.Pageable pageable) {

        org.springframework.data.domain.Page<Product> products;

        // Kết hợp filter: cả search lẫn status → và; chỉ một → hoặc; không có → tất cả
        if (search != null && !search.isBlank() && status != null && !status.isBlank()) {
            products = productRepository.findByProductNameContainingIgnoreCaseAndStatus(
                    search, ProductStatus.valueOf(status), pageable);
        } else if (search != null && !search.isBlank()) {
            products = productRepository.findByProductNameContainingIgnoreCase(search, pageable);
        } else if (status != null && !status.isBlank()) {
            products = productRepository.findByStatus(ProductStatus.valueOf(status), pageable);
        } else {
            products = productRepository.findAll(pageable);
        }

        return products.map(this::toResponse); // session vẫn mở → Brand/Category khởi tạo được
    }

    /**
     * Lấy chi tiết sản phẩm theo slug — trả 404 nếu inactive.
     * out_of_stock vẫn hiển thị để khách xem + badge "Hết hàng".
     *
     * @param slug slug duy nhất của sản phẩm (ví dụ: "bep-gas-namilux-na-399t")
     */
    @Transactional(readOnly = true)
    public ProductResponse getBySlug(String slug) {
        Product product = productRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm: " + slug));
        if (!PUBLIC_STATUSES.contains(product.getStatus())) {
            throw new ResourceNotFoundException("Không tìm thấy sản phẩm: " + slug);
        }
        return toResponse(product);
    }

    /**
     * Admin tạo sản phẩm mới. Kiểm tra slug chưa tồn tại trước khi tạo.
     *
     * @param request thông tin sản phẩm
     * @throws BadRequestException nếu slug đã tồn tại
     */
    @Transactional
    public ProductResponse create(ProductRequest request) {
        if (request.getSlug() != null && productRepository.existsBySlug(request.getSlug())) {
            throw new BadRequestException("Slug đã tồn tại");
        }
        return toResponse(productRepository.save(buildProduct(new Product(), request)));
    }

    /**
     * Admin cập nhật sản phẩm. Sử dụng buildProduct để apply partial update
     * (chỉ update field nào không null trong request).
     *
     * @param id      ID sản phẩm cần cập nhật
     * @param request thông tin mới (chỉ field cần thay đổi, còn lại để null)
     */
    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product existing = findById(id);
        if (request.getSlug() != null
                && !request.getSlug().equals(existing.getSlug())
                && productRepository.existsBySlug(request.getSlug())) {
            throw new BadRequestException("Slug '" + request.getSlug() + "' đã được dùng bởi sản phẩm khác");
        }
        return toResponse(productRepository.save(buildProduct(existing, request)));
    }

    /**
     * Admin xóa sản phẩm cùng toàn bộ ảnh liên quan (cascade).
     *
     * @param id ID sản phẩm cần xóa
     */
    @Transactional
    public void delete(Long id) {
        productRepository.deleteById(id);
    }

    // ── Quản lý ảnh sản phẩm ────────────────────────────────────

    /**
     * Lưu URL ảnh đã upload sẵn vào DB (dùng khi frontend upload ImgBB trực tiếp).
     * Ảnh đầu tiên tự động được đặt làm ảnh chính (isPrimary=true).
     *
     * @param productId ID sản phẩm
     * @param imageUrl  URL ảnh trên ImgBB
     * @param altText   mô tả ảnh (có thể null)
     */
    @Transactional
    public ProductImage saveImageUrl(Long productId, String imageUrl, String altText) {
        Product product = findById(productId);
        List<ProductImage> existing = productImageRepository.findByProductIdOrderBySortOrderAsc(productId);
        boolean hasPrimary = existing.stream().anyMatch(ProductImage::isPrimary);

        // sortOrder = vị trí cuối; nếu chưa có ảnh chính → đây là ảnh chính
        ProductImage img = ProductImage.builder()
                .product(product)
                .imageUrl(imageUrl)
                .sortOrder(existing.size())
                .isPrimary(!hasPrimary)
                .build();
        return productImageRepository.save(img);
    }

    /**
     * Lấy danh sách ảnh của sản phẩm, sắp xếp theo sortOrder tăng dần.
     */
    public List<ProductImage> getImages(Long productId) {
        findById(productId); // xác nhận sản phẩm tồn tại
        return productImageRepository.findByProductIdOrderBySortOrderAsc(productId);
    }

    /**
     * Upload nhiều file ảnh lên ImgBB và lưu URL vào DB.
     * Ảnh đầu tiên upload trở thành ảnh chính nếu sản phẩm chưa có ảnh chính.
     *
     * @param productId ID sản phẩm
     * @param files     danh sách file ảnh từ multipart request
     * @return danh sách ảnh sau khi thêm mới
     */
    @Transactional
    public List<ProductImage> uploadImages(Long productId, List<MultipartFile> files) {
        Product product = findById(productId);
        boolean hasPrimary = productImageRepository
                .findByProductIdOrderBySortOrderAsc(productId).stream()
                .anyMatch(ProductImage::isPrimary);
        int sortOrder = productImageRepository
                .findByProductIdOrderBySortOrderAsc(productId).size();

        for (MultipartFile file : files) {
            // Upload lên ImgBB — API key cấu hình trong application.properties (imgbb.api-key)
            String url = imgBBService.upload(file);
            ProductImage img = ProductImage.builder()
                    .product(product)
                    .imageUrl(url)
                    .sortOrder(sortOrder++)
                    .isPrimary(!hasPrimary) // chỉ ảnh đầu tiên được isPrimary=true
                    .build();
            productImageRepository.save(img);
            hasPrimary = true; // các ảnh tiếp theo không phải ảnh chính
        }
        return productImageRepository.findByProductIdOrderBySortOrderAsc(productId);
    }

    /**
     * Xóa ảnh khỏi DB. ImgBB free plan không hỗ trợ xóa qua API nên chỉ xóa record trong DB.
     *
     * @param imageId ID ảnh cần xóa
     */
    @Transactional
    public void deleteImage(Long imageId) {
        ProductImage img = productImageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ảnh: " + imageId));
        boolean wasPrimary = img.isPrimary();
        Long productId = img.getProduct().getId();
        productImageRepository.delete(img);
        // Khi xóa ảnh chính, tự động promote ảnh đầu tiên còn lại
        if (wasPrimary) {
            productImageRepository.findByProductIdOrderBySortOrderAsc(productId)
                    .stream().findFirst().ifPresent(next -> {
                        next.setPrimary(true);
                        productImageRepository.save(next);
                    });
        }
    }

    /**
     * Đặt một ảnh làm ảnh chính, đồng thời bỏ isPrimary của tất cả ảnh còn lại.
     *
     * @param imageId ID ảnh cần đặt làm ảnh chính
     */
    @Transactional
    public void setPrimaryImage(Long imageId) {
        ProductImage target = productImageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ảnh: " + imageId));
        // Cập nhật tất cả ảnh của cùng sản phẩm: target=true, còn lại=false
        productImageRepository
                .findByProductIdOrderBySortOrderAsc(target.getProduct().getId())
                .forEach(img -> {
                    img.setPrimary(img.getId().equals(imageId));
                    productImageRepository.save(img);
                });
    }

    /**
     * Tìm sản phẩm theo ID — dùng nội bộ trong service.
     *
     * @throws ResourceNotFoundException nếu không tìm thấy
     */
    public Product findById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm: " + id));
    }

    /**
     * Map ProductRequest vào Product entity (create hoặc update).
     * Chỉ update field không null — pattern partial update, giữ nguyên giá trị cũ nếu không gửi.
     *
     * @param product entity gốc (new Product() nếu tạo mới, findById() nếu update)
     * @param request dữ liệu mới từ client
     */
    private Product buildProduct(Product product, ProductRequest request) {
        if (request.getName()           != null) product.setProductName(request.getName());
        if (request.getDescription()    != null) product.setDescription(request.getDescription());
        if (request.getShortDesc()      != null) product.setShortDesc(request.getShortDesc());
        if (request.getSku()            != null) product.setSku(request.getSku());
        if (request.getSpecifications() != null) product.setSpecifications(request.getSpecifications());

        if (request.getSlug()                != null) product.setSlug(request.getSlug());
        if (request.getStatus()              != null) product.setStatus(ProductStatus.valueOf(request.getStatus()));
        if (request.getWarrantyMonths()      != null) product.setWarrantyMonths(request.getWarrantyMonths());
        if (request.getRequiresInstallation()!= null) product.setRequiresInstallation(request.getRequiresInstallation());
        if (request.getInstallationFee()     != null) product.setInstallationFee(request.getInstallationFee());
        if (request.getIsFeatured()          != null) product.setFeatured(request.getIsFeatured());
        if (request.getWeight()              != null) product.setWeight(java.math.BigDecimal.valueOf(request.getWeight()));
        if (request.getPrice()               != null) product.setPrice(request.getPrice());
        if (request.getSalePrice()           != null) product.setSalePrice(request.getSalePrice());
        if (request.getStockQty()            != null) product.setStockQty(request.getStockQty());

        if (request.getCategoryId() != null) {
            product.setCategory(categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy danh mục: " + request.getCategoryId())));
        }
        if (request.getBrandId() != null) {
            product.setBrand(brandRepository.findById(request.getBrandId())
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy thương hiệu: " + request.getBrandId())));
        }

        // Đồng bộ trạng thái với tồn kho
        // stockQty = 0 → out_of_stock (trừ khi admin đặt inactive); stockQty > 0 + out_of_stock → active
        if (product.getStockQty() == 0 && product.getStatus() != ProductStatus.inactive) {
            product.setStatus(ProductStatus.out_of_stock);
        } else if (product.getStockQty() > 0 && product.getStatus() == ProductStatus.out_of_stock) {
            product.setStatus(ProductStatus.active);
        }

        return product;
    }

    /**
     * Chuyển đổi Product entity sang ProductResponse DTO.
     * Lấy danh sách ảnh từ DB, xác định ảnh chính (isPrimary hoặc ảnh đầu tiên nếu không có isPrimary).
     *
     * @param p entity cần convert
     * @return ProductResponse đầy đủ thông tin gửi về client
     */
    public ProductResponse toResponse(Product p) {
        List<ProductImage> imgs = productImageRepository
                .findByProductIdOrderBySortOrderAsc(p.getId());

        List<String> imageUrls = imgs.stream().map(ProductImage::getImageUrl).toList();

        // Ưu tiên ảnh có isPrimary=true; fallback về ảnh đầu tiên nếu không có
        String primaryImageUrl = imgs.stream()
                .filter(ProductImage::isPrimary)
                .map(ProductImage::getImageUrl)
                .findFirst()
                .orElse(imageUrls.isEmpty() ? null : imageUrls.get(0));

        return ProductResponse.builder()
                .id(p.getId())
                .name(p.getProductName())
                .slug(p.getSlug())
                .description(p.getDescription())
                .shortDesc(p.getShortDesc())
                .sku(p.getSku())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getCategoryName() : null)
                .brandId(p.getBrand() != null ? p.getBrand().getId() : null)
                .brandName(p.getBrand() != null ? p.getBrand().getBrandName() : null)
                .price(p.getPrice())
                .salePrice(p.getSalePrice())
                .stockQty(p.getStockQty())
                .soldQty(p.getSoldQty())
                .warrantyMonths(p.getWarrantyMonths())
                .isFeatured(p.isFeatured())
                .requiresInstallation(p.isRequiresInstallation())
                .installationFee(p.getInstallationFee())
                .weight(p.getWeight())
                .status(p.getStatus().name())
                .specifications(p.getSpecifications())
                .primaryImageUrl(primaryImageUrl)
                .imageUrls(imageUrls)
                .createdAt(p.getCreatedAt())
                .rating(reviewRepository.findAverageRatingByProductId(p.getId()))
                .reviewCount((int) reviewRepository.countByProductIdAndIsVisibleTrue(p.getId()))
                .build();
    }
}
