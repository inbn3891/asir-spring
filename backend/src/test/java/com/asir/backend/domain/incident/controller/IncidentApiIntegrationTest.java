package com.asir.backend.domain.incident.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.asir.backend.domain.incident.dto.IncidentRequest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class IncidentApiIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @DisplayName("정상적인 제보 요청 시 201 응답과 생성된 ID를 반환한다.")
    void report_Success_Integration() {
        IncidentRequest request = new IncidentRequest("12가3456", "http://video.url", "unique_hash_1");
        
        ResponseEntity<Long> response = restTemplate.withBasicAuth("user", "password").postForEntity("/api/v1/incidents", request, Long.class);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
    }
}
