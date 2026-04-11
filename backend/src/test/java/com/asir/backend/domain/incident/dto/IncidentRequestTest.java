package com.asir.backend.domain.incident.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

public class IncidentRequestTest {

    private final Validator validator;
    
    public IncidentRequestTest() {
            ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
            this.validator = factory.getValidator();
    }

    @Test
    @DisplayName("번호판 형식이 올바르지 않으면 예외가 발생해야 한다.")
    void invalidLicensePlateTest() {
        String[] invalidPlates = {"", " ", "12가123", "가123456", "ABC1234"};

        for (String plate : invalidPlates) {
            IncidentRequest request = new IncidentRequest(plate, "http://video.url", "hash123");

            Set<ConstraintViolation<IncidentRequest>> violations = validator.validate(request);

            assertThat(violations).as("번호판 '" + plate + "'은 검증 에러가 발생해야 함").isNotEmpty();
        }
    }
}
