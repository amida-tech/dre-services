
var dedup_fhir = require('dre-data');

var fhirServerUrl = process.env.FHIR_URL || 'http://localhost:8080/fhir';
var dedupFhirClient = dedup_fhir.getClient(fhirServerUrl);

//Main function, performs match and dedupes.
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
function deduplicate(recordID, callback){
	//callback returns (errs, success)
	dedupFhirClient.deduplicate(recordID, callback);	
}

module.exports.reconcile = reconcile;
module.exports.deduplicate = deduplicate;

