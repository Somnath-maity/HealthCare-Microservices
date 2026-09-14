package com.healthcare.api.tests.auth;

import com.healthcare.api.base.BaseTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

public class LoginTests extends BaseTest {
    @Test
    void adminCanLoginSuccessfully() {
        String requestBody = """
            {
                "email": "admin@healthcare.com",
                "password": "Admin@123"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("accessToken", notNullValue())
                .body("refreshToken", notNullValue())
                .body("user._id", notNullValue())
                .body("user.email", equalTo("admin@healthcare.com"))
                .body("user.role", equalTo("admin"))
                .body("message", equalTo("Login successful"));
    }

    @Test
    void loginFailsWithWrongPassword() {
        String requestBody = """
            {
                "email": "admin@healthcare.com",
                "password": "WrongPassword"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401);
    }
}