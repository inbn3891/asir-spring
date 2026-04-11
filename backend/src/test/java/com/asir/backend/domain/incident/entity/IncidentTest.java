package com.asir.backend.domain.incident.entity;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;;

public class IncidentTest {
    
    @Test
    @DisplayName("영상 URL이 없으면 객체 생성 시 예외 발생")
    void validateVideoUrl() {
        assertThatThrownBy(() -> {
            Incident.builder()
            .licensePlate("12가3456")
            .videoUrl(null)
            .build();
        }).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("올바르지 않은 번호판 형식일 경우 예외가 발생")
    void validateLicensePlate() {

        String[] invalidPlates = {"abc1234", "12가123", "1234가12", "가123456", "abcdefghijklmn", "가나다라마바사아자차카타파하"};

        for (String plate : invalidPlates) {

            assertThatThrownBy(() -> {
                Incident.builder()
                .licensePlate(plate)
                .videoUrl("http://test.com/video.mp4")
                .videoHash("hash123")
                .build();
            }).isInstanceOf(IllegalArgumentException.class);
        }
    }
}
