package com.asir.backend.domain.incident.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.asir.backend.domain.incident.entity.Incident;
import com.asir.backend.domain.incident.entity.IncidentStatus;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
public class IncidentRepositoryTest {
    
    @Autowired
    private IncidentRepository incidentRepository;

    @Test
    @DisplayName("실제 MariaDB에 제보 정보가 정상적으로 저장되어야 한다.")
    void saveTest() {
        
        // given
        Incident incident = Incident.builder()
        .licensePlate("12가3456")
        .videoUrl("http://storage.com/asir/test.mp4")
        .videoHash("abc123hash")
        .build()
        ;

        // when
        Incident saved = incidentRepository.save(incident);

        // then
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(IncidentStatus.WAITING);
        System.out.println("저장된 ID : " + saved.getId());
        System.out.println("초기 상태 : " + saved.getStatus());
            
    }

}
