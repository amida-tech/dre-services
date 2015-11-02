"use strict";

var _ = require('lodash');
var express = require('express');
var request = require('request');
var fhir2ccda = require('fhir2ccda');
var login = require('../login');

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


app.get('/api/v1/mhr/:format?', login.checkAuth, function (req, res) {
    var format = req.params.format;
    var extension = format;
    if (!format) {
        format = 'ccda';
        extension = 'xml';
    }

    var username = req.user.username;
    if (! username) {
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
            var timestamp = new Date().toISOString();
            timestamp = timestamp.replace(/-/g, '').substring(0, 8);
            var fileName = 'ccda_record-with_patient-' + username + '-' + timestamp + '.' + extension;
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
            if (format === "json") {
                res.status(200).send(JSON.stringify(bundle, null, 4));
            } else {
                var ccd = fhir2ccda.generateCCD(bundle);
                res.status(200).send(ccd);
            }
        }
    });
});
