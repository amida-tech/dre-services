"use strict";

var _ = require('lodash');
var express = require('express');
var request = require('request');
var fhir2ccda = require('fhir2ccda');
var login = require('../login');
var db = require('../db');

var app = module.exports = express();
var fhirServerUrl = process.env.FHIR_URL || 'http://localhost:8080/fhir/baseDstu2/';

var getAllPages = function _searchAll(options, currentCount, maxCount, callback) {
    request.get(options, function (err, response, bundle) {
        if (err) {
            callback(err);
        } else if (response.statusCode > 399) {
            callback(new Error('Invalid status: ' + response.statusCode), bundle);
        } else {
            var next = _.find(bundle.link, function (link) {
                return link.relation === 'next';
            });
            currentCount += bundle.entry.length;
            if (next && ((!maxCount) || (currentCount < maxCount))) {
                var nextOptions = _.cloneDeep(options);
                nextOptions.uri = next.url;
                getAllPages(nextOptions, currentCount, maxCount, function (err, remaining) {
                    if (err) {
                        callback(err);
                    } else {
                        bundle.entry = bundle.entry.concat(remaining.entry);
                        bundle.total = bundle.entry.length;
                        callback(null, bundle);
                    }
                });
            } else {
                callback(null, bundle);
            }
        }
    });
};

var addNotesToBundle = function (username, bundle, callback) {
    db.getAllNotes(username, function (err, result) {
        if (err) {
            callback(err);
        } else {
            if (result && result.length) {
                var notes = result.reduce(function (r, e) {
                    var id = e.section + '/' + e.entry;
                    r[id] = e;
                    return r;
                }, {});
                bundle.entry.forEach(function (entry) {
                    var resource = entry.resource;
                    var id = resource.id;
                    if (id.indexOf('/') < 0) {
                        id = resource.resourceType + '/' + id;
                    }
                    if (notes[id]) {
                        if (!resource.extension) {
                            resource.extension = [];
                        }
                        var extension = {
                            url: 'http://amida-tech.com/fhir/patient-note',
                            extension: [{
                                url: 'note',
                                valueString: notes[id].note
                            }, {
                                url: 'star',
                                valueBoolean: notes[id].star
                            }, {
                                url: 'dateTime',
                                valueDateTime: notes[id].datetime
                            }]
                        };
                        resource.extension.push(extension);
                    }
                });
            }
            callback(null);
        }
    });
};

var sendMhr = function (bundle, format, username, patientNotes, res) {
    var extension = format;
    if (!format) {
        format = 'ccda';
        extension = 'xml';
    }
    var timestamp = new Date().toISOString();
    timestamp = timestamp.replace(/-/g, '').substring(0, 8);
    var fileName = 'ccda_record';
    if (patientNotes) {
        fileName += '_notes';
    }
    fileName += '-with_patient-' + username + '-' + timestamp + '.' + extension;
    res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
    if (format === "json") {
        res.status(200).send(JSON.stringify(bundle, null, 4));
    } else {
        var ccd = fhir2ccda.generateCCD(bundle);
        res.status(200).send(ccd);
    }
};

var mhrMain = function (req, patientNotes, res) {
    var format = req.params.format;

    var username = req.user.username;
    if (!username) {
        res.status(400).send('Patient id is not found');
        return;
    }

    var opts = {
        method: 'GET',
        uri: fhirServerUrl + 'Patient/' + username + '/$everything',
        json: true
    };

    getAllPages(opts, 0, undefined, function (err, bundle) {
        if (err) {
            res.status(400).send(err.message);
        } else {
            if (patientNotes) {
                addNotesToBundle(username, bundle, function (err) {
                    if (err) {
                        res.status(400).send(err.message);
                    } else {
                        sendMhr(bundle, format, username, patientNotes, res);
                    }
                });
            } else {
                sendMhr(bundle, format, username, patientNotes, res);
            }
        }
    });
};

app.get('/api/v1/mhr/:format?', login.checkAuth, function (req, res) {
    mhrMain(req, false, res);
});

app.get('/api/v1/mhrwithnotes/:format?', login.checkAuth, function (req, res) {
    mhrMain(req, true, res);
});
