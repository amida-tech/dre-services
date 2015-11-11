##HAPI-FHIR Server

[HAPI-FHIR server](http://jamesagnew.github.io/hapi-fhir/) bundled with [Jetty](http://www.eclipse.org/jetty/) and configured with in-memory database for end-to-end tests.

You can start it manually `java -jar fhirTest-0.0.2-SNAPSHOT.jar hapi-fhir-test-memory.war > server.log 2>&1 &` and stop it `pkill -f "java -jar fhirTest-0.0.2-SNAPSHOT.jar hapi-fhir-test-memory.war"`
 
FHIR Server will respond on http://localhost:8080/fhir-test

Don't forget to set environment variable `FHIR_URL=http://localhost:8080/fhir-test/baseDstu2` for using it from srvices 