FROM eclipse-temurin:21-jdk-alpine

COPY ./build/libs/app.jar ./app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
