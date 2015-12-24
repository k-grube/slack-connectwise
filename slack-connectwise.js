/**
 * Created by kgrube on 12/23/2015.
 */

var request = require('request'),
    ConnectWise = require('connectwise-rest');

var COMPANY_ID = process.env.COMPANY_ID,
    COMPANY_URL = process.env.COMPANY_URL,
    PUBLIC_KEY = process.env.PUBLIC_KEY,
    PRIVATE_KEY = process.env.PRIVATE_KEY;

var cwt = new ConnectWise({
    companyId: COMPANY_ID,
    companyUrl: COMPANY_URL,
    publicKey: PUBLIC_KEY,
    privateKey: PRIVATE_KEY
}).ServiceDeskAPI.Tickets;

var slackConnectWise = {

    /**
     *
     * @param {SlackBody} body
     * @param {function} callback callback(msg)
     * @returns {*|promise}
     */
    route: function (body, callback) {
        var args = parseArgs(body.text),
            cb = callback;

        console.log('route:', args);

        console.log('args length:', args.length);

        if (!args) {
            cb(this.getUsage());
        } else {
            if (args.length == 1) {
                routeLinkTicket(args[0], args, cb);
            } else if (args[0].toLowerCase() == 'link') {
                routeLinkTicket(args[1], args, cb);
            } else {
                cb(this.getUsage());
            }
        }
    },

    /**
     * Send message via POST from slash command to channel
     * @param {SlackBody} body
     * @param {SlackMessage|object} message
     */
    send: function (body, message) {
        message.username = 'ConnectWise';

        if (!message.response_type) {
            message.response_type = 'in_channel';
        }

        var options = {
            url: body.response_url,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message),
            method: 'POST'
        };

        console.log('Sending POST message: ', message, ' with options: ', options);

        request(options, function (err, res) {
            //@todo something to handle errors here
        });

    },

    /**
     *
     * @param id
     * @returns {Ticket|promise}
     */
    findTicketById: function (id) {
        console.log("searching for id", id);
        return cwt.getTicketById(id)
    },

    /**
     * Search for a single ticket
     * @param conditions
     * @returns {Ticket[]|promise}
     */
    findTicket: function (conditions) {
        console.log('findTicket: searching for conditions', conditions);
        return cwt.getTickets({
            conditions: conditions,
            page: 1,
            pageSize: 1
        });
    },

    /**
     * Search for first 3 matches
     * @param conditions
     *
     */
    findTickets: function (conditions) {
        console.log('findTickets: searching for conditions', conditions);
        return cwt.getTickets({
            conditions: conditions,
            page: 1,
            pageSize: 3,
            orderBy: 'dateEntered desc'
        });
    },

    /**
     *
     * @returns {SlackMessage}
     */
    getUsage: function () {
        /**
         *
         * @type {SlackMessage}
         */
        var message = {};

        message.text = "*/cw* [ *$ticketNbr* [ *link* | *ticket* | *config* ] ]\n" +
            "\n" +
            "    link [ *$ticketNbr* | *$summary* ]\n" +
            "       link [$ticketNbr] - post a link to the ticket $ticketNbr\n" +
            "       link [$summary]   - post the first 5 results of a search for $summary\n" +
            "\n" +
            "    ticket [ *create* | *find* | *status* ]  \n" +
            "       ticket create [$summary=initial summary $company=companyId $board=boardName]\n" +
            "                                   - create a ticket with $summary, for $companyId, on $boardName\n" +
            "       ticket find [ *$summary* ]     - post the first 5 results of a search for $summary\n" +
            "       ticket status [ *$ticketNbr* *$status* ] \n" +
            "                                   - change the status of $ticketId to $status\n" +
            "\n" +
            "    config [ *find* \n" +
            "       config find [ *$configName* ]   - post the first 5 results of a search for $configName\n" +
            "       config find [ *$configId* ]     - post a link to the config $configId";

        message.mrkdwn = true;
        message.response_type = 'ephemeral';

        return message;
    }

};

module.exports = slackConnectWise;

var parseArgs = function (text) {
    var args = text.split(' ');

    if (!args.length) {
        args = [text];
    }

    return args;
};

/**
 *
 * @param id ticketNbr
 * @returns {string}
 */
var linkTicket = function (id) {
    return 'https://' + COMPANY_URL + '/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=' + id + '&companyName=' + COMPANY_ID
};

/**
 *
 * @param id configId
 * @returns {string}
 */
var linkConfig = function (id) {
    return 'https://' + COMPANY_URL + '/v4_6_release/services/system_io/router/openrecord.rails?locale=en_US&recordType=ConfigFv&recid=' + id;
};

/**
 *
 * @param {Ticket} ticket
 * @returns {SlackMessage|object}
 */
var ticketInfo = function (ticket) {
    var msg = {};
    msg.text = ticketInfoStr(ticket);
    msg.mrkdwn = true;
    msg.response_type = 'in_channel';

    console.log('ticket info', msg);

    return msg;
};

/**
 *
 * @param ticket
 * @returns {string}
 */
var ticketInfoStr = function (ticket) {
    var msg = '*' + ticket.summary + '*';
    msg += '\nBoard: ' + ticket.board.name + ', Status: ' + ticket.status.name + ', Company: ' + ticket.company.identifier;
    msg += '\n' + linkTicket(ticket.id);

    console.log('ticket info', msg);

    return msg;
};

var errorHandler = function (err) {
    var msg = {};
    msg.text = '\nCould not find any matching tickets.  Sorry.';
    msg.text += '\n' + JSON.stringify(err);
    msg.response_type = 'in_channel';
};

/**
 * Route a command to the correct Link Ticket command
 * @param {string|number} id
 * @param {string[]} args
 * @param {function} cb
 */
function routeLinkTicket(id, args, cb) {
    console.log('cw link', args);
    //if first arg is a number, try to match, otherwise search
    if (parseInt(id)) {
        slackConnectWise.findTicketById(id)
            .then(function (res) {
                cb(ticketInfo(res));
            })
            .fail(function (err) {
                cb(errorHandler(err));
            });

    } else {
        slackConnectWise.findTickets('summary like "%' + args.slice(1).join(' ') + '%"')
            .then(function (res) {
                if (res.length > 0) {
                    var msg = {};
                    var result = [];
                    for (var i = 0; i < res.length; i++) {
                        result.push(ticketInfoStr(res[i]));
                    }
                    msg.text = result.join('\n');
                    msg.response_type = 'in_channel';
                    msg.mrkdwn = true;

                    cb(msg);
                } else {
                    var msg = {};
                    msg.text = 'Could not find any matching tickets.  Sorry.';
                    msg.response_type = 'in_channel';
                    cb(msg);
                }
            })
            .fail(function (err) {
                cb(errorHandler(err));
            });
    }
}

/**
 * @typedef {object} SlackBody
 * @property token
 * @property team_id
 * @property team_domain
 * @property channel_id
 * @property channel_name
 * @property user_id
 * @property user_name
 * @property command
 * @property text
 * @property response_url
 */

/**
 * @typedef {object} SlackMessage
 * @property {string} text
 * @property {string} response_type ['in_channel', 'ephemeral']
 * @property {object[]} [attachments]
 * @property {string} [attachments.text]
 * @property {string} [attachments.title]
 * @property {string} [attachments.pretext]
 * @property {string[]} [attachments.mrkdwn_in]
 * @property {string} [username]
 * @property {boolean} [mrkdwn]
 */

/**
 * @typedef {object} promise
 * @property then
 * @property fail
 */
