"use strict";

var dbinfo = null;

var mongo = require('mongodb');
var mongoose = require('mongoose');
var _ = require('lodash');
var async = require('async');
//var bbm = require('blue-button-meta');

var models = require('./models');

//set defaults for database name and list of suported sections in BB JSON model
//(to create corresponding collections for all sections)
var fillOptions = function (options) {
    if (!options.dbName) {
        options.dbName = process.env.DBname || 'dre';
    }

    if (!options.supported_sections) {
        //options.supported_sections = bbm.supported_sections;
        options.supported_sections = [
            'allergies',
            'procedures',
            'immunizations',
            'medications',
            'encounters',
            'vitals',
            'results',
            'social_history',
            'demographics',
            'problems',
            'insurance',
            'claims',
            'plan_of_care',
            'payers',
            'providers',
            'organizations'
        ];
    }

    if (!options.demographicsSection) {
        options.demographicsSection = 'demographics';
    }
};

//drop all collections
var dropCollections = function (callback) {
    var collections = Object.keys(this.connection.collections);
    var that = this;
    async.forEach(collections, function (collectionName, cb) {
        var collection = that.connection.collections[collectionName];
        collection.drop(function (err) {
            if (err && err.message !== 'ns not found') {
                cb(err);
            } else {
                cb(null);
            }
        });
    }, callback);
};

//establish connection to database and initialize all needed models
var connect = function (server, inputOptions, callback) {
    var options = _.clone(inputOptions);
    fillOptions(options);

    var dbName = options.dbName;
    var db = new mongo.Db(dbName, new mongo.Server(server, 27017));
    db.open(function (err, dbase) {
        if (err) {
            callback(err);
        } else {
            var dbinfo = {};
            dbinfo.db = dbase;
            dbinfo.GridStore = mongo.GridStore;
            dbinfo.ObjectID = mongo.ObjectID;
            //dbinfo.grid = new mongo.Grid(dbase, 'storage');
            var c = mongoose.createConnection('mongodb://' + server + '/' + dbName);
            dbinfo.connection = c;

            dbinfo.storageModel = models.storageModel(c);
            dbinfo.accountHistoryModel = models.accountHistoryModel(c);
            dbinfo.notesModel = models.notesModel(c);
            dbinfo.searchModel = models.searchModel(c);
            dbinfo.searchPageModel = models.searchPageModel(c);

            dbinfo.dropCollections = dropCollections;

            var r = models.models(c, options.supported_sections);
            if (!r) {
                callback(new Error('models cannot be generated'));
            } else {
                dbinfo.models = r.clinical;
                dbinfo.mergeModels = r.merge;
                dbinfo.matchModels = r.match;
                dbinfo.sectionNames = options.supported_sections;
                dbinfo.sectionNames.sort();

                callback(null, dbinfo);
            }
            if (options.demographicsSection) {
                dbinfo.demographicsSection = options.demographicsSection;
            }
            dbinfo.maxSearch = options.maxSearch || 50;
        }
    });
};

exports.connectDatabase = function connectDatabase(server, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    if (!dbinfo) {
        connect(server, options, function (err, result) {
            if (err) {
                callback(err);
            } else {
                dbinfo = result;

                callback(null, dbinfo);
            }
        });
    } else {
        callback(new Error('Multiple database connections from same client is not supported.'));
    }
};

exports.disconnect = function (callback) {
    if (dbinfo) {
        dbinfo.connection.close(function (err) {
            dbinfo = null;
            callback(err);
        });
    } else {
        callback(new Error('No connection has been established.'));
    }
};

exports.clearDatabase = function (callback) {
    if (dbinfo) {
        dbinfo.dropCollections(callback);
    } else {
        callback(new Error('No connection has been established.'));
    }
};

// records

exports.saveSource = function (ptKey, content, sourceInfo, contentType, callback) {
    var buffer = new Buffer(content);

    var fileMetadata = {
        pat_key: ptKey
    };
    if (contentType) {
        fileMetadata.fileClass = contentType;
    }

    //source of file
    var source = "";
    if (sourceInfo.source) {
        source = sourceInfo.source;
    }

    fileMetadata.source = source;

    var fileId = new dbinfo.ObjectID();

    var gridStore = new dbinfo.GridStore(dbinfo.db, fileId, sourceInfo.name, 'w', {
        root: 'storage',
        metadata: fileMetadata,
        content_type: sourceInfo.type
    });

    if (sourceInfo.type === 'application/pdf') {
        gridStore.writeFile(sourceInfo.path, function (err, result) {
            if (err) {
                callback(err);
            } else {
                gridStore.close(function (err, fileData) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, fileData._id);
                    }
                });
            }
        });
    } else {
        gridStore.open(function (err, gridStore) {
            if (err) {
                callback(err);
            }
            gridStore.write(buffer, function (err, gridStore) {
                if (err) {
                    callback(err);
                }
                gridStore.close(function (err, fileData) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, fileData._id);
                    }
                });
            });
        });
    }
};

exports.getSourceList = function (ptKey, callback) {
    dbinfo.db.collection('storage.files', function (err, recordCollection) {
        if (err) {
            callback(err);
        } else {
            recordCollection.find({
                "metadata.pat_key": ptKey
            }, function (err, findResults) {
                findResults.toArray(function (err, recordArray) {
                    var result = recordArray.map(function (record) {
                        var r = {};
                        r.file_id = record._id;
                        r.file_name = record.filename;
                        r.file_size = record.length;
                        r.file_mime_type = record.contentType;
                        r.file_upload_date = record.uploadDate;

                        if (record.metadata.source) {
                            r.source = record.metadata.source;
                        }

                        if (record.metadata.parsed) {
                            r.file_parsed = record.metadata.parsed;
                        }

                        if (record.metadata.archived) {
                            r.file_archived = record.metadata.archived;
                        }

                        if (record.metadata.fileClass) {
                            r.file_class = record.metadata.fileClass;
                        }
                        r.patient_key = record.metadata.pat_key;
                        return r;
                    });
                    callback(null, result);
                });
            });
        }
    });
};

exports.getSource = function (ptKey, sourceId, callback) {
    dbinfo.db.collection('storage.files', function (err, coll) {
        if (err) {
            callback(err);
        } else {
            if (typeof sourceId === 'string') {
                sourceId = mongoose.Types.ObjectId(sourceId);
            }
            coll.findOne({
                '_id': sourceId,
                'metadata.pat_key': ptKey
            }, function (err, results) {
                if (err) {
                    callback(err);
                } else if (results) {
                    var gridStore = new dbinfo.GridStore(dbinfo.db, results._id, 'r', {
                        root: 'storage'
                    });

                    gridStore.open(function (err, gridStore) {
                        if (err) {
                            callback(err);
                        } else {
                            gridStore.read(function (err2, data) {
                                if (err2) {
                                    callback(err2);
                                } else {
                                    if (results.contentType === 'application/pdf') {
                                        callback(null, results.filename, data);
                                    } else {
                                        var returnFile = data.toString();
                                        callback(null, results.filename, returnFile);
                                    }
                                }
                            });
                        }
                    });
                } else {
                    callback(new Error('no file found'));
                }
            });
        }
    });
};

// section

var hide = function (dbinfo, secName, ptKey, id, callback) {
    if (typeof id === 'string') {
        id = mongoose.Types.ObjectId(id);
    }

    var hideModel = function (callback) {
        var model = dbinfo.models[secName];
        var query = model.update({
            _id: id
        }, {
            hidden: true
        });
        query.exec(callback);
    };

    hideModel(callback);
};

exports.saveSection = function (secName, ptKey, input, sourceId, options, callback) {
    console.log(secName);
    if (callback || options) {
        if (!callback) {
            callback = options;
            options = {};
        }
        if (!options) {
            options = {};
        }
    }
    var localSaveNewEntry = function (entryObject, cb) {
        if (!cb) {
            cb = options;
            options = {};
        }
        if (!options) {
            options = {};
        }
        var entryModel = new dbinfo.models[secName](entryObject);

        var saveEntry = function (cb1) {
            entryModel.save(function (err, saveResult) {
                if (err || (!entryObject._link)) {
                    cb1(err, saveResult);
                } else {
                    hide(dbinfo, secName, entryObject.pat_key, entryObject._link, function (err) {
                        cb1(err, saveResult);
                    });
                }
            });
        };

        saveEntry(cb);
    };

    var prepForDb = function (entryObject) {
        var r = {
            pat_key: ptKey,
            reviewed: true
        };
        if (entryObject) {
            var d = _.clone(entryObject);
            if (d._id) {
                r._id = d._id;
                delete d._id;
            }
            r.data = d;
            if (d._components) {
                r._components = d._components;
                delete d._components;
            }
            if (d._link) {
                r._link = d._link;
                delete d._link;
            }
            if (d._resource) {
                r._resource = d._resource;
                delete d._resource;
            }
        }
        return r;
    };

    if (_.isArray(input)) {
        if (input.length === 0) {
            callback(null, null);
        } else {
            var inputArrayForDb = input.map(prepForDb);
            async.mapSeries(inputArrayForDb, localSaveNewEntry, callback);
        }
    } else {
        var inputForDb = prepForDb(input);
        localSaveNewEntry(inputForDb, callback);
    }
};

//Account History Methods
exports.saveEvent = function (eventType, ptKey, note, file, callback) {
    var newEvent = new dbinfo.accountHistoryModel({
        username: ptKey,
        event_type: eventType,
        note: note, //file descriptor, IP address
        fileRef: file //MongoDB _id
    });

    newEvent.save(function (err, result) { //removed ,num
        if (err) {
            console.log("error", err);
            callback(err);
        } else {
            callback(null, result);
        }
    });
};

exports.getAllEvents = function (ptKey, callback) {
    var model = dbinfo.accountHistoryModel;
    model.find({
        "username": ptKey
    }).sort({
        time: 1
    }).exec(function (err, docs) {
        callback(err, docs);
    });
};

exports.getRecentLogin = function (ptKey, callback) {
    var model = dbinfo.accountHistoryModel;
    var loginQuery = model.find({
        'event_type': 'loggedIn',
        "username": ptKey

    }).sort({
        time: -1
    });
    loginQuery.exec(function (err, logins) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            if (logins.length === 1) {
                //this is first login
                callback(null, logins[0]);
            } else if (logins.length === 0) {
                //no logins (e.g. in registered state)
                callback(null, null);
            } else {
                //multiple logins
                callback(null, logins[1]);
            }
        }
    });
};

exports.getRecentUpdate = function (ptKey, callback) {
    var model = dbinfo.accountHistoryModel;

    var updateQuery = model.find({
        'event_type': 'fileUploaded',
        "username": ptKey

    }).sort({
        time: -1
    });
    updateQuery.exec(function (err, updates) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            if (updates) {
                callback(null, updates[0]);
            } else {
                //no files uploaded, so return account initialized
                var lastUpdate = model.findOne({
                    event_type: 'initAccount'
                }, function (err, update) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        callback(null, update);
                    }
                });
            }
        }
    });
};

exports.addNote = function (ptKey, section, entry, note, callback) {
    var newNote = new dbinfo.notesModel({
        username: ptKey,
        section: section,
        entry: entry, //reference to entry _id in mongo
        note: note
    });

    newNote.save(function (err, result) {
        if (err) {
            callback(err);
        } else {
            callback(null, result);
        }
    });
};

exports.editNote = function (ptKey, id, note, callback) {
    var model = dbinfo.notesModel;
    model.findOne({
        "username": ptKey,
        "_id": id
    }).exec(function (err, n) {
        n.note = note;
        n.datetime = Date.now(); //timestamp with current time
        n.save(function (err, result) {
            if (err) {
                console.log("error", err);
                callback(err);
            } else {
                callback(null, result);
            }
        });
    });
};

exports.starNote = function (ptKey, id, star, callback) {
    var model = dbinfo.notesModel;
    model.findOne({
        "username": ptKey,
        "_id": id
    }).exec(function (err, note) {
        note.star = star;
        note.save(function (err, result) {
            if (err) {
                console.log("error", err);
                callback(err);
            } else {
                callback(null, result);
            }
        });
    });
};

exports.deleteNote = function (ptKey, id, callback) {
    var model = dbinfo.notesModel;
    model.findOne({
        "username": ptKey,
        "_id": id
    }).remove().exec(function (err, note) {
        if (err) {
            console.log("error", err);
            callback(err);
        } else {
            callback(null);
        }
    });
};

exports.getAllNotes = function (ptKey, callback) {
    var model = dbinfo.notesModel;
    model.find({
        "username": ptKey
    }).sort({
        date: -1
    }).exec(function (err, docs) {
        callback(err, docs);
    });
};
