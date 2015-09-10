#! /bin/bash

curl -v -c cookies.txt -d "username=test&password=test" http://localhost:3000/api/v1/register

curl -v -c cookies.txt -d "username=test&password=test" http://localhost:3000/api/v1/login

#curl -v -b cookies.txt -X PUT -F 'file=@../cms-fhir/test/fixtures/sample.txt' http://localhost:3000/api/v1/storage

#curl -v -b cookies.txt -X PUT -F 'file=@../cda-fhir/test/artifacts/bluebutton-01-original.xml' http://localhost:3000/api/v1/storage

curl -v -b cookies.txt -X POST -d "email=test@test.com" http://localhost:3000/api/v1/updateprofile

