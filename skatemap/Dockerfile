# Etapa 1: Construcción (Build)
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copiamos el archivo de configuración de dependencias
COPY pom.xml .

# Copiamos todo el código fuente de nuestra aplicación
COPY src ./src
# Usamos -Dmaven.test.skip=true en lugar de -DskipTests.
# Esto obliga a Maven a ignorar totalmente la carpeta src/test.
RUN mvn clean package -Dmaven.test.skip=true

# Etapa 2: Ejecución (Run)
# Usamos el JRE (solo ejecución) para que el servidor pese menos y sea más rápido
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copiamos ÚNICAMENTE el archivo .jar ya compilado desde la Etapa 1 (build)
COPY --from=build /app/target/skatemap-0.0.1-SNAPSHOT.jar app.jar

# Indicamos que la aplicación escuchará en el puerto 8080
EXPOSE 8080

# Comando final que ejecutará Render al encender la máquina virtual
ENTRYPOINT ["java", "-jar", "app.jar"]