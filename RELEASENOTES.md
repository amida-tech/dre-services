# DRE Release Notes

# v2.0 - December 1, 2015

This is new major release of the DRE.
It includes:

- Parsers for Blue Button formats (including CCDA, C32(VA), CDA and CMS(ASCII) )
- Conversion to common data model in FHIR DSTU2 format
- Use of FHIR DSTU2 API for storing patient health record 
- Open Source HAPI Server is used as FHIR reference implementation
- Automatic deduplication of the personal health data
- User driven reconciliation of the personal health data
- Support for provenance of the data
- Medication API integrations:
    - [RxNorm](http://www.nlm.nih.gov/research/umls/rxnorm/])
    - [OpenFDA adverse events](https://open.fda.gov/drug/event/)
    - [MedlinePlus](http://www.nlm.nih.gov/medlineplus/)
    - [BloomAPI](https://www.bloomapi.com/) (NPI information)
    - [C3PI RxImageAccess](http://rximage.nlm.nih.gov/docs/doku.php) (Medication images)
- Support for user registration, authentication and profile management