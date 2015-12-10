var express = require('express');
var app = module.exports = express();
var login = require('../login');

var request = require('request');
var _ = require('lodash');
var debug = require('debug')('fhir');
var split = require('split');
var stream = require('stream');
var async = require('async');
var cms_parser = require('cms-fhir');
var cda_parser = require('cda-fhir');
var ccd_parser = require('ccd-fhir');
var c32_parser = require('c32-fhir');

var fhirServerHost = process.env.HAPI_PORT_8080_TCP_ADDR || process.env.FHIR_ADDR || 'localhost';
var fhirProtocol = process.env.FHIR_PROTO || 'http';
var fhirPort = process.env.FHIR_PORT || '8080';
var fhirPath = process.env.FHIR_PATH || '/fhir/baseDstu2/';
//make sure the path begins and ends with /
if (!_.startsWith(fhirPath, '/')) {
    fhirPath = '/' + fhirPath;
}
if (!_.endsWith(fhirPath, '/')) {
    fhirPath = fhirPath + '/';
}

//boolean as to whether the port is the standard one for the protocol
var usesStandardPort = (_.isEqual('http', fhirProtocol) && _.isEqual('80', fhirPort)) ||
    (_.isEqual('https', fhirProtocol) && _.isEqual('443', fhirPort));

var fhirServerUrl = fhirProtocol + '://' + fhirServerHost + (usesStandardPort ? '' : ':' + fhirPort) + fhirPath;

var dre_data_fhir = require('dre-data');
var dre_data_FhirClient = dre_data_fhir.getClient(fhirServerUrl);

//set the environment variable to the current value of fhirServerUrl.  
//this allows for easy propogation to modules.
process.env.FHIR_URL = fhirServerUrl;

if (!_.endsWith(fhirServerUrl, '/')) {
    fhirServerUrl += '/';
}

console.log("FHIR URL: ", fhirServerUrl);

var fixDate = function (date) {
    debug('fixDate(%s)', date);
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

var updateProfile = function (username, profile, cb) {
    debug('updatePatient %j', profile);

    var opts = {
        method: 'GET',
        uri: fhirServerUrl + 'Patient/' + username
    };

    request(opts, function (err, resp, body) {
        if (err) {
            cb(err);
        } else {
            updatePatient(body, cb);
        }
    });

    var updatePatient = function (patient, cb) {
        if (_.isString(patient)) {
            patient = JSON.parse(patient);
        }

        if (patient && patient.resourceType === 'Patient') {
            if (profile.name) {
                if (!patient.name) {
                    patient.name = [];
                }
                patient.name[0].family = [profile.name.last];
                patient.name[0].given = [profile.name.first].concat(profile.name.middle);
            }
            if (profile.dob && profile.dob.point && profile.dob.point.date) {
                patient.birthDate = fixDate(profile.dob.point.date);
            }
            if (profile.gender) {
                patient.gender = profile.gender;
            }
            var telecom;
            if (profile.email && _.isArray(profile.email)) {
                telecom = _.map(profile.email, function (v) {
                    return {
                        'system': 'email',
                        'value': v.email,
                        'usage': v.type
                    };
                });
            }
            if (profile.phone && _.isArray(profile.phone)) {
                telecom = _.map(profile.phone, function (v) {
                    return {
                        'system': 'phone',
                        'value': v.number,
                        'usage': v.type
                    };
                }).concat(telecom);
            }

            if (telecom) {
                patient.telecom = telecom;
            }

            if (profile.addresses && _.isArray(profile.addresses)) {
                patient.address = _.map(profile.addresses, function (v) {
                    return {
                        city: v.city,
                        state: v.state,
                        postalCode: v.zip,
                        use: v.use,
                        line: v.street_lines
                    };
                });
            }

            if (profile.marital_status) {
                patient.maritalStatus = {
                    text: profile.marital_status
                };
            }

            var opts = {
                method: 'PUT',
                uri: fhirServerUrl + 'Patient/' + username,
                json: true,
                body: patient
            };

            request(opts, function (err, resp, body) {
                if (!err && body) {
                    if (body.issue && _.any(body.issue, function (value) {
                            return value.severity === 'error';
                        })) {
                        err = new Error(body);
                        debug(err);
                    }
                }
                if (cb) {
                    cb(err, resp, body);
                }
            });

        } else {
            cb(patient);
        }
    };
};

var createPatient = function (account, cb) {
    debug('createPatient %j', account);

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
        if (!err && body) {
            if (body.issue && _.any(body.issue, function (value) {
                    return value.severity === 'error';
                })) {
                err = new Error(body);
                debug(err);
            }
        }
        if (cb) {
            cb(err, resp, body);
        }
    });
};

var createDocumentReference = function (patientId, filename, contentType, stringBlob, cb) {
    /*var binary = {
        'resourceType': 'Binary',
        'contentType': contentType,
        'content': (new Buffer(stringBlob)).toString('base64')
    };*/
    //var binary = (new Buffer(stringBlob)).toString('base64');
    var opts = {
        method: 'POST',
        uri: fhirServerUrl + 'Binary',
        headers: {
            'Content-Type': contentType,
            'Accept-Charset': 'utf-8'
        }
    };

    request(opts, function (err, resp, body) {
        if (!(body.issue && _.any(body.issue, function (value) {
                return value.severity === 'error';
            }))) {

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
                    'attachment': {
                        'contentType': contentType,
                        'title': filename,
                        'url': resp.headers.location
                    }
                }]
            };

            var opts = {
                method: 'POST',
                uri: fhirServerUrl + 'DocumentReference',
                json: true,
                body: documentReference
            };

            debug('Request DocumentReference creation\n%j', documentReference);
            request(opts, function (err, resp, body) {
                debug('DocumentReference created\n%j', body);

                if (body.issue && _.any(body.issue, function (value) {
                        return value.severity === 'error';
                    })) {
                    err = new Error(body);
                    debug(err);
                }
                if (cb) {
                    return cb(err, resp.headers.location);
                }
            });

        } else {
            if (cb) {
                if (body) {
                    err = body;
                }
                return cb(err, body);
            }
        }
    }).end(stringBlob);

    //console.log(JSON.stringify(documentReference, null, ' '));

};

var makeTransactionalBundle = function (bundle, base, patientId) {
    _.each(bundle.entry, function (value) {
        value.request = {
            'method': (value.resource.resourceType === 'Patient') ? 'PUT' : 'POST',
            'url': (value.resource.resourceType === 'Patient') ? 'Patient/' + patientId : value.resource.resourceType
        };
        value.base = base;
    });
    bundle.type = 'transaction';
    return bundle;
};

var addExtension = function (bundle, base, docRef) {
    var today = getFormattedDate();
    
    if (_.startsWith(docRef, fhirServerUrl)) {
        docRef = docRef.substr(fhirServerUrl.length);
    }
    _.each(bundle.entry, function (value) {
        if (!value.resource.extension) {
            value.resource.extension = [];
        }
        value.resource.extension.push({
            'url': 'http://amida-tech.com/fhir/extensions/source',
            'extension': [{
                    'url': 'http://amida-tech.com/fhir/extensions/source/reference',
                    'valueString': docRef
                }, {
                    'url': 'http://amida-tech.com/fhir/extensions/source/date',
                    'valueDateTime': today
                }, {
                    'url': 'http://amida-tech.com/fhir/extensions/source/description',
                    'valueString': 'Original source'
                }

            ]
        });
    });
    return bundle;
};

var parseAndSave = function (patientId, filename, contentType, stringBlob, docRefLocation, cb) {

    var streamify = function (text) {
        var s = new stream.Readable();
        s._read = function noop() {};
        s.push(text);
        s.push(null);
        return s;
    };

    var post2fhir = function (data, parserName, docRef) {
        if (_.isError(data)) {
            debug('%s - Skip saving bundle because parsers fails to parse document', parserName);
            return; // One of parsers did work, skip the rest
        }
        async.waterfall([
            /** Pull Patient record */
            function (cb) {
                request({
                        method: 'GET',
                        uri: fhirServerUrl + 'Patient/' + patientId
                    },
                    function (err, request, body) {
                        cb(err, request, body);
                    });
            },
            /** Merge new data (if any) into existing Patient record */
            function (request, body, cb) {
                //debug("request %j", request);
                //debug("body %s", body);
                //debug("cb ", cb);
                var idx = _.findIndex(data.entry, function (value) {
                    return value.resource.resourceType === 'Patient';
                });
                if (idx !== -1) {
                    debug("patinet found %j", data.entry[idx].resource);
                    var customizer = function (value, other, key) {
                        return _.isUndefined(value) ? other : (_.isObject(value) ? _.assign(value, other, customizer) : value);
                    };
                    data.entry[idx].resource = _.assign(JSON.parse(body), data.entry[idx].resource, customizer);
                    debug("patinet merged %j", data.entry[idx].resource);
                }
                return cb(null);
            },
            /** Save bundle */
            function (cb) {
                debug('%s - Saving bundle', parserName);
                var body = addExtension(makeTransactionalBundle(data, fhirServerUrl, patientId), fhirServerUrl, docRef);
                debug("%j", body);
                request({
                    method: 'POST',
                    uri: fhirServerUrl,
                    json: true,
                    body: body
                }, function (err, resp, body) {
                    cb(err, resp, body);
                });
            },
            /** Remove matches */
            function (resp, body, cb) {
                if (body) {
                    if (body.issue && _.any(body.issue, function (value) {
                            return value.severity === 'error';
                        })) {
                        var err = new Error(body);
                        //debug(err);
                        return cb(err);
                    }
                }
                debug('Bundle saved');

                cb(null, body);
            }
        ], function (err, body) {

            dre_data_FhirClient.removeMatches(patientId, function (err, resourceSet) {});

            if (cb) {
                debug("%j", body);
                return cb(err, _.map(
                    body.entry,
                    function (entry) {
                        return entry.response.location;
                    }));
            }
        });
    };

    var onError = function (error) {
        if (cb) {
            cb(error);
        }
    };

    var istream;
    if ((contentType === 'application/xml' || _.endsWith(filename, '.xml'))) {
        istream = streamify(stringBlob);
        var cdaStream = new stream.PassThrough();
        var ccdStream = new stream.PassThrough();

        istream.pipe(cdaStream);
        istream.pipe(ccdStream);

        istream.pipe(new c32_parser.C32ParserStream()).on('data', function (data) {
            debug("C32 parser done (error: %j)", _.isError(data));
            if (_.isError(data)) {
                //istream = streamify(stringBlob); // reread stream
                cdaStream.pipe(new cda_parser.CcdaParserStream(patientId)).on('data', function (data) {
                    debug("CCDA parser done (error: %j)", _.isError(data));
                    if (_.isError(data)) {
                        ccdStream.pipe(new ccd_parser.CcdParserStream()).on('data', function (data) {
                            debug("CCD parser done (error: %j)", _.isError(data));
                            if (_.isError(data)) {
                                debug("All three XML parsers fails");
                                onError(new Error("All three XML parsers fails"));
                            } else {
                                post2fhir(data, 'CCD', docRefLocation);
                            }
                        }).on('error', onError);
                    } else {
                        post2fhir(data, 'CCDA', docRefLocation);
                    }
                }).on('error', onError);
            } else {
                post2fhir(data, 'C32', docRefLocation);
            }
        }).on('error', onError);

    } else {
        istream = streamify(stringBlob).pipe(split());
        istream.pipe(new cms_parser.CmsFile2Object()).pipe(new cms_parser.IntObjToFhirStream(patientId)).on('data', function (data) {
            debug("CMS parser done without error: %j", _.isError(data));
            post2fhir(data, 'CMS', docRefLocation);
        }).on('error', onError);
    }
};

var createProvenanceRecord = function (patientId, docRefLocation, links, cb) {

    var provenance = {
        'resourceType': 'Provenance',
        //'id': 'Provenance/1',
        'agent': [{
            "role": {
                "system": "http://hl7.org/fhir/provenance-participant-role",
                "code": "source"
            },
            "type": {
                "system": "http://hl7.org/fhir/provenance-participant-type",
                "code": "software"
            },
            "referenceUri": "http://amida-tech.com/fhir/dre",
            "display": "Data Reconciliation Engine"

        }],
        'reason': {
            'text': "upload to DRE"
        }
    };

    if (_.startsWith(docRefLocation, fhirServerUrl)) {
        docRefLocation = docRefLocation.substring((fhirServerUrl).length);
    }

    provenance.target = _.map(links, function (link) {
        return {
            'reference': link
        };
    });
    provenance.entity = [{
        'role': 'source',
        'type': {
            'code': 'DocumentReference',
            'system': 'http://hl7.org/fhir/resource-types'
        },
        'reference': docRefLocation
    }];

    var post2fhir = function (data) {
        var opts = {
            method: 'POST',
            uri: fhirServerUrl + 'Provenance',
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
                if (body.issue && _.any(body.issue, function (value) {
                        return value.severity === 'error';
                    })) {
                    err = new Error(body);
                    debug(err);
                }
            }
            if (cb) {
                return cb(err, resp.headers.location);
            }
        });
    };

    post2fhir(provenance);
};

/**
 * @function
 * @param {String} id one of htt{X}://.../{Resource}/XXX, {Resource}/XXX
 * @param {Function} cb standard callback(err, data)
 */
var getResource = function (resourceType, resourceId, cb) {

    var opts = {
        method: 'GET',
        uri: fhirServerUrl + resourceType + '/' + resourceId,
        headers: {
            'Accept': 'application/json'
        }
    };

    request(opts, function (err, resp, body) {
        if (err) {
            return cb(err);
        } else if (resp.statusCode > 400) {
            return cb(new Error(body), null, resp.statusCode);
        } else {
            return cb(null, body);
        }
    });
};

var proxy = function (url, cb) {

    debug('Proxy call %s%s', fhirServerUrl, url);

    var opts = {
        method: 'GET',
        uri: fhirServerUrl + url,
        headers: {
            'Accept': 'application/json'
        }
    };

    request(opts, function (err, resp, body) {
        return cb(err, body, resp.statusCode);
    });
};

var getFormattedDate = function(){
    var today = new Date();
    var todayString = today.toISOString();

    var n = todayString.indexOf('.');
    todayString = todayString.substr(0,n);
    todayString = todayString +"+00:00";
    return todayString;

}

module.exports = {
    createPatient: createPatient,
    updateProfile: updateProfile,
    createDocumentReference: createDocumentReference,
    makeTransactionalBundle: makeTransactionalBundle,
    parseAndSave: parseAndSave,
    createProvenanceRecord: createProvenanceRecord,
    getResource: getResource,
    proxy: proxy
};
