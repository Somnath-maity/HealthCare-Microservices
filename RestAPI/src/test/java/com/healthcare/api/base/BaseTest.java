package com.healthcare.api.base;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;

public class BaseTest {
    @BeforeAll
    static void setup() {
        RestAssured.baseURI = "http://localhost:3000";
    }
}
