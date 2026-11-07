package skatemap.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import skatemap.security.RateLimitInterceptor;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;

    public WebConfig(RateLimitInterceptor rateLimitInterceptor) {
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // RateLimitInterceptor decides per path which limit applies
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/auth/**", "/api/spots/**", "/api/spots", "/api/comments/**", "/api/cloudinary/**");
    }

    /**
     * ETag on the public read endpoints: when the data hasn't changed, clients that send
     * If-None-Match get an empty 304 instead of the whole spot list again.
     */
    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
        ShallowEtagHeaderFilter filter = new ShallowEtagHeaderFilter();
        // Weak ETag (W/"..."): Tomcat refuses to gzip responses carrying a strong one
        filter.setWriteWeakETag(true);
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration = new FilterRegistrationBean<>(filter);
        registration.addUrlPatterns("/api/spots", "/api/spots/*", "/api/comments/spot/*");
        registration.setName("etagFilter");
        return registration;
    }
}
