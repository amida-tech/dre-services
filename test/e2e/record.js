"use strict";

var path = require('path');
var chai = require('chai');
var supertest = require('supertest');
var common = require('../common/common.js');

var deploymentLocation = 'http://localhost:3000';
var api = supertest.agent(deploymentLocation);
var expect = chai.expect;

describe('mhr API', function () {
    before(function (done) {
        common.register(api, 'test', 'test', function (err) {
            if (err) {
                done(err);
            } else {
                common.login(api, 'test', 'test', done);
            }
        });
    });

    it('file endpoint PUT', function (done) {
        var filepath = path.join(__dirname, '../artifacts/test-r1.5/bluebutton-01-original.xml');

        api.put('/api/v1/storage')
            .attach('file', filepath)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                } else {
                    expect(res.body).to.deep.equal({});
                    done();
                }
            });
    });

    it('rewrite', function(done) {
        api.get('/api/v1/mhr')
            .expect(200)
            .end(function(err, res) {
                console.log(res.text);
                done(err);
            });
    });
});
