var express = require('express');
var app = module.exports = express();
var login = require('../login');

var request = require('request');
var _ = require('lodash');
var debug = require('debug')('fhir');
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
    debug('date %j',date);
    console.log(date);
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
    debug('updatePatient %j', account);


    var opts = {
        method: 'GET',
            uri: fhirServerUrl + 'base/Patient/' + account.username
    };
    
    request(opts, function (err, resp, body) {
        if( err ) {
            cb(err);
        } else  {
            updatePatient(body, cb)
        }
    });


    var updatePatient = function( patient, cb) {
         debug('(updatePatient) %j', patient);
         console.log('(updatePatient)',  JSON.stringify(account));
         
        if( !patient || patient.resourceType !== 'Patient') {
            patient = {
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
        } else {
            if(!patient.name) {
                patient.name = [];
            }
            patient.name[0].family = [account.lastName];
            patient.name[0].given = [account.firstName];
            patient.birthDate = fixDate(account.dob);
            patient.gender = account.gender;
            patient.telecom = [{
                    'system': 'email',
                    'value': account.email
                }]
        }
        
        var opts = {
            method: 'PUT',
            uri: fhirServerUrl + 'base/Patient/' + account.username,
            json: true,
            body: patient
        };
    
        request(opts, function (err, resp, body) {
            if (!err && body) {
                if (body.issue) {
                    err = body;
                    console.log(body);
                }
            }
            if (cb) {
                cb(err, resp, body);
            }
        });        
    }
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
        if (!err && !body) {

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

            debug('Request DocumentReference creation');
            request(opts, function (err, resp, body) {
                debug('DocumentReference created');
                
                if (!err && body) {
                        err = body;
                        console.log(body);
                }
                if (cb) {
                    return cb(err, resp.headers.location);
                }
            });

        } else {
            if (cb) {
                if(body) {
                    err = body;
                }
                return cb(err, body);
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
        debug('Request Bundle save');
        
        request(opts, function (err, resp, body) {
            debug('Bundle saved');
            //console.log(JSON.stringify (body,null,' '));
            //console.log(resp.statusCode);
            if (!err && body) {
                if (body.issue) {
                    err = body;
                    //console.log(body);
                }
            }
            if (cb) {
                return cb(err, _.map( 
                    _.filter( body.entry, function(entry) { return entry.hasOwnProperty('transactionResponse')}),
                      function(entry) { return entry.transactionResponse.location } ) );
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

var createProvenanceRecord = function(patientId, docRefLocation, links, cb) {
    
    var provenance =
    {
                'resourceType': 'Provenance',
                //'id': 'Provenance/1',
                'agent' : [ {
			"role" : {
				"system" : "http://hl7.org/fhir/provenance-participant-role",
				"code" : "source"
			},
			"type" : {
				"system" : "http://hl7.org/fhir/provenance-participant-type",
				"code" : "software"
			},
			"referenceUri" : "http://amida-tech.com/fhir/dre",
			"display" : "Data Reconciliation Engine"

		} ],
        'reason' : { 'text':"upload to DRE"}
    };

    if(_.startsWith(docRefLocation, fhirServerUrl + 'base/')) {
        docRefLocation = docRefLocation.substring( (fhirServerUrl + 'base/').length );
    }
    
    provenance.target = _.map( links, function(link) { return {'reference': link}});
        provenance.entity = [{'role':'source','type':{'code': 'DocumentReference', 'system': 'http://hl7.org/fhir/resource-types'},'reference':docRefLocation}]

    var post2fhir = function (data) {
        var opts = {
            method: 'POST',
            uri: fhirServerUrl + 'base' + '/Provenance',
            json: true,
            body: data
        };


        //console.log(JSON.stringify (data,null,' '));
        //console.log(JSON.stringify(makeTransactionalBundle(data, fhirServerUrl, patientId),null,' '));

        debug('Request Provenance save');
        request(opts, function (err, resp, body) {
            debug('Provenance saved');
            //console.log(JSON.stringify (body,null,' '));
            //console.log(resp.statusCode);
            if (!err && body) {
                if (body.issue) {
                    err = body;
                    console.log(body);
                }
            }
            if (cb) {
                return cb(err, resp.headers.location);
            }
        });
    };
    
    post2fhir(provenance);
};

module.exports = {
    updatePatient: updatePatient,
    createDocumentReference: createDocumentReference,
    makeTransactionalBundle: makeTransactionalBundle,
    parseAndSave: parseAndSave,
    createProvenanceRecord: createProvenanceRecord
};
