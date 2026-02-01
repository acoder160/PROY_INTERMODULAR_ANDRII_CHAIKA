SkateMap - Proyecto Intermodular

Alumno:Andrii Chaika  
Curso:2º DAM

Este repositorio contiene el código fuente de SkateMap, una aplicación Full-Stack para geolocalizar y valorar spots de skate.

---

Requisitos Previos

Para ejecutar este proyecto necesitas tener instalado:
Java JDK 17 (o superior).
Node.js y npm.
PostgreSQL (con la extensión PostGIS).
Maven

---

Instrucciones de Ejecución

Sigue estos 4 pasos en orden para arrancar la aplicación:

1. Configuración de la Base de Datos
Accede a pgAdmin o a tu terminal de PostgreSQL y ejecuta:

```sql
CREATE DATABASE skatemap;
\c skatemap; -- Conectarse a la base de datos
CREATE EXTENSION postgis; -- Habilitar extensión geográfica
Nota: Asegúrate de que las credenciales en skatemap/src/main/resources/application.properties coincidan con tu usuario y contraseña de PostgreSQL local.

2. Arrancar el Backend (Spring Boot)

Ejecuta la clase principal SkatemapApplication.java.

El servidor iniciará en: http://localhost:8080.

3. Arrancar el Frontend (React)
Abre una terminal y ve a la carpeta del frontend:

cd skatemap-web

Instala las dependencias (solo la primera vez):
npm install


Arranca el servidor de desarrollo:
npm run dev

La web estará disponible en: http://localhost:5173.

4. Uso de la Aplicación
Abre tu navegador en http://localhost:5173.

Al ser la primera ejecución, la base de datos estará vacía.

Haz clic en "Entrar" -> "Registrarse" y crea un usuario nuevo (ej: admin / 1234).

¡Ya puedes añadir spots y valorarlos!

Tecnologías
Backend: Java, Spring Boot 3, Spring Security (JWT), Hibernate, PostgreSQL + PostGIS.

Frontend: React, Vite, Leaflet (Mapas), Axios.