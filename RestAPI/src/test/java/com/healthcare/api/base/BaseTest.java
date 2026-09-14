package com.healthcare.api.base;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;

public class BaseTest {
    @BeforeAll
    static void setup() {
        RestAssured.baseURI = "https://api.healthcare.gov.uk";
    }
}
