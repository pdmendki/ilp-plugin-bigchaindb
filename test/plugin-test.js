const crypto = require('crypto')
const moment = require('moment')
const uuid = require('uuid/v4')
var pyShell = require('python-shell')

const driver = require('bigchaindb-driver/dist/node')
const BigchainDBLedgerPlugin = require('../cjs/lib/bigchaindb_ledger_plugin')

const BDB_SERVER_URL = process.env.BDB_SERVER_URL || 'http://192.168.56.101:9984'
const BDB_SERVER_URL1 = process.env.BDB_SERVER_URL1 || 'http://192.168.56.102:9984'
const BDB_WS_URL = process.env.BDB_WS_URL || 'ws://192.168.56.101:9985'
const BDB_WS_URL1 = process.env.BDB_WS_URL1 || 'ws://192.168.56.102:9985'
// const BDB_SERVER_URL = process.env.BDB_SERVER_URL || 'http://35.157.131.84:9984';
// const BDB_WS_URL = process.env.BDB_WS_URL || 'ws://35.157.131.84:9985';

const BDB_SERVER_API = `${BDB_SERVER_URL}/api/v1/`
const BDB_WS_API = `${BDB_WS_URL}/api/v1/streams/valid_transactions`
const BDB_SERVER_API1 = `${BDB_SERVER_URL1}/api/v1/`
const BDB_WS_API1 = `${BDB_WS_URL1}/api/v1/streams/valid_transactions`

console.log(BDB_SERVER_API, BDB_WS_API)

const conn = new driver.Connection(BDB_SERVER_API)

function hash(fulfillment) {
    const h = crypto.createHash('sha256')
    h.update(Buffer.from(fulfillment, 'base64'))
    return h.digest()
}

const fulfillment = crypto.randomBytes(32).toString('base64')
const condition = hash(fulfillment).toString('base64')
console.log('condition: ', condition, 'fulfillment:', fulfillment)


async function runTest() {
    const sender = new BigchainDBLedgerPlugin({
        server: BDB_SERVER_API,
        ws: BDB_WS_API,
        keyPair: {
            privateKey: '9nJH9TBF3fPjwZkUsEgJz69a29VF3RpNYtbfHWDsiP8u',
            publicKey: 'GkJzDcLww3oWfkdUs8YiidcCfgVyaojzD92edSgC7jdd'
        }
    })

    const receiver = new BigchainDBLedgerPlugin({
        server: BDB_SERVER_API,
        ws: BDB_WS_API,
        keyPair: {
            privateKey: '5577iMWysNrQ5JoEyZzEx616gyQ7o1Kb4zLX9utjXpNY',
            publicKey: 'EdahU6x6CVsrPL9kCxh5TooDDJGwb3x3s28hiGpo9unj'
        }
    })
    
    console.log('sender connected? ', sender.isConnected())
    console.log('receiver connected? ', receiver.isConnected())

    await sender.connect()
    console.log('sender connected? ', sender.isConnected())
    console.log('sender info? ', sender.getInfo())
    console.log('sender account? ', sender.getAccount())
    console.log('sender balance? ', await sender.getBalance())

    await receiver.connect()
    console.log('receiver connected? ', receiver.isConnected())
    console.log('receiver info? ', receiver.getInfo())
    console.log('receiver account? ', receiver.getAccount())
    console.log('receiver balance? ', await receiver.getBalance())

    const txInitialCoins = driver.Transaction.makeCreateTransaction(
        null,
        { type: 'ilp:coin', timestamp: moment().format('X') },
        [
            driver.Transaction.makeOutput(
                driver.Transaction.makeEd25519Condition(sender._keyPair.publicKey),
                '1')],
        sender._keyPair.publicKey
    )

    // sign, post and poll status
    const txInitialCoinsSigned =
        driver.Transaction.signTransaction(txInitialCoins, sender._keyPair.privateKey)

    console.log('singed txn= ',txInitialCoinsSigned); 

    await conn
        .postTransactionCommit(txInitialCoinsSigned)
        .then((res) => {
            console.log('Response from BDB server', res)
            return conn.getTransaction(txInitialCoinsSigned.id)
        })



    const transfer = {
        id: uuid(),
        from: sender.getAccount(),
        to: receiver.getAccount(),
        ledger: sender.getInfo().prefix,
        amount: 1,
        ilp: 'blah',
        noteToSelf: {
            'just': 'some stuff'
        },
        executionCondition: condition,
        expiresAt: moment().add(5, 'seconds').toISOString(),
        custom: {
            'other': 'thing'
        }
    }


    const receiverFulfilledPromise = new Promise((resolve, reject) => {
        receiver.once('incoming_prepare', async (transfer) => {
            console.log('receiver got incoming prepare notification', transfer)
            console.log(
                `sender balance is: ${await sender.getBalance()}, 
                 receiver balance is: ${await receiver.getBalance()}`
            )

            console.log('receiver fulfilling first transfer')
            try {
                await receiver.fulfillCondition(transfer.id, fulfillment)
            } catch (err) {
                console.log('error submitting fulfillment', err)
                reject(err)
            }

            console.log(
                `sender balance is: ${await sender.getBalance()},
                 receiver balance is: ${await receiver.getBalance()}`
            )
            resolve()
        })
    })

    await sender.sendTransfer(transfer)
    await receiverFulfilledPromise

    // It will detect if you try to submit a duplicate transaction
    console.log('attempting to send duplicate transfer')
    try {
        const transfer2 = await sender.sendTransfer(transfer)
    } catch (e) {
        console.log('avoided submitting duplicate transfer')
    }
    console.log(
        `sender balance is: ${await sender.getBalance()},
         receiver balance is: ${await receiver.getBalance()}`
    )

    console.log('sending a transfer that will not be fulfilled')
    const otherTransfer = await sender.sendTransfer(Object.assign({}, transfer, {
        id: uuid()
    }))
    console.log(
        `sender balance is: ${await sender.getBalance()},
         receiver balance is: ${await receiver.getBalance()}`
    )
    const timedOutPromise = new Promise((resolve) => {
        sender.once('outgoing_reject', (transfer, rejectionMessage) => {
            console.log('sender got outgoing_reject notification with message:', rejectionMessage)
            resolve()
        })
    })
    await timedOutPromise
    console.log(
        `sender balance is: ${await sender.getBalance()},
         receiver balance is: ${await receiver.getBalance()}`
    )

    console.log('sending a transfer the receiver will reject')
    const transferToReject = await sender.sendTransfer(Object.assign({}, transfer, {
        id: uuid(),
        expiresAt: moment().add(10, 'seconds').toISOString()
    }))

    receiver.once('incoming_prepare', (transfer) => {
        console.log('receiver got prepared notification, now rejecting transfer')
        receiver.rejectIncomingTransfer(transfer.id, {
            code: 'F06',
            name: 'Unexpected Payment',
            message: 'did not like it',
            triggeredBy: receiver.getAccount(),
            triggeredAt: moment().toISOString()
        })
    })

    const rejectedPromise = new Promise((resolve) => {
        sender.once('outgoing_reject', (transfer, rejectionMessage) => {
            console.log('sender got outgoing_reject notification with message:', rejectionMessage)
            resolve()
        })
    })
    await rejectedPromise
    console.log(
        `sender balance is: ${await sender.getBalance()},
         receiver balance is: ${await receiver.getBalance()}`
    )

    console.log('plugins can also send messages to one another')
    const messagePromise = new Promise((resolve) => {
        receiver.once('incoming_message', (message) => {
            console.log('receiver got message', message)
            resolve()
        })
    })
    await sender.sendMessage({
        to: receiver.getAccount(),
        data: {
            foo: 'bar'
        }
    })
    await messagePromise

    await sender.disconnect()
    await receiver.disconnect()
    console.log('disconnected plugins')
    process.exit()
}

runTest().catch(err => console.log('died', err))
