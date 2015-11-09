Data Reconciliation Engine (DRE) Services - Merge Components
=========

### Replace resource by ID

#GET: /api/v1/replace/:type/:primary/:duplicate

Replace all references to "duplicate" with references to "primary" and delete "duplicate."

- type:  The resource type of the objects.  e.g. "Patient","Immunization","Organization",etc..
- primary: The ID of the FHIR resource being kept.
- duplicate:  The ID of the FHIR resource to be removed.

/api/v1/replace/Immunization/123/299

will replace all references to Immunization/239 with Immunization/123 and deletes Immunization/239

#POST: /api/v1/replace/:duplicate

update the record being posted and delete "duplicate."

- post body:  Must be a valid FHIR resource such as Patient, Immunization, etc...  this body will be used to update the existing FHIR resource with the same ID from the body.
- duplicate:  The ID of the FHIR resource to be removed.

a post to:
/api/v1/replace/3990

with a body of:

```json
{
      "resourceType": "Immunization",
      "id": "3779",
** omitted for brevity **
      "doseQuantity": {
        "value": 50,
        "system": "http://unitofmeasure.org",
        "code": "mcg"
      }
    }
```

will update the resource Immunization/3779 with the contents of the post and delete resource Immunization/3990


# GET: /api/v1/merge/:patient

Generate an evaluation of the entire patient record looking for matches and possible updates.

/api/v1/merge/123

will generate a match set for Patient/123

- **Update** - synonymous with partial match = means the lhs and rhs are not identical but close enough to be considered a match and thus present for human review.  Update will always include a lhs and rhs object constituting the 2 varying components.
- **New** - is a record for which no other record was found within the scoring limit.  i.e. there were no other records close enough in content to be considered a update. New will always include a lhs object but that is it.
- **Match** - is a record for which exact matches sans ignored fields were found.  The ignored fields can vary by type but right now the id, text node, and meta node are all ignored for matching purposes. Match will include a lhs object and a matches array that are all objects found to be a match.



# deduplication

Deduplication should atumatically occur when a patient record is submitted to **PUT: /api/v1/storage**  if interested in where: lib/fhir/index.js 

```javascript
//We don't actually care about the callback for consolidation.
dre_data_FhirClient.removeMatches(patientId, function(err, resourceSet){ });
```
