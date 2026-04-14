package com.asir.backend.domain.incident.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asir.backend.domain.incident.dto.IncidentRequest;
import com.asir.backend.domain.incident.entity.Incident;
import com.asir.backend.domain.incident.repository.IncidentRepository;

import lombok.RequiredArgsConstructor;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String REDIS_KEY_PREFIX = "incident:hash:";
    private static final long CACHE_TTL_HOURS = 24;

    @Transactional
    public Long report(IncidentRequest request) {
        String redisKey = REDIS_KEY_PREFIX + request.getVideoHash();

        // 1. Redis 캐시 먼저 확인 (빠름)
        if (Boolean.TRUE.equals(redisTemplate.hasKey(redisKey))) {
            throw new IllegalStateException("이미 동일한 영상으로 신고된 내역이 있습니다.");
        }

        // 2. DB 중복 확인 (느림)
        incidentRepository.findByVideoHash(request.getVideoHash())
            .ifPresent(incident -> {
                throw new IllegalStateException("이미 동일한 영상으로 신고된 내역이 있습니다.");
            });

        // 3. 저장
        Incident incident = Incident.builder()
            .licensePlate(request.getLicensePlate())
            .videoUrl(request.getVideoUrl())
            .videoHash(request.getVideoHash())
            .build();

        Incident saved = incidentRepository.save(incident);

        // 4. Redis 캐시 저장 (24시간)
        redisTemplate.opsForValue().set(
            redisKey,
            String.valueOf(saved.getId()),
            CACHE_TTL_HOURS,
            TimeUnit.HOURS
        );

        return saved.getId();
    }
}