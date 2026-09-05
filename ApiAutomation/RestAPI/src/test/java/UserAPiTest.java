import org.junit.jupiter.api.Test;

import io.restassured.RestAssured;
import io.restassured.response.Response;
import static org.junit.jupiter.api.Assertions.*;

public class UserAPiTest {
    @Test
    void getUserById_shouldReturn200AndCorrectData() {
        Response response = RestAssured.get("https://reqres.in/api/users/2");
        int statusCode = response.getStatusCode();
        assertEquals(200, statusCode);
        int id = response.jsonPath().getInt("data.id");
        assertEquals(2,id);
        String email = response.jsonPath().getString("data.email");
        assertNotNull(email);
        assertFalse(email.isEmpty());
    }
}
