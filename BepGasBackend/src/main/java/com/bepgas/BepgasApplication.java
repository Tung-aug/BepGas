package com.bepgas;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Điểm khởi động ứng dụng Spring Boot BepGas.
 * @SpringBootApplication = @Configuration + @EnableAutoConfiguration + @ComponentScan
 * → tự động cấu hình toàn bộ Spring context từ classpath và các bean được khai báo.
 * @EnableScheduling: kích hoạt @Scheduled — dùng để dọn các đơn VNPay bị bỏ dở (OrderCleanupScheduler).
 */
@SpringBootApplication
@EnableScheduling
public class BepgasApplication {
    public static void main(String[] args) {
        SpringApplication.run(BepgasApplication.class, args);
    }
}
