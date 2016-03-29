/**
 * Created by kgrube on 12/23/2015.
 */

var request = require('request'),
    ConnectWise = require('connectwise-rest'),
    moment = require('moment'),
    Q = require('q'),
    minimist = require('minimist');

require('moment-timezone');

var COMPANY_ID = process.env.COMPANY_ID,
    COMPANY_URL = process.env.COMPANY_URL,
    PUBLIC_KEY = process.env.PUBLIC_KEY,
    PRIVATE_KEY = process.env.PRIVATE_KEY,
    SLACK_TZ = process.env.SLACK_TZ || 'America/Los_Angeles';

/**
 * @type Tickets
 */
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
     * @param {function} cb callback(msg)
     * @returns {*|promise}
     */
    route: function (body, cb) {
        var args = parseArgs(body.text);

        if (!args.e) {
            args.e = false;
        }

        console.log('route:', args);

        if (args.ticket === 'find' || args.ticket === 'f') {
            //find ticket
            if (args.n > 0) {
                //by ticket number
                slackConnectWise.findTicketById(args.n)
                    .then(function (res) {
                        cb(ticketInfo(res, args.e));
                    })
                    .fail(function (err) {
                        cb(errorHandler(err, 'Ticket'));
                    });
            } else if (args['--'].length > 0) {
                //by summary
                slackConnectWise.findTickets('summary like "%' + args['--'].join(' ') + '%"')
                    .then(function (res) {
                        if (res.length > 0) {
                            var msg = {};
                            var attachments = [];
                            for (var i = 0; i < res.length; i++) {
                                attachments.push(ticketInfoAttachment(res[i], args.e));
                            }

                            msg.mrkdwn = true;
                            msg.username = "ConnectWise";
                            msg.attachments = attachments;
                            msg.response_type = 'in_channel';

                            cb(msg);
                        } else {
                            cb(errorHandler(null, 'tickets'));
                        }
                    })
                    .fail(function (err) {
                        cb(errorHandler(err, 'Ticket'));
                    });
            }
        } else if (args.link) {
            //link to ticket
            if (args['--'].length > 0) {
                //by summary
                slackConnectWise.findTickets('summary like "%' + args['--'].join(' ') + '%"')
                    .then(function (res) {
                        if (res.length > 0) {
                            var msg = {};
                            var attachments = [];
                            for (var i = 0; i < res.length; i++) {
                                attachments.push(ticketInfoAttachment(res[i], args.e));
                            }

                            msg.mrkdwn = true;
                            msg.username = "ConnectWise";
                            msg.attachments = attachments;
                            msg.response_type = 'in_channel';

                            cb(msg);
                        } else {
                            cb(errorHandler(null, 'tickets'));
                        }
                    })
                    .fail(function (err) {
                        cb(errorHandler(err, 'Ticket'));
                    });
            } else if (args.n) {
                //by ticket number
                slackConnectWise.findTicketById(args.n)
                    .then(function (res) {
                        cb(ticketInfo(res, args.e));
                    })
                    .fail(function (err) {
                        cb(errorHandler(err, 'Ticket'));
                    });
            } else {
                //send usage
                cb(this.getUsage());
            }
        } else if (args['_'].length > 0) {
            //check if using /cw 123456 shortcut
            if (/^\d+$/.test(args['_'][0])) {
                //by ticket number
                slackConnectWise.findTicketById(args['_'][0])
                    .then(function (res) {
                        cb(ticketInfo(res, args.e));
                    })
                    .fail(function (err) {
                        cb(errorHandler(err, 'Ticket'));
                    });
            } else {
                //send usage
                cb(this.getUsage());
            }
        } else {
            //send usage
            cb(this.getUsage());
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

        console.log('Sending POST message: ', message);

        request(options, function (err, res) {
            //@todo something to handle errors here
            console.log('request err', err);
        });

    },

    /**
     *
     * @param id
     * @returns {Ticket|promise}
     */
    findTicketById: function (id) {
        console.log("searching for id", id);
        return cwt.getTicketById(id).then(function (ticket) {
            return cwt.api(ticket._info.notes_href, 'GET').then(function (notes) {
                ticket.notes = notes;
                return ticket;
            })
        })
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
        }).then(function (tickets) {
            return Q.all(tickets.map(function (ticket) {
                return cwt.api(ticket._info.notes_href, 'GET').then(function (notes) {
                    ticket.notes = notes;
                    return ticket;
                });
            }));
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
        }).then(function (tickets) {
            return Q.all(tickets.map(function (ticket) {
                return cwt.api(ticket._info.notes_href, 'GET').then(function (notes) {
                    ticket.notes = notes;
                    return ticket;
                });
            }));
        });
    },

    createTicket: function (summary, companyId, board, initialDescription) {
        return cwt.createTicket({
            summary: summary,
            company: {
                identifier: companyId
            },
            board: {
                name: board
            },
            initialDescription: initialDescription
        });
    },

    /**
     *
     * @param id
     * @param status
     * @returns {promise}
     */
    updateStatus: function (id, status) {
        return cwt.updateTicketStatusByName(id, status);
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

        message.text = "*/cw* [ *$ticketNbr* ] | [ *link* | *ticket* ]\n" +
            "\n" +
            "    -link [ *$ticketNbr* | *$summary* ]\n" +
            "       -link -n [$ticketNbr] - post a link to the ticket $ticketNbr\n" +
            "       -link -- [$summary]   - post the first 5 results of a search for $summary\n" +
            "\n" +
            "    -ticket [ *find* ]  \n" +
                //"       -ticket create [-summary=initial summary $company=companyId $board=boardName]\n" +
                //"                                   - create a ticket with $summary, for $companyId, on $boardName\n" +
            "       -ticket find -- [ *$summary* ]  - post the first 3 results of a search for $summary\n" +
                //"       -ticket status [ *$ticketNbr* *$status* ] \n" +
                //"                                   - change the status of $ticketId to $status\n" +
                //"\n" +
                //"    -config [ *find* \n" +
                //"       config find [ *$configName* ]   - post the first 3 results of a search for $configName\n" +
                //"       config find [ *$configId* ]     - post a link to the config $configId";
            "";

        message.mrkdwn = true;
        message.response_type = 'ephemeral';

        return message;
    }

};

module.exports = slackConnectWise;

/**
 * @typedef {object} ParsedArgs
 * @property {string} ticket ticket action
 * @property {number} n numeric input
 * @property {string} config config action
 * @property {string} link link action
 * @property {string[]} -- args with spaces
 * @property {string[]} _ unparsed args
 */

/**
 *
 * @param text
 * @returns {ParsedArgs}
 */
var parseArgs = function (text) {
    var args = text.split(' ');

    if (!args.length) {
        args = [args];
    }

    return minimist(args, {
        alias: {ticket: 't', config: 'c', link: 'l'},
        '--': true
    });
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
 * @param {boolean} extended
 * @returns {SlackMessage}
 */
var ticketInfo = function (ticket, extended) {
    /**
     * @type {SlackMessage}
     */
    var msg = {};
    msg.mrkdwn = true;
    msg.username = "ConnectWise";
    msg.attachments = [ticketInfoAttachment(ticket, extended)];
    msg.response_type = 'in_channel';

    return msg;
};

/**
 *
 * @param {Ticket} ticket
 * @param {boolean} extended
 * @returns {object}
 */
var ticketInfoAttachment = function (ticket, extended) {

    var attachment = {};

    attachment.fallback = +ticket.id + ': ' + ticket.summary + ': ' + linkTicket(ticket.id);
    attachment.pretext = '#<' + linkTicket(ticket.id) + '|' + ticket.id + '> ' + ticket.summary;

    attachment.fields = [{
        title: 'Entered',
        value: moment(ticket.dateEntered).tz(SLACK_TZ).format('MM-DD-YYYY hh:mm a'),
        short: true
    }, {
        title: 'Status',
        value: ticket.status.name,
        short: true
    }, {
        title: 'Company',
        value: ticket.company.identifier,
        short: true
    }, {
        title: 'Contact',
        value: ticket.contact.name,
        short: true
    }, {
        title: 'Average Time',
        value: ticket.customFields[1] && ticket.customFields[1].value || "",
        short: true
    }, {
        title: 'Priority',
        value: ticket.priority.name,
        short: true
    }, {
        title: 'Ticket Owner',
        value: ticket.owner.identifier,
        short: true
    }];

    if (extended) {
        attachment.fields.push({
            title: 'Description',
            value: ticket.notes[0] && ticket.notes[0].text,
            short: false
        });
    }

    return attachment;

};

/**
 *
 * @param {Ticket} ticket
 * @param {boolean} extended
 * @returns {string}
 */
var ticketInfoStr = function (ticket, extended) {
    var msg = '*' + ticket.summary + '*';
    console.log('dateEntered', ticket.dateEntered);
    var dateEntered = moment(ticket.dateEntered).tz(SLACK_TZ).format('MM-DD-YYYY hh:mm a');

    msg += '\n#<' + linkTicket(ticket.id) + '|' + ticket.id + '> Entered: ' + dateEntered + ', Status: '
        + ticket.status.name + ', Company: ' + ticket.company.identifier;

    return msg;
};

/**
 *
 * @param err
 * @param type
 * @returns {SlackMessage}
 */
var errorHandler = function (err, type) {
    /**
     *
     * @type {SlackMessage}
     */
    var msg = {};
    msg.text = 'Could not find any matching ' + type + '.  Sorry.';
    if (err) {
        msg.text += '\n' + JSON.stringify(err);
    }
    msg.response_type = 'ephemeral';
    return msg;
};

/**
 * Route a command to the correct Link Ticket command
 * @param {string[]} args
 * @param {function} cb returns @type SlackMessage
 */
function routeLinkTicket(args, cb) {
    console.log('cw link', args);
    var id, summary;

    if (args.length > 1) {
        if (args[0].toLowerCase() === 'ticket' || args[0].toLowerCase() === 't') {
            if (args[1].toLowerCase() === 'find' || args[1].toLowerCase() === 'f') {
                if (parseInt(args[2])) {
                    id = args[2];
                } else {
                    summary = args.slice(2).join(' ');
                }
            } else {
                cb(slackConnectWise.getUsage());
            }
        } else if (args[1].toLowerCase() === 'link' || args[1].toLowerCase() === 'l') {
            if (parseInt(args[2])) {
                id = args[2];
            } else {
                summary = args.slice(2).join(' ');
            }
        } else {
            summary = args.join(' ');
        }
    } else if (parseInt(args[0])) {
        id = args[0];
    }

    if (id) {
        slackConnectWise.findTicketById(id)
            .then(function (res) {
                cb(ticketInfo(res));
            })
            .fail(function (err) {
                cb(errorHandler(err, 'Ticket'));
            });

    } else if (summary) {
        slackConnectWise.findTickets('summary like "%' + summary + '%"')
            .then(function (res) {
                if (res.length > 0) {
                    var msg = {};
                    var result = [];
                    for (var i = 0; i < res.length; i++) {
                        result.push(ticketInfoStr(res[i], args.e));
                    }
                    msg.text = result.join('\n');
                    msg.response_type = 'in_channel';
                    msg.mrkdwn = true;

                    cb(msg);
                } else {
                    cb(errorHandler(null, 'tickets'));
                }
            })
            .fail(function (err) {
                cb(errorHandler(err, 'Ticket'));
            });
    } else {
        cb(slackConnectWise.getUsage());
    }
}

/**
 *
 * @param {string[]} args
 * @param {function} cb
 */
var routeCreateTicket = function (args, cb) {
    switch (args[1].toLowerCase()) {
        case 'create' || 'c':

            //slackConnectWise.createTicket();
            break;
        case 'find' || 'f':
            routeLinkTicket(args, cb);
            break;
        case 'status' || 's':
            var re = /(\d{1,10}) ([a-zA-Z]*$)/g;
            var params = re.exec(args.join(' '));
            if (!params || !params[0] || !params[1]) {
                cb(slackConnectWise.getUsage());
            } else {
                //slackConnectWise.updateStatus(params[1], params[2]).then(cb).fail(cb);
            }
            break;
        default:
            cb(slackConnectWise.getUsage());
            break;
    }

};

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
