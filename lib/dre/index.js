var dedup_fhir = require('dre-data');
var fhirServerHost = process.env.HAPI_PORT_8080_TCP_ADDR || 'localhost';
var fhirServerUrl = 'http://' + fhirServerHost + ':8080/fhir/baseDstu2/';
var dedupFhirClient = dedup_fhir.getClient(fhirServerUrl);
var bodyParser = require('body-parser');

var express = require('express');
var app = module.exports = express();
app.use(bodyParser.json());

app.get('/api/v1/merge/:patient', function (req, res) {
    //req.params.patient
    deduplicate(req.params.patient, function (errs, matchSet) {
        res.status(200).send(matchSet);
    });

});

app.get('/api/v1/clean/:patient', function (req, res) {
    //req.params.patient
    dedupFhirClient.removeMatches(req.params.patient, function (errs, matchSet) {
        res.status(200).send(matchSet);
    });

});

app.post('/api/v1/replace/:duplicate', function (req, res) {
    //req.params.patient
    var recId = req.params.duplicate;
    var updatedRecord = req.body;
    //	primaryRecord, duplicateId, callback
    dedupFhirClient.merge(updatedRecord, recId, function (errs, matchSet) {
        //do we want to do this or just return 200 immediately and let it go on in the background?
        res.status(200).send(matchSet);
    });
});

app.get('/api/v1/replace/:type/:primary/:duplicate', function (req, res) {
    //req.params.patient
    replace(req.params.type, req.params.primary, req.params.duplicate, function (errs, matchSet) {
        res.status(200).send(matchSet);
    });

});

//Main function, performs match and dedupes.
function replace(type, primary, duplicate, callback) {
    dedupFhirClient.replace(type, primary, duplicate, callback);
}

/**
 * takes an id for a patient and compares that patient's records against the unsubmitted fhir object, 
 * this can be a bundle of objects, a transaction,  or a single fhir object.
 * This returns an array with matches, updates, and new records (i.e. no match found)
 * 
 */
function reconcile(recordID, newObject, callback) {
    //callback returns (err, success)
    dedupFhirClient.reconcilePatient(newObject, recordID, callback);
}

/**
 * Takes a patient ID and returns an array of the objects grouped by either match, update, 
 * or new (i.e. no match found)
 * @param recordID
 * @param callback
 */
function deduplicate(recordID, callback) {
    //callback returns (errs, success)
    dedupFhirClient.deduplicate(recordID, callback);
}

module.exports.reconcile = reconcile;
module.exports.deduplicate = deduplicate;
