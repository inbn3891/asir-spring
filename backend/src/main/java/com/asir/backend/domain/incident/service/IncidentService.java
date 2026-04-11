package com.asir.backend.domain.incident.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asir.backend.domain.incident.dto.IncidentRequest;
import com.asir.backend.domain.incident.entity.Incident;
import com.asir.backend.domain.incident.repository.IncidentRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly= true)
public class IncidentService {
    private final IncidentRepository incidentRepository;

    @Transactional
    public Long report(IncidentRequest request) {
        incidentRepository.findByVideoHash(request.getVideoHash()).ifPresent(incident-> {
            throw new IllegalStateException("이미 동일한 영상으로 신고된 내역이 있습니다.");
        });

        Incident incident = Incident.builder()
        .licensePlate(request.getLicensePlate())
        .videoUrl(request.getVideoUrl())
        .videoHash(request.getVideoHash())
        .build();

        return incidentRepository.save(incident).getId();
    }
}