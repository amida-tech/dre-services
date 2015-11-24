#! /bin/bash

curl -sv http://127.0.0.1:3001/api/v1/account

curl -v --data "username=test2&password=test" http://127.0.0.1:3001/api/v1/register

curl -v -c cookies.txt --data "username=test2&password=test" http://127.0.0.1:3001/api/v1/login

curl -sv -b cookies.txt http://127.0.0.1:3001/api/v1/account

#curl -v -b cookies.txt -X PUT -F 'file=@../cms-fhir/test/fixtures/sample.txt' http://127.0.0.1:3000/api/v1/storage

#curl -v -b cookies.txt -X PUT -F 'file=@/home/alex/projects/amida-tech/DRE/test/artifacts/demo-r1.5/bluebutton-01-original.xml' http://127.0.0.1:3000/api/v1/storage

#curl -v -b cookies.txt -X PUT -F 'file=@/home/alex/projects/amida-tech/DRE/test/artifacts/demo-r1.5/bluebutton-02-updated.xml' http://127.0.0.1:3000/api/v1/storage

#curl -v -b cookies.txt -X PUT -F 'file=@/home/alex/projects/amida-tech/DRE/test/artifacts/demo-r1.5/bluebutton-03-cms.txt' http://127.0.0.1:3000/api/v1/storage

curl -v -b cookies.txt -X PUT -F 'file=@/home/alex/projects/amida-tech/DRE/test/artifacts/demo-r1.5/bluebutton-04-partial.xml' http://127.0.0.1:3001/api/v1/storage

#curl -v -b cookies.txt -X PUT -F 'file=@/home/alex/projects/amida-tech/private-records/HCSC/CCD_20131121_ACMA10102495SLTXMWPGMandGoals.xml' http://127.0.0.1:3000/api/v1/storage

#curl -v -b cookies.txt -H "Content-Type: application/json" -X POST -d '{"email":[{"type":"primary","email":"test@test.com"}],"gender":"Male","dob":{"point":{"date":"2000-11-11","precision":"day"}},"name":{"middle":["B"],"first":"A","last":"C"},"addresses":[{"city":"none","state":"MD","zip":"20000","use":"primary home","street_lines":["line1"]},{}],"phone":[{"number":"1222222222","type":"primary home"},{}],"marital_status":"Never Married"}' http://127.0.0.1:3000/api/v1/updateprofile

#curl -v -b cookies.txt -H "Content-Type: application/json" -X POST -d '{"entry":"16797","note":"test 3 note","section":"Encounter","star":true}' http://127.0.0.1:3000/api/v1/notes/add

