package com.asir.backend.domain.incident.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asir.backend.domain.incident.dto.IncidentRequest;
import com.asir.backend.domain.incident.service.IncidentService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
public class IncidentController {
    private final IncidentService incidentService;

    @PostMapping
    public ResponseEntity<Long> report(@RequestBody @Valid IncidentRequest request) {
        Long incidentId = incidentService.report(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentId);
    }
}