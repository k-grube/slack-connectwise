var express = require('express'),
    slackCW = require('../slack-connectwise');

var SLACK_SLASH_TOKEN = process.env.SLACK_SLASH_TOKEN;

if (!SLACK_SLASH_TOKEN) {
    throw new Error('SLACK_SLASH_TOKEN env variable must be set.');
}

var router = express.Router();

router.post('/api/slack', function (req, res, next) {
    var startTime = Date.now();
    if (req.body && req.body.token == SLACK_SLASH_TOKEN) {
        //if the query takes too long, send a 'working' message, then post a response
        var timeout = setTimeout(function () {
            res.status(200);
            res.json({
                text: 'Working on it...',
                response_type: 'in_channel'
            });
        }, 1000);
        slackCW.route(req.body, function (msg) {
            console.log('response msg: ', msg);
            if (Date.now() - startTime < 1000) {
                clearTimeout(timeout);
                res.json(msg);
            } else {
                slackCW.send(req.body, msg);
            }
        });
    } else {
        res.status(401);
        res.end();
    }

});

module.exports = router;
