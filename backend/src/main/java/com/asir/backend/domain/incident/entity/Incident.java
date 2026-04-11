package com.asir.backend.domain.incident.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "incident")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20)
    private String licensePlate; 

    private String representativeType;

    private Float confidenceScore;

    @Enumerated(EnumType.STRING)
    private IncidentStatus status;

    @Column(nullable = false)
    private String videoUrl;

    @Column(length = 64, nullable = false)
    private String videoHash;

    private LocalDateTime createdAt; 

    @Builder
    public Incident(String licensePlate, String representativeType, Float confidenceScore, 
                    IncidentStatus status,
                     String videoUrl, String videoHash) {
        if (videoUrl == null || videoUrl.isBlank()) {
                throw new IllegalArgumentException("영상 URL은 필수 입니다.");
        }

        String platePattern = "^\\d{2,3}[가-힣]\\d{4}$";

        if (licensePlate == null || !java.util.regex.Pattern.matches(platePattern, licensePlate)) {
            throw new IllegalArgumentException("올바른 번호판 형식이 아닙니다.");
        }

        this.licensePlate = licensePlate;
        this.representativeType = representativeType;
        this.confidenceScore = confidenceScore;
        this.status = (status != null) ? status : IncidentStatus.WAITING; 
        this.videoUrl = videoUrl;
        this.videoHash = videoHash;
        this.createdAt = LocalDateTime.now(); 
    }
}