var express = require('express');
var app = module.exports = express();

app.get('/api/v1/account', function (req, res) {
    res.status(200).send(
        (req.isAuthenticated())? {
            "authenticated": true,
            'username': req.user.username
        }: {
            "authenticated": false
        }
    );
});
