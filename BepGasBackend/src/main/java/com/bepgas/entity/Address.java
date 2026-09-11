package com.bepgas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "addresses")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Address {

    /* ── ID: Jackson serialize thành "addressId" để frontend nhận được ── */
    @JsonProperty("addressId")
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "address_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(length = 20)
    private String phone;

    /* ── province → rename thành "city" để khớp với frontend ── */
    @Column(name = "province", length = 100)
    private String city;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String ward;

    /* ── street → rename thành "addressLine" để khớp với frontend ── */
    @Column(name = "street", length = 255)
    private String addressLine;

    /* ── Dùng Boolean (wrapper) thay boolean (primitive):
         Lombok sẽ generate getter getIsDefault() thay vì isDefault(),
         nên Jackson serialize thành "isDefault" (không bị strip prefix "is") ── */
    @Column(name = "is_default")
    @Builder.Default
    private Boolean isDefault = false;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}