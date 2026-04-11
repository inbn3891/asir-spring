package com.asir.backend.domain.incident.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.asir.backend.domain.incident.entity.Incident;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    Optional<Incident> findByVideoHash(String videoHash);
}