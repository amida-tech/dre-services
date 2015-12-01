Data Reconciliation Engine (DRE) Services
=========

DRE is a MEAN based server side component for reconciling health data.

High Level Overview
===================
![DRE High Level Diagram](docs/images/dre_overview_new.png)

The purpose of the Data Reconciliation Engine is to take personal health data in a variety of formats (starting with BlueButton/CCDA) from multiple sources and parse/normalize/de-duplicate/merge it into a single Patient's Master Health Record with patient assistance (although most of hard work will be done automagically).


DRE's components
=================
![DRE Components Diagram](docs/images/dre_four_components.png)

DRE has 4 primary elements

#### 1 - Parsing and Normalization Library.

This parses incoming data into a homogenous, simplified and normalized data model in JSON format.

Parsing library code: [amida-tech/blue-button](https://github.com/amida-tech/blue-button)


#### 2 - Matching Library.

This takes the standardized data elements and flags probable duplicate values. New patient records are compared against the existing Master Health Record and automatically matched. The result produces a list of all entries in the new record, labelled as duplicates (0 % match), new entries (100% match), or partial matches (to be reconciled by patient in a next step).

Matching library code: [amida-tech/blue-button-match](https://github.com/amida-tech/blue-button-match)

#### 3 - Reconciliation Interface.

This provides a RESTful API and UI for review and evaluation of duplicate or partially matched entries, by the patient.

#### 4 - Master Record Interface.

Standard FHIR DSTU2 API is used as master record backend

Documentation for [FHIR DSTU2](https://www.hl7.org/fhir/)

###Prerequisites

- Node.js (v0.12+) and NPM
- Grunt.js
- MongoDB
- Redis

#### prepare
```
# you need Node.js and Grunt.js installed
# and MongoDB + Redis runnning

npm install -g grunt-cli

#then
npm install
```

To run, use `node server`

#### Grunt commands:

`grunt` - To run Server Side tests

#### Swagger API

While `node server` is running, access the Swagger API documentation by going to: `http://localhost:3000/docs/` (last slash is important)

## Contributing

Contributors are welcome. See issues https://github.com/amida-tech/DRE-services/issues

## Contributors

###### Amida team

- Dmitry Kachaev
- Matt McCall
- Ekavali Mishra
- Jamie Johnson
- Matt Martz
- Jacob Sachs
- Mike Hiner
- Byung Joo Shin (summer '14 intern, UVA)
- Kevin Young (summer '14 intern, UMD)
- Nadia Wallace (winter '15 intern, MIT)

###### PWC team

_We gratefully acknowledge PWC's essential support in the development of the FHIR components of DRE, among other important contributions to codebase of this open source project._

- Afsin Ustundag


## Release Notes

See release notes [here] (./RELEASENOTES.md)


## License

Licensed under [Apache 2.0](./LICENSE)
