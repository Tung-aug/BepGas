package com.bepgas.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cấu hình Swagger/OpenAPI (Springdoc) cho tài liệu API.
 * Truy cập: http://localhost:8080/swagger-ui/index.html (khi chạy dev).
 * Tích hợp JWT Bearer authentication — nhập token vào nút "Authorize" để test endpoint có bảo mật.
 */
@Configuration
public class SwaggerConfig {

    /**
     * Cấu hình OpenAPI với:
     * - Info: tên, mô tả, phiên bản API
     * - SecurityScheme "Bearer": kiểu HTTP bearer với format JWT
     *   → Swagger UI hiển thị nút "Authorize" để nhập token test các endpoint yêu cầu JWT
     */
    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("BepGas API")
                        .description("API cho website thương mại điện tử thiết bị nhà bếp")
                        .version("1.0.0"))
                .addSecurityItem(new SecurityRequirement().addList("Bearer"))
                .components(new Components()
                        .addSecuritySchemes("Bearer", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
