FROM eclipse-temurin:17-jdk-focal

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY build/libs/*.jar app.jar 
ENTRYPOINT ["java", "-jar", "app.jar"]l