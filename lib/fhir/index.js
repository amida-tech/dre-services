var express = require('express');
var app = module.exports = express();
var login = require('../login');

var request = require('request');
var _ = require('lodash');
var split = require('split');
var stream = require('stream');
var cms_parser = require('cms-fhir');
var cda_parser = require('cda-fhir');

var fhirServerUrl = process.env.FHIR_URL || 'http://localhost:8080/fhir';

if (!_.endsWith(fhirServerUrl, '/')) {
    fhirServerUrl += '/';
}

console.log("FHIR URL: ", fhirServerUrl);

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
        uri: fhirServerUrl + 'base/Patient/' + account.username,
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
        uri: fhirServerUrl + 'base/Binary',
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
                uri: fhirServerUrl + 'base/DocumentReference',
                json: true,
                body: documentReference
            };

            request(opts, function (err, resp, body) {
                if (cb) {
                    return cb(err, resp, body);
                }
            });

        } else {
            if (cb) {
                return cb(err, resp, body);
            }
        }
    });

    //console.log(JSON.stringify(documentReference, null, ' '));

};

var makeTransactionalBundle = function (bundle, base, patientId) {
    _.each(bundle.entry, function (value) {
        value.transaction = {
            'method': (value.resource.resourceType === 'Patient') ? 'PUT' : 'POST',
            'url': (value.resource.resourceType === 'Patient') ? 'Patient/' + patientId : value.resource.resourceType
        };
        value.base = base;
    });
    bundle.type = 'transaction';
    return bundle;
};

var parseAndSave = function (patientId, filename, contentType, stringBlob, cb) {

    var streamify = function (text) {
        var s = new stream.Readable();
        s._read = function noop() {};
        s.push(text);
        s.push(null);
        return s;
    };

    var post2fhir = function (data) {
        var opts = {
            method: 'POST',
            uri: fhirServerUrl + 'base',
            json: true,
            body: makeTransactionalBundle(data, fhirServerUrl, patientId)
        };

        //console.log(JSON.stringify(makeTransactionalBundle(data, fhirServerUrl, patientId),null,' '));

        request(opts, function (err, resp, body) {
            if (!err && body) {
                if (body.issue) {
                    err = body;
                    console.log(body);
                }
            }
            if (cb) {
                return cb(err, resp, body);
            }
        });
    };

    var onError = function (error) {
        if (cb) {
            cb(error);
        }
    };

    if ((contentType === 'application/xml' || _.endsWith(filename, '.xml'))) {
        streamify(stringBlob).pipe(new cda_parser.CcdaParserStream(patientId)).on('data', post2fhir).on('error', onError);
    } else {
        streamify(stringBlob).pipe(split()).pipe(new cms_parser.CmsFile2Object()).pipe(new cms_parser.IntObjToFhirStream(patientId)).on('data', post2fhir).on('error', onError);
    }
};

module.exports = {
    updatePatient: updatePatient,
    createDocumentReference: createDocumentReference,
    makeTransactionalBundle: makeTransactionalBundle,
    parseAndSave: parseAndSave
};
