package spotcheck.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import spotcheck.service.RateLimitingService;
import spotcheck.service.RateLimitingService.Limit;

import static org.assertj.core.api.Assertions.assertThat;

/** "This spot already exists" (409) must not use up the create limit, or "create anyway" gets a 429. */
class RateLimitRefundTest {

    private final RateLimitInterceptor interceptor =
            new RateLimitInterceptor(new RateLimitingService(), new ClientIpResolver(""), true, false, "demo");

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletRequest createSpot() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("ana", null, AuthorityUtils.NO_AUTHORITIES));
        return new MockHttpServletRequest("POST", "/api/spots");
    }

    /** One create request that ends with this status; returns whether the limiter let it in. */
    private boolean attempt(int finalStatus) throws Exception {
        MockHttpServletRequest request = createSpot();
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean allowed = interceptor.preHandle(request, response, new Object());
        if (allowed) {
            response.setStatus(finalStatus);
            interceptor.afterCompletion(request, response, new Object(), null);
        }
        return allowed;
    }

    @Test
    void aDuplicateAnswerGivesTheTokenBack() throws Exception {
        // SPOT_CREATE allows 2 per 5 minutes: many 409s never use it up, and the retry still fits
        for (int i = 0; i < 5; i++) assertThat(attempt(409)).as("409 #" + i).isTrue();
        assertThat(attempt(200)).as("create anyway").isTrue();
        assertThat(attempt(200)).as("second create").isTrue();
        assertThat(attempt(200)).as("third create is over the limit").isFalse();
        assertThat(Limit.SPOT_CREATE.name()).isEqualTo("SPOT_CREATE");
    }

    @Test
    void otherStatusesStillCount() throws Exception {
        assertThat(attempt(400)).isTrue();
        assertThat(attempt(400)).isTrue();
        assertThat(attempt(400)).isFalse();
    }
}
