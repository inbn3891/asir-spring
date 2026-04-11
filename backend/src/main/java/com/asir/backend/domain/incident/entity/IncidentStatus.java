package com.asir.backend.domain.incident.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum IncidentStatus {

    WAITING("대기 중"),      // 시스템이 영상을 분석하기 전 초기 상태
    PROCESSING("처리 중"),   // AI 분석 또는 관리자 확인 중
    COMPLETED("완료"),      // 분석 결과 통보 완료
    REJECTED("반려");       // 영상 불량 등으로 인한 반려
    
    private final String description;
}