# Build stage. Base images are multi-arch, so this also builds on ARM (Oracle Ampere A1).
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Dependencies first: this layer stays cached until pom.xml changes
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Tests run in CI / locally; skip compiling them here
RUN mvn -B -q package -Dmaven.test.skip=true

# Runtime stage: JRE only, non-root user
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 --no-create-home skatemap
COPY --from=build /app/target/skatemap-0.0.1-SNAPSHOT.jar app.jar
USER skatemap

EXPOSE 8080
# Heap sized from the container memory limit
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "app.jar"]
