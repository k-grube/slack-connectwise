var express = require('express'),
    slackCW = require('../slack-connectwise');

var SLACK_SLASH_TOKEN = process.env.SLACK_SLASH_TOKEN;

if (!SLACK_SLASH_TOKEN) {
    throw new Error('SLACK_SLASH_TOKEN env variable must be set.');
}

var router = express.Router();

router.post('/api/slack', function (req, res, next) {
    if (req.body && req.body.token === SLACK_SLASH_TOKEN) {
        /** @type SlackMessage */
        var response = {
            username: req.body.user_name,
            text: 'Looking that up for you...',
            response_type: 'ephemeral'
        };

        //res.json(response);
        res.statusCode = 200;
        res.end();

        slackCW.route(req.body, function (msg) {
            slackCW.send(req.body, msg);
        });

    } else {
        res.statusCode = 401;
        res.end();
    }
});

module.exports = router;
