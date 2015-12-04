/*=======================================================================
Copyright 2013 Amida Technology Solutions (http://amida-tech.com)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
======================================================================*/

var express = require('express');
var flash = require('connect-flash');
var fs = require('fs');
var http = require('http');
var path = require('path');
var app = express();
var passport = require('passport');

var logger = require('morgan');
var multiparty = require('connect-multiparty');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

module.exports = function () {

    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json({
        'strict': false
    }));

    //Adding CORS for Swagger UI
    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", req.get('origin') || "*");
        res.header("Access-Control-Allow-Credentials", true);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT");
        next();
    });

    //to prevent caching of API calls
    app.disable('etag');
    
    app.use('/docs', express.static('./swagger'));

    app.engine('html', require('ejs').renderFile);

    app.use(logger('dev'));
    app.use(methodOverride());
    app.use(cookieParser());
    app.use('/api/v1/storage', multiparty());

    var redisStore = require('connect-redis')(session); //uncomment for Redis session support during development

    /*      Porting notes from express 3: Item 1 was what it was before, 2s are
            equivalent versions from previous express 3 versions */
    //     1) app.use(express.bodyParser());
    //     2)app.use(connect.json());
    //     2)app.use(connect.urlencoded());
    //     2)app.use(connect.multipart());

    //app.use(express.session({ secret: 'keyboard cat', key: 'sid', cookie: { secure: true }}));
    app.use(session({
        secret: 'keyboard cat',
        resave: true,
        saveUninitialized: true,
        store: new redisStore({
                host: process.env.REDIS_PORT_6379_TCP_ADDR || '0.0.0.0',
                port: 6379,
                prefix: 'chs-sess'
            }) //uncomment for Redis session support during development
    }));

    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());

    //Initialize Database Connection.
    //var databaseServer = process.env.DB || 'mongodb://localhost:27017';
    //var databaseServer = process.env.DB || 'localhost:27017';

    app.set('db_url', process.env.MONGO_PORT_27017_TCP_ADDR || 'localhost');
    app.set('db_name', process.env.DBname || 'dre');

    console.log("DB URL: ", app.get('db_url') + ":27017/" + app.get('db_name'));

    var storage = require('../lib/storage');
    app.use(storage);

    var login = require('../lib/login');
    app.use(login);

    var account = require('../lib/account');
    app.use(account);

    var accountHistory = require('../lib/account-history');
    app.use(accountHistory);

    var notes = require('../lib/notes');
    app.use(notes);

    var medapi = require('../lib/medapi');
    app.use(medapi);
    
    var npiapi = require('../lib/npiapi');
    app.use(npiapi);

    var dre = require('../lib/dre');
    app.use(dre);

    var record = require('../lib/record');
    app.use(record);
    
    app.set('port', (process.env.PORT || 3000));

    return app;

};
