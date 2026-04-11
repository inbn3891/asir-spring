package com.asir.backend.global.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleIllegalStateException(IllegalStateException e) {
        // 서비스에서 던진 "이미 동일한 영상..." 메시지를 담아 400 에러 반환
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .header("Content-Type", "text/plain;charset=UTF-8")
                .body(e.getMessage());
    }
}
