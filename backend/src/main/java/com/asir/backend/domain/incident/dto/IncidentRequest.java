package com.asir.backend.domain.incident.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class IncidentRequest {
    
    @NotBlank
    @Pattern(regexp = "^\\d{2,3}[가-힣]\\d{4}$")
    private String licensePlate;

    @NotBlank
    private String videoUrl;

    @NotBlank
    private String videoHash;

    public IncidentRequest(String licensePlate, String videoUrl, String videoHash) {
        this.licensePlate = licensePlate;
        this.videoUrl = videoUrl;
        this.videoHash = videoHash;
    }
}