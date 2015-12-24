/**
 * Created by kgrube on 12/23/2015.
 */

var scw = require('./slack-connectwise');

scw.findTicketById('462123')
    .then(console.log)
    .fail(console.log);
