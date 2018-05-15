'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var sha3 = require('js-sha3');
var pyShell = require('python-shell');

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _reconnectCore = require('reconnect-core');

var _reconnectCore2 = _interopRequireDefault(_reconnectCore);

var _eventemitter = require('eventemitter2');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

var _bs = require('bs58');

var _bs2 = _interopRequireDefault(_bs);

var _v = require('uuid/v4');

var _v2 = _interopRequireDefault(_v);

var _bigchaindbDriver = require('bigchaindb-driver');

var driver = _interopRequireWildcard(_bigchaindbDriver);

var _simpleWebsocket = require('simple-websocket');

var _simpleWebsocket2 = _interopRequireDefault(_simpleWebsocket);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function sha256Hash(data) {
    return sha3.sha3_256
        .create()
        .update(data)
        .hex()
}

var BigchainDBLedgerPlugin = function (_EventEmitter) {
    (0, _inherits3.default)(BigchainDBLedgerPlugin, _EventEmitter);

    function BigchainDBLedgerPlugin(opts) {
        (0, _classCallCheck3.default)(this, BigchainDBLedgerPlugin);

        var _this = (0, _possibleConstructorReturn3.default)(this, (BigchainDBLedgerPlugin.__proto__ || Object.getPrototypeOf(BigchainDBLedgerPlugin)).call(this));

        _this._server = opts.server;
        _this._ws = opts.ws;
        _this._keyPair = opts.keyPair;
        _this._conn = null;
        _this._connected = false;
        _this._prefix = 'g.crypto.bigchaindb.';
        _this._transfers = {};
        _this._notesToSelf = {};
        _this._fulfillments = {};

        if (!_this._keyPair) {
            throw new Error('missing opts.secret');
        }

        if (!_this._server) {
            throw new Error('missing opts.server');
        }

        if (!_this._ws) {
            throw new Error('missing opts.ws');
        }
        return _this;
    }

    (0, _createClass3.default)(BigchainDBLedgerPlugin, [{
        key: 'connect',
        value: function () {
            var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
                return _regenerator2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                this._conn = new driver.Connection(this._server);
                                _context.next = 3;
                                return this._connect();

                            case 3:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            }));

            function connect() {
                return _ref.apply(this, arguments);
            }

            return connect;
        }()
    }, {
        key: '_connect',
        value: function _connect() {
            var _this2 = this;

            var streamUri = this._ws;

            if (this.connection) {
                console.warn('already connected, ignoring connection request');
                return Promise.resolve(null);
            }

            console.log('subscribing to ' + streamUri);

            var reconnect = (0, _reconnectCore2.default)(function () {
                return new _simpleWebsocket2.default(streamUri);
            });

            return new Promise(function (resolve, reject) {
                _this2.connection = reconnect({ immediate: true }, function (ws) {
                    ws.on('open', function () {
                        console.log('ws connected to ' + streamUri);
                    });
                    ws.on('data', function (msg) {
                        var ev = JSON.parse(msg);
                        console.log(ev);
                        _this2._handleTransaction(ev);
                    });
                    ws.on('close', function () {
                        console.log('ws disconnected from ' + streamUri);
                    });
                }).once('connect', function () {
                    return resolve(null);
                }).on('connect', function () {
                    _this2._connected = true;
                    _this2.emit('connect');
                }).on('disconnect', function () {
                    _this2._connected = false;
                    _this2.emit('disconnect');
                }).on('error', function (err) {
                    console.warn('ws error on ' + streamUri + ':  ' + err);
                    reject(err);
                }).connect();
            });
        }
    }, {
        key: 'disconnect',
        value: function disconnect() {
            if (this.connection) {
                this.connection.disconnect();
                this.connection = null;
            }
        }
    }, {
        key: 'isConnected',
        value: function isConnected() {
            return this._connected;
        }
    }, {
        key: 'getInfo',
        value: function getInfo() {
            return {
                prefix: this._prefix,
                precision: 10,
                scale: 4
            };
        }
    }, {
        key: 'getAccount',
        value: function getAccount() {
            return this._prefix + this._keyPair.publicKey;
        }
    }, {
        key: 'getBalance',
        value: function () {
            var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
                var unspentTransactions;
                return _regenerator2.default.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                _context2.next = 2;
                                return this._getUnspentTransactions();

                            case 2:
                                unspentTransactions = _context2.sent;
                                return _context2.abrupt('return', unspentTransactions.map(function (transaction) {
                                    return transaction.outputs.map(function (output) {
                                        return parseInt(output.amount, 10);
                                    }).reduce(function (prevVal, elem) {
                                        return prevVal + elem;
                                    }, 0);
                                }).reduce(function (prevVal, elem) {
                                    return prevVal + elem;
                                }, 0));

                            case 4:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));

            function getBalance() {
                return _ref2.apply(this, arguments);
            }

            return getBalance;
        }()
    }, {
        key: '_getUnspentTransactions',
        value: function () {
            var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
                var _this3 = this;

                var outputs, unspentTransactions;
                return _regenerator2.default.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                _context4.next = 2;
                                return this._getUnspentOutputs();

                            case 2:
                                outputs = _context4.sent;
                                _context4.next = 5;
                                return Promise.all(outputs.map(function () {
                                    var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(output) {
                                        return _regenerator2.default.wrap(function _callee3$(_context3) {
                                            while (1) {
                                                switch (_context3.prev = _context3.next) {
                                                    case 0:
                                                        _context3.next = 2;
                                                        return _this3._getTransactionForOutput(output);

                                                    case 2:
                                                        return _context3.abrupt('return', _context3.sent);

                                                    case 3:
                                                    case 'end':
                                                        return _context3.stop();
                                                }
                                            }
                                        }, _callee3, _this3);
                                    }));

                                    return function (_x) {
                                        return _ref4.apply(this, arguments);
                                    };
                                }()));

                            case 5:
                                unspentTransactions = _context4.sent;
                                return _context4.abrupt('return', unspentTransactions.filter(function (transaction) {
                                    return !!transaction.metadata && !!transaction.metadata.type && (transaction.metadata.type === 'ilp:coin' || transaction.metadata.type === 'ilp:fulfill' || transaction.metadata.type.hasOwnProperty('ilp:coin') || transaction.metadata.type.hasOwnProperty('ilp:fulfill')) && transaction.outputs[0].public_keys.length === 1;
                                }));

                            case 7:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, this);
            }));

            function _getUnspentTransactions() {
                return _ref3.apply(this, arguments);
            }

            return _getUnspentTransactions;
        }()
    }, {
        key: '_getUnspentOutputs',
        value: function () {
            var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
                var publicKey;
                return _regenerator2.default.wrap(function _callee5$(_context5) {
                    while (1) {
                        switch (_context5.prev = _context5.next) {
                            case 0:
                                publicKey = this._keyPair.publicKey;
                                _context5.next = 3;
                                return this._conn.listOutputs(publicKey, false) // eslint-disable-line no-return-await
                                .then(function (res) {
                                    return res;
                                });

                            case 3:
                                return _context5.abrupt('return', _context5.sent);

                            case 4:
                            case 'end':
                                return _context5.stop();
                        }
                    }
                }, _callee5, this);
            }));

            function _getUnspentOutputs() {
                return _ref5.apply(this, arguments);
            }

            return _getUnspentOutputs;
        }()
    }, {
        key: '_getTransactionForOutput',
        value: function () {
            var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(output) {
                var txId;
                return _regenerator2.default.wrap(function _callee6$(_context6) {
                    while (1) {
                        switch (_context6.prev = _context6.next) {
                            case 0:
                                txId = output.transaction_id;
                                _context6.next = 3;
                                return this._conn.getTransaction(txId) // eslint-disable-line no-return-await
                                .then(function (tx) {
                                    return tx;
                                });

                            case 3:
                                return _context6.abrupt('return', _context6.sent);

                            case 4:
                            case 'end':
                                return _context6.stop();
                        }
                    }
                }, _callee6, this);
            }));

            function _getTransactionForOutput(_x2) {
                return _ref6.apply(this, arguments);
            }

            return _getTransactionForOutput;
        }()
    }, {
        key: 'sendTransfer',
        value: function () {
            var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(transfer) {
                var _this4 = this;

                var _transfer$to$match, _transfer$to$match2, localAddress, amount, unspentTransactions, inputTransaction, inputAmount, subconditionExecute, subconditionExecute1, subconditionAbort, condition, output, conditionChange, outputs, changeAmount, metadata, tx, txSigned;

                return _regenerator2.default.wrap(function _callee7$(_context7) {
                    while (1) {
                        switch (_context7.prev = _context7.next) {
                            case 0:
                                _transfer$to$match = transfer.to.match(/^g\.crypto\.bigchaindb\.(.+)/), _transfer$to$match2 = (0, _slicedToArray3.default)(_transfer$to$match, 2), localAddress = _transfer$to$match2[1];
                                amount = transfer.amount; // eslint-disable-line prefer-destructuring
                                // TODO: is there a better way to do note to self?

                                this._notesToSelf[transfer.id] = JSON.parse(JSON.stringify(transfer.noteToSelf));

                                console.log('sending', amount.toString(), 'to', localAddress, 'condition', transfer.executionCondition);

                                _context7.next = 6;
                                return this._getUnspentTransactions();

                            case 6:
                                unspentTransactions = _context7.sent;


                                (0, _assert2.default)(unspentTransactions.length > 0);
                                inputTransaction = unspentTransactions[0];
                                inputAmount = inputTransaction.outputs[0].amount;
                                subconditionExecute = driver.Transaction.makeEd25519Condition(this._keyPair.publicKey, false); // eslint-disable-line max-len
				console.log('\n\nexecute condition',JSON.stringify(subconditionExecute)+'\n');
                                
 				subconditionExecute1 = driver.Transaction.makeEd25519Condition(this._keyPair.publicKey, false); // eslint-disable-line max-len
				console.log('\n\nexecute condition1',JSON.stringify(subconditionExecute1)+'\n');

                                subconditionAbort = driver.Transaction.makeEd25519Condition(localAddress, false);
				console.log('\nabort condition',JSON.stringify(subconditionAbort)+'\n\n');

                                condition = driver.Transaction.makeThresholdCondition(1, [subconditionExecute, subconditionAbort]);
                                output = driver.Transaction.makeOutput(condition, amount.toString());

                                output.public_keys = [this._keyPair.publicKey, localAddress];

                                conditionChange = driver.Transaction.makeEd25519Condition(this._keyPair.publicKey);
                                outputs = [output];
                                changeAmount = parseInt(inputAmount, 10) - amount;

                                if (changeAmount > 0) {
                                    outputs.push(driver.Transaction.makeOutput(conditionChange, changeAmount.toString()));
                                }

                                metadata = {
                                    type: {
                                        'ilp:escrow': {
                                            id: transfer.id,
                                            ilp: transfer.ilp,
                                            noteToSelf: transfer.noteToSelf,
                                            executionCondition: transfer.executionCondition,
                                            expiresAt: transfer.expiresAt,
                                            custom: transfer.custom
                                        }
                                    }
                                };
                                tx = driver.Transaction.makeTransferTransaction([{tx: inputTransaction, output_index: 0}], outputs, metadata);
                                txSigned = driver.Transaction.signTransaction(tx, this._keyPair.privateKey);

				console.log('sendtransfer: before signing transactoin', JSON.stringify(tx));
                                console.log('sendtransfer: signing and submitting transaction', JSON.stringify(txSigned));
                                console.log('transaction id of', transfer.id, 'is', txSigned.id);

                                _context7.next = 26;
                                return this._conn.postTransactionCommit(txSigned).then(function (res) {
                                    console.log('Response from BDB server', res);
                                    return _this4._conn.getTransaction(txSigned.id);
                                    //return _this4._conn.pollStatusAndFetchTransaction(txSigned.id);
                                });

                            case 26:
                                console.log('completed transaction');
                                console.log('setting up expiry');
                                // this._setupExpiry(transfer.id, transfer.expiresAt)

                            case 28:
                            case 'end':
                                return _context7.stop();
                        }
                    }
                }, _callee7, this);
            }));

            function sendTransfer(_x3) {
                return _ref7.apply(this, arguments);
            }

            return sendTransfer;
        }()
    }, {
        key: 'fulfillCondition',
        value: function () {
            var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(transferId, fulfillment) {
                var _this5 = this;

                var cached, _keyPair, publicKey, privateKey, outputCondition, output, metadata, tx, txSigned, txFulfillment, sourceKey, abortCondition, executeFulfillment, tx_str;

                return _regenerator2.default.wrap(function _callee8$(_context8) {
                    while (1) {
                        switch (_context8.prev = _context8.next) {
                            case 0:
                                (0, _assert2.default)(this._connected, 'plugin must be connected before fulfillCondition');
                                console.log('preparing to fulfill condition', transferId);

                                cached = this._transfers[transferId];

                                if (cached) {
                                    _context8.next = 5;
                                    break;
                                }

                                throw new Error('no transfer with id ' + transferId);

                            case 5:

                                // const condition = crypto
                                //     .createHash('sha256')
                                //     .update(Buffer.from(fulfillment, 'base64'))
                                //     .digest()
                                //     .toString('base64')

                                _keyPair = this._keyPair, publicKey = _keyPair.publicKey, privateKey = _keyPair.privateKey;
                                outputCondition = driver.Transaction.makeEd25519Condition(publicKey);
                                output = driver.Transaction.makeOutput(outputCondition, cached.outputs[0].amount);
                                metadata = {
                                    type: {
                                        'ilp:fulfill': {
                                            id: (0, _v2.default)(),
                                            fulfillment: fulfillment
                                        }
                                    }
                                };
                                tx = driver.Transaction.makeTransferTransaction([{tx: cached, output_index: 0}], [output], metadata);
                                sourceKey = getSource(this, cached);
                                tx_str = driver.Transaction.serializeTransactionIntoCanonicalString(tx); 
                                var options = {
                                  mode: 'text',
                                  args: [ tx_str, privateKey, sourceKey, publicKey]};
                                var bdbconn = this._conn;
                                pyShell.run('./test/tx.py', options, function (err, results) {
                                  if (err) throw err;
                                  // results is an array consisting of messages collected during execution
                                  console.log('results: %j', results[0]);
                                  tx.inputs[0].fulfillment = results[0];
                                  var id = sha256Hash( driver.Transaction.serializeTransactionIntoCanonicalString(tx));
                                  console.log('id = ',id);
                                  tx.id = id;
                                  // TODO: add fulfillment to threshold (2-2 [fulfillment, 1-2 [execute, abort])
          
                                  _context8.next = 21;
                                  return bdbconn.postTransactionCommit(tx).then(function (res) {
                                      console.log('Response from BDB server', res);
                                      return bdbconn.getTransaction(tx.id);
                                      //return _this5._conn.pollStatusAndFetchTransaction(tx.id);
                                  });
                                });

                            case 21:

                                console.log('completed fulfill transaction');

                            case 22:
                            case 'end':
                                return _context8.stop();
                        }
                    }
                }, _callee8, this);
            }));

            function fulfillCondition(_x4, _x5) {
                return _ref8.apply(this, arguments);
            }

            return fulfillCondition;
        }()
    }, {
        key: '_setupExpiry',
        value: function _setupExpiry(transferId, expiresAt) {
            var that = this;
            // TODO: this is a bit of an unsafe hack, but if the time is not adjusted
            // like this, the cancel transaction fails.
            var delay = new Date(expiresAt) - new Date() + 5000;

            setTimeout(that._expireTransfer.bind(that, transferId), delay);
        }

        // async _expireTransfer(transferId) {
        //     if (this._transfers[transferId].Done) return
        //     debug('preparing to cancel transfer at', new Date().toISOString())
        //
        //     // make sure that the promise rejection is handled no matter
        //     // which step it happens during.
        //     try {
        //         const cached = this._transfers[transferId]
        //         const tx = await this._api.prepareEscrowCancellation(this._address, {
        //             owner: cached.Account,
        //             escrowSequence: cached.Sequence
        //         })
        //
        //         const signed = this._api.sign(tx.txJSON, this._secret)
        //         debug(`signing and submitting transaction: ${tx.txJSON}`)
        //         debug('cancel tx id of', transferId, 'is', signed.id)
        //
        //         await Submitter.submit(this._api, signed)
        //         debug('completed cancel transaction')
        //     } catch (e) {
        //         debug('CANCELLATION FAILURE! error was:', e.message)
        //
        //         // just retry if it was a ledger thing
        //         // TODO: is there any other scenario to retry under?
        //         if (e.name !== 'NotAcceptedError') return
        //
        //         debug(`CANCELLATION FAILURE! (${transferId}) retrying...`)
        //         await this._expireTransfer(transferId)
        //     }
        // }

    }, {
        key: '_handleTransaction',
        value: function () {
            var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(changes) {
                var transaction, direction, transfer, fulfillment;
                return _regenerator2.default.wrap(function _callee9$(_context9) {
                    while (1) {
                        switch (_context9.prev = _context9.next) {
                            case 0:
                                _context9.next = 2;
                                return this._conn.getTransaction(changes.transaction_id);

                            case 2:
                                transaction = _context9.sent;
                                direction = getDirection(this, transaction);


                                if (transaction) {
                                    transfer = transactionToTransfer(this, transaction);

                                    this._transfers[transfer.id] = transaction;
                                    console.log('received', transaction.metadata.type);
                                    if (transaction.metadata.type.hasOwnProperty('ilp:escrow')) {
                                        console.log('handle', transaction.id, direction + '_prepare', this._keyPair.publicKey);
                                        this.emitAsync(direction + '_prepare', transfer, transaction);
                                    } else if (transaction.metadata.type.hasOwnProperty('ilp:fulfill')) {
                                        fulfillment = transaction.metadata.type['ilp:fulfill'].fulfillment; // eslint-disable-line prefer-destructuring

                                        console.log('handle', transaction.id, direction + '_fulfill', this._keyPair.publicKey);
                                        this.emitAsync(direction + '_fulfill', transfer, fulfillment);
                                    } else if (transaction.metadata.type.hasOwnProperty('ilp:cancel')) {
                                        console.log('handle', transaction.id, direction + '_cancel', this._keyPair.publicKey);
                                        this.emitAsync(direction + '_cancel', transfer);
                                    }
                                }
                                // } else if (transaction.TransactionType === 'Payment') {
                                //   const message = Translate.paymentToMessage(this, ev)
                                //   this.emitAsync(message.direction + '_message', message)
                                // }

                            case 5:
                            case 'end':
                                return _context9.stop();
                        }
                    }
                }, _callee9, this);
            }));

            function _handleTransaction(_x6) {
                return _ref9.apply(this, arguments);
            }

            return _handleTransaction;
        }()
    }]);
    return BigchainDBLedgerPlugin;
}(_eventemitter2.default); // eslint-disable-line import/no-namespace
// import crypto from 'crypto'


exports.default = BigchainDBLedgerPlugin;


function transactionToTransfer(plugin, transaction) {
    //var metadata = transaction.metadata.type['ilp:escrow'] || transaction.metadata.type['ilp:fulfill'] || transaction.metadata.type['ilp:coin'];
    return {
        //id: metadata.id,
        id: transaction.id,
        to: plugin._prefix + getDestination(plugin, transaction),
        from: plugin._prefix + getSource(plugin, transaction),
        direction: getDirection(plugin, transaction),
        ledger: plugin._prefix,
        amount: getAmount(plugin, transaction),
        //ilp: metadata.ilp,
        ilp: transaction.metadata.ilp,
        //executionCondition: metadata.executionCondition,
        executionCondition: transaction.inputs[0].fulfillment,
        noteToSelf: transaction.metadata.noteToSelf,
        expiresAt: transaction.metadata.expiresAt
    };
}

function getDirection(plugin, transaction) {
    var publicKey = plugin._keyPair.publicKey;

    var metadata = transaction.metadata.type;
    if (metadata.hasOwnProperty('ilp:escrow')) {
        if (transaction.inputs[0].owners_before.indexOf(publicKey) > -1) {
            return 'outgoing';
        }
        if (transaction.outputs[0].public_keys.indexOf(publicKey) > -1) {
            return 'incoming';
        }
    } else {
        if (transaction.outputs[0].public_keys.indexOf(publicKey) > -1) {
            return 'incoming';
        }
        if (transaction.inputs[0].owners_before.indexOf(publicKey) > -1) {
            return 'outgoing';
        }
    }
    return null;
}

function getSource(plugin, transaction) {
    // TODO: include all inputs
    var inputKeys = transaction.inputs[0].owners_before;
    return inputKeys[0];
}

function getDestination(plugin, transaction) {
    // TODO: include all outputs
    var outputKeys = transaction.outputs[0].public_keys;
    var publicKey = plugin._keyPair.publicKey;

    return _selectPublicKey(outputKeys, publicKey);
}

function _selectPublicKey(keyList, keyBlackList) {
    (0, _assert2.default)(keyList.length <= 2);
    if (keyList.length === 1) {
        return keyList[0];
    }
    if (keyList.length > 1) {
        var selectedKeys = keyList.filter(function (outputKey) {
            return outputKey !== keyBlackList;
        });
        (0, _assert2.default)(selectedKeys.length > 0);
        return selectedKeys[0];
    }
    return null;
}

function getAmount(plugin, transaction) {
    var publicKey = plugin._keyPair.publicKey;

    return transaction.outputs.filter(function (output) {
        return output.public_keys.indexOf(publicKey) === 0;
    }).map(function (output) {
        return parseInt(output.amount, 10);
    }).reduce(function (prevVal, elem) {
        return prevVal + elem;
    }, 0);
}
module.exports = exports['default'];
