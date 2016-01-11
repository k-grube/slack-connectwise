/**
 * Created by kgrube on 12/23/2015.
 */

var scw = require('./slack-connectwise');

var moment = require('moment');



var test = moment('2008-09-25T19:05:03Z').tz('America/Los_Angeles');

console.log(test.format('MM-DD-YYYY hh:mm a'));