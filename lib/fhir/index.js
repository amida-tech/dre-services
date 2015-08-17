var express = require('express');
var app = module.exports = express();
var login = require('../login');

var request = require('request');
var _ = require('lodash');

var fhirServerUrl = require('./config').fhirServerUrl;

if (!_.endsWith(fhirServerUrl, '/')) {
    fhirServerUrl += '/';
}

/*app.get('/fhir/*', login.checkAuth, function (req, res) {

});*/

var fixDate = function (date) {
    if (date) {
        date = date.trim();
        switch (date.length) {
        case 10: //10/10/1980
            var s = date.split('/');
            if (s.length === 3) {
                return s[2] + '-' + s[1] + '-' + s[0];
            }
        }
    }
    return date;
};

var updatePatient = function (account, cb) {
    var patient = {
        'resourceType': 'Patient',
        'identifier': [{
            'use': 'usual',
            'value': account.username
        }],
        'name': [{
            'use': 'usual',
            'family': [account.lastName],
            'given': [account.firstName]
        }],
        'birthDate': fixDate(account.dob),
        'gender': account.gender,
        'telecom': [{
            'system': 'email',
            'value': account.email
        }]
    };

    var opts = {
        method: 'PUT',
        uri: fhirServerUrl + 'Patient/' + account.username,
        json: true,
        body: patient
    };

    request(opts, function (err, resp, body) {
        if (cb) {
            cb(err, resp, body);
        }
    });
};

var createDocumentReference = function (patientId, filename, contentType, stringBlob, cb) {
    var binary = {
        'resourceType': 'Binary',
        'contentType': contentType,
        'content': (new Buffer(stringBlob)).toString('base64')
    };

    var opts = {
        method: 'POST',
        uri: fhirServerUrl + 'Binary',
        json: true,
        body: binary
    };

    request(opts, function (err, resp, body) {

        if (!err) {

            var documentReference = {
                'resourceType': 'DocumentReference',
                'subject': {
                    'reference': 'Patient/' + patientId
                },
                'type': {
                    'coding': [{
                        'system': 'http://loinc.org',
                        'code': '34108-1', //TODO fix to more generic type
                        'display': 'Outpatient Note'
                    }]
                },
                'author': [{
                    'reference': 'Patient/' + patientId
                }],
                'indexed': (new Date().toISOString().replace(/\..+/, '')),
                'status': 'current',
                'content': [{
                    'title': filename,
                    'contentType': contentType,
                    'url': resp.headers.location,
                }]
            };

            var opts = {
                method: 'POST',
                uri: fhirServerUrl + 'DocumentReference',
                json: true,
                body: documentReference
            };

            request(opts, function (err, resp, body) {
                if (cb) {
                    return cb(err, resp, body);
                }
            });

        }
        if (cb) {
            return cb(err, resp, body);
        }
    });

    //console.log(JSON.stringify(documentReference, null, ' '));

};

module.exports = {
    updatePatient: updatePatient,
    createDocumentReference: createDocumentReference
};
