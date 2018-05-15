'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

exports.default = request;

var _request = require('js-utility-belt/lib/request');

var _request2 = _interopRequireDefault(_request);

var _sanitize = require('js-utility-belt/lib/sanitize');

var _sanitize2 = _interopRequireDefault(_sanitize);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_REQUEST_CONFIG = {
    credentials: 'include',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

    /**
     * Small wrapper around js-utility-belt's request that provides default settings and response
     * handling
     */
}; // eslint-disable-line import/no-named-default
function request(url, config) {
    // Load default fetch configuration and remove any falsey query parameters
    var requestConfig = (0, _extends3.default)({}, DEFAULT_REQUEST_CONFIG, config, {
        query: config.query && (0, _sanitize2.default)(config.query)
    });

    return (0, _request2.default)(url, requestConfig).then(function (res) {
        return res.json();
    }).catch(function (err) {
        console.error(err);
        throw err;
    });
}
module.exports = exports['default'];