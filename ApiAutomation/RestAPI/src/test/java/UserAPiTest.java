//package com.healthcare;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

class UserApiTest {

    private static String accessToken;

    @BeforeAll
    static void login() {
        RestAssured.baseURI = "http://localhost:3000";

        accessToken =
                given()
                        .contentType("application/json")
                        .body("""
                    {
                      "email": "admin@healthcare.com",
                      "password": "Admin@123"
                    }
                    """)
                        .when()
                        .post("/api/auth/login")
                        .then()
                        .statusCode(200)
                        .body("message", equalTo("Login successful"))
                        .body("accessToken", not(emptyString()))
                        .extract()
                        .path("accessToken");
    }

    @Test
    void shouldReturnHealthyGateway() {
        given()
                .when()
                .get("/health")
                .then()
                .statusCode(200)
                .body("status", equalTo("healthy"))
                .body("gateway", equalTo("running"));
    }

    @Test
    void shouldReturnAuthenticatedUserProfile() {
        given()
                .header("Authorization", "Bearer " + accessToken)
                .when()
                .get("/api/auth/profile")
                .then()
                .statusCode(200)
                .body("user.email", equalTo("admin@healthcare.com"))
                .body("user.role", equalTo("admin"));
    }
}