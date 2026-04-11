package com.asir.backend.domain.incident.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;

import com.asir.backend.domain.incident.dto.IncidentRequest;
import com.asir.backend.domain.incident.repository.IncidentRepository;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Transactional
public class IncidentServiceIntegrationTest {
    @Autowired 
    private IncidentService incidentService;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private IncidentRepository repository;

    @AfterEach
    void tearDown() {
        repository.deleteAll(); // 테스트가 성공하든 실패하든 깔끔하게 비우기
    }

    @Test
    @DisplayName("중복된 영상 해시로 제보하면 예외가 발생해야 한다.")
    void duplicateHashTest() {
        IncidentRequest firstRequest = new IncidentRequest("12가3456", "url1", "SAME_HASH");
        incidentService.report(firstRequest);

        IncidentRequest secondRequest = new IncidentRequest("99하9999", "url2", "SAME_HASH");

        assertThatThrownBy(() ->
            incidentService.report(secondRequest))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("이미 동일한 영상");
    }

    @Test
    @DisplayName("중복된 영상 해시로 제보하면 400 에러와 명확한 메시지를 반환해야 한다.")
    void duplicateReport_Returns_400() {
        // 1. 첫 번째 제보 성공
        IncidentRequest request = new IncidentRequest("12가3456", "url", "SAME_HASH");
        restTemplate.postForEntity("/api/v1/incidents", request, String.class);

        // 2. 동일한 해시로 두 번째 제보
        ResponseEntity<String> response = restTemplate.postForEntity("/api/v1/incidents", request, String.class);

        // 팩트 체크: 현재는 500이 뜨겠지만, 우리의 목표는 400입니다.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("이미 동일한 영상으로 신고된 내역이 있습니다.");
    }

}
