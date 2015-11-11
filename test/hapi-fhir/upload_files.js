// Support of https://github.com/borisyankov/DefinitelyTyped.git
/// <reference path="../../typings/node/node.d.ts"/> 
/// <reference path="../../typings/mocha/mocha.d.ts"/> 
/// <reference path="../../typings/supertest/supertest.d.ts"/>
/// <reference path="../../typings/superagent/superagent.d.ts"/>

var expect = require('chai').expect;
var supertest = require('supertest');
var deploymentLocation = 'http://' + 'localhost' + ':' + '3000';
var request = supertest.agent(deploymentLocation);
var fs = require('fs');
var path = require('path');
var common = require('../common/common.js');

var username = 'user' + (Math.random() * 10000);

var register_user = function (username, request, done) {
	request.post('/api/v1/register').send({
		"username": username,
		"password": "testtest",
		"last": username,
		"first": username,
		"dob": "01/01/1990",
		"gender": "female",
		"email": "noreply@amida-demo.com"
	}).end(function (err, res) {
		if (err) {
			throw err;
		}
		request.saveCookies(res);
		done(request);
	});
};

describe('Test file uploads', function () {

	var agent;

	/** register user with randomly generated username */
	before(function (done) {

		register_user(username, request, function (loginAgent) {
			agent = loginAgent;
			agent
				.post('/api/v1/login')
				.send({
					'username': username,
					'password': "testtest"
				}).expect(200).end(function (err, res) {
					if (err) {
						throw err;
					}
					done();
				});
		});
	});

    it('upload bluebutton-01-original.xml', function (done) {
		var req = agent.put('/api/v1/storage');
		agent.attachCookies(req);
		req.field("check", "false")
			.attach('file', path.join(__dirname, '../artifacts/demo-r1.5/bluebutton-01-original.xml')).
			expect(200).end(function (err, res) {
				if (err) {
					throw err;
				}
				var created = JSON.parse(res.text);
				
				if( !created.length) {
					throw new Error('Upload error - resurces was not creatred');
				}
				
				done();
			});
	});

    it('upload bluebutton-02-updated.xml', function (done) {
		var req = agent.put('/api/v1/storage');
		agent.attachCookies(req);
		req.field("check", "false")
			.attach('file', path.join(__dirname, '../artifacts/demo-r1.5/bluebutton-02-updated.xml')).
			expect(200).end(function (err, res) {
				if (err) {
					throw err;
				}
				var created = JSON.parse(res.text);
				
				if( !created.length) {
					throw new Error('Upload error - resurces was not creatred');
				}
				
				done();
			});
	});

    it('upload bluebutton-03-cms.xml', function (done) {
		var req = agent.put('/api/v1/storage');
		agent.attachCookies(req);
		req.field("check", "false")
			.attach('file', path.join(__dirname, '../artifacts/demo-r1.5/bluebutton-03-cms.txt')).
			expect(200).end(function (err, res) {
				if (err) {
					throw err;
				}
				var created = JSON.parse(res.text);
				
				if( !created.length) {
					throw new Error('Upload error - resurces was not creatred');
				}
				
				done();
			});
	});
	
    it('upload bluebutton-04-partial.xml', function (done) {
		var req = agent.put('/api/v1/storage');
		agent.attachCookies(req);
		req.field("check", "false")
			.attach('file', path.join(__dirname, '../artifacts/demo-r1.5/bluebutton-04-partial.xml')).
			expect(200).end(function (err, res) {
				if (err) {
					throw err;
				}
				var created = JSON.parse(res.text);
				
				if( !created.length) {
					throw new Error('Upload error - resurces was not creatred');
				}
				
				done();
			});
	});
});
