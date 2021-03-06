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
  SLACK_TZ = process.env.SLACK_TZ || 'America/Los_Angeles',
  ENTRY_POINT = process.env.ENTRY_POINT || '',
  API_VERSION = process.env.API_VERSION || '2019.5';

/**
 * @type Tickets
 */
var cwt = new ConnectWise({
  companyId: COMPANY_ID,
  companyUrl: COMPANY_URL,
  publicKey: PUBLIC_KEY,
  privateKey: PRIVATE_KEY,
  entryPoint: ENTRY_POINT,
  clientId: '306e9c31-2589-49bc-a9bf-bcba616b3f98',
  apiVersion: API_VERSION,
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
      args.e = false; //explicitly set to false as opposed to 'falsey'
    }

    console.log('route:', args);

    if (args.ticket === 'find' || args.ticket === 'f') {
      //find ticket
      if (args.n > 0) {
        //by ticket number
        routeFindTicketById(args.n, args.e, cb);
      } else if (args['--'].length > 0) {
        //by summary
        routeFindTicketsBySummary(args['--'].join(' '), args.e, cb);
      } else {
        cb(this.getUsage());
      }
    } else if (args.link) {
      //link to ticket
      if (args['--'].length > 0) {
        //by summary
        routeFindTicketsBySummary(args['--'].join(' '), args.e, cb);
      } else if (args.n) {
        //by ticket number
        routeFindTicketById(args.n, args.e, cb);
      } else {
        //send usage
        cb(this.getUsage());
      }
    } else if (args['_'].length > 0) {
      //check if using /cw 123456 shortcut
      if (/^\d+$/.test(args['_'][0])) {
        //by ticket number
        routeFindTicketById(args['_'][0], args.e, cb);
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      method: 'POST',
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
   * @returns {Promise<Ticket>}
   */
  findTicketById: function (id) {
    console.log('searching for id', id);
    return cwt.getTicketById(id).then(function (ticket) {
      return cwt.api(ticket._info.notes_href, 'GET').then(function (notes) {
        ticket.notes = notes;
        return ticket;
      });
    });
  },

  /**
   * Search for a single ticket
   * @param conditions
   * @returns {Promise<Ticket[]>}
   */
  findTicket: function (conditions) {
    console.log('findTicket: searching for conditions', conditions);
    return cwt.getTickets({
      conditions: conditions,
      page: 1,
      pageSize: 1,
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
      orderBy: 'dateEntered desc',
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
        identifier: companyId,
      },
      board: {
        name: board,
      },
      initialDescription: initialDescription,
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

    message.text = '*/cw* [ *$ticketNbr* ] | [ *link* | *ticket* ]\n' +
      '\n' +
      '    [-l | --link] [ *$ticketNbr* | *$summary* ]\n' +
      '       --link -n [$ticketNbr] - post a link to the ticket $ticketNbr\n' +
      '       --link -- [$summary]   - post the first 5 results of a search for $summary\n' +
      '\n' +
      '    [-t | --ticket] [ *find* ]  \n' +
      //"       -ticket create [-summary=initial summary $company=companyId $board=boardName]\n" +
      //"                                   - create a ticket with $summary, for $companyId, on $boardName\n" +
      '       --ticket find -- *$summary*  - post the first 3 results of a search for $summary\n' +
      //"       -ticket status [ *$ticketNbr* *$status* ] \n" +
      //"                                   - change the status of $ticketId to $status\n" +
      //"\n" +
      //"    -config [ *find* \n" +
      //"       config find [ *$configName* ]   - post the first 3 results of a search for $configName\n" +
      //"       config find [ *$configId* ]     - post a link to the config $configId";
      '';

    message.mrkdwn = true;
    message.response_type = 'ephemeral';

    return message;
  },

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
    string: ['ticket', 'config', 'link'],
    boolean: ['e'],
    '--': true,
  });
};

/**
 *
 * @param id ticketNbr
 * @returns {string}
 */
var linkTicket = function (id) {
  return `https://${COMPANY_URL}/v4_6_release/services/system_io/router/openrecord.rails?locale=en_US&companyName=${COMPANY_ID}&recordType=ServiceFV&recid=${id}`;
};

/**
 *
 * @param id configId
 * @returns {string}
 */
var linkConfig = function (id) {
  return `https://${COMPANY_URL}/v4_6_release/services/system_io/router/openrecord.rails?locale=en_US&companyName=${COMPANY_ID}&recordType=ConfigFV&recid=${id}`;
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
  msg.username = 'ConnectWise';
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
    value: moment(ticket._info && ticket._info.dateEntered).tz(SLACK_TZ).format('MM-DD-YYYY hh:mm a'),
    short: true,
  }, {
    title: 'Status',
    value: ticket.status && ticket.status.name || '',
    short: true,
  }, {
    title: 'Company',
    value: ticket.company && ticket.company.identifier || '',
    short: true,
  }, {
    title: 'Contact',
    value: ticket.contact && ticket.contact.name || '',
    short: true,
  }, {
    title: 'Average Time',
    value: ticket.customFields && ticket.customFields[1] && ticket.customFields[1].value || '',
    short: true,
  }, {
    title: 'Priority',
    value: ticket.priority && ticket.priority.name || '',
    short: true,
  }, {
    title: 'Ticket Owner',
    value: ticket.owner && ticket.owner.identifier || '',
    short: true,
  }, {
    title: 'Site',
    value: ticket.site && ticket.site.name || '',
    short: true,
  }];

  if (extended) {
    attachment.fields.push({
      title: 'Description',
      value: ticket.notes && ticket.notes[0] && ticket.notes[0].text,
      short: false,
    });
  }

  return attachment;

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
 *
 * @param {string|number} id
 * @param {boolean} extended
 * @param cb cb(msg)
 */
function routeFindTicketById(id, extended, cb) {
  slackConnectWise.findTicketById(id)
    .then(function (res) {
      cb(ticketInfo(res, extended));
    })
    .catch(function (err) {
      cb(errorHandler(err, 'Ticket'));
    });
}

/**
 *
 * @param {string} summary
 * @param {boolean} extended
 * @param cb cb(msg)
 */
function routeFindTicketsBySummary(summary, extended, cb) {
  slackConnectWise.findTickets('summary like "%' + summary + '%"')
    .then(function (res) {
      if (res.length > 0) {
        var msg = {};
        msg.attachments = [];
        for (var i = 0; i < res.length; i++) {
          msg.attachments.push(ticketInfoAttachment(res[i], extended));
        }

        msg.mrkdwn = true;
        msg.username = 'ConnectWise';
        msg.response_type = 'in_channel';

        cb(msg);
      } else {
        cb(errorHandler(null, 'tickets'));
      }
    })
    .catch(function (err) {
      cb(errorHandler(err, 'Ticket'));
    });
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
