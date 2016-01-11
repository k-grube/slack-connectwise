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
            text: req.body.command + ' ' + req.body.text,
            response_type: 'in_channel'
        };

        res.json(response);

        slackCW.route(req.body, function (msg) {
            console.log('response msg: ', msg);
            slackCW.send(req.body, msg);
        });

    } else {
        res.status(401);
        res.end();
    }
});

module.exports = router;
