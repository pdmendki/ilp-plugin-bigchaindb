const crypto = require('crypto')
var pyShell = require('python-shell')
const moment = require('moment')
const uuid = require('uuid/v4')
const preimage = 'abcd1234';

const l2escrow = {
          privateKey: '6sqXtrzmWz1uRhkViQW48q4E2uc4deeuVjFHnfuCt5i7',
          publicKey: '4MBvQUxu5E4iLHk51xPaV3kFJR1qy5g2cKhCR7DnRqkY'
      }

const l2user = {
          privateKey: '9BzFRqKY8o3d47FAePBS8L45Pr31MLiWVkroR1mcsdMG',
          publicKey: '5diYDd8RN3Ho9VShCoUm9TiXbDxQofXYM4U2GxGc2a3W'
      }

const driver = require('bigchaindb-driver/dist/node')
const BigchainDBLedgerPlugin = require('../cjs/lib/bigchaindb_ledger_plugin')

const BDB_SERVER_URL = process.env.BDB_SERVER_URL || 'http://192.168.56.101:9984'
const BDB_WS_URL = process.env.BDB_WS_URL || 'ws://192.168.56.101:9985'

const BDB_SERVER_API = `${BDB_SERVER_URL}/api/v1/`
const BDB_WS_API = `${BDB_WS_URL}/api/v1/streams/valid_transactions`

const BDB_SERVER_URL2 = process.env.BDB_SERVER_URL2 || 'http://192.168.56.102:9984'
const BDB_WS_URL2 = process.env.BDB_WS_URL2 || 'ws://192.168.56.102:9985'

const BDB_SERVER_API2 = `${BDB_SERVER_URL2}/api/v1/`
const BDB_WS_API2 = `${BDB_WS_URL2}/api/v1/streams/valid_transactions`

function hash(fulfillment) {
    const h = crypto.createHash('sha256')
    h.update(Buffer.from(fulfillment, 'base64'))
    return h.digest()
}

//const fulfillment = crypto.randomBytes(32).toString('base64')
let buff = new Buffer(preimage);
const fulfillment = buff.toString('base64')
const condition = hash(fulfillment).toString('base64')
console.log('condition: ', condition, 'fulfillment:', fulfillment)


const conn1 = new driver.Connection(BDB_SERVER_API)
const conn2 = new driver.Connection(BDB_SERVER_API2)

async function run(){
  const l2userplugin = new BigchainDBLedgerPlugin({
      server: BDB_SERVER_API2,
      ws: BDB_WS_API2,
      keyPair: l2user
  });

  await l2userplugin.connect();
  console.log('l2user balance = ', await l2userplugin.getBalance());  

  const receiverFulfilledPromise = new Promise((resolve, reject) => {
    l2userplugin.on('incoming_prepare', async (transfer) => {
      console.log('\nreceiver got incoming prepare notification', JSON.stringify(transfer));
        //on fulfillment, fulfill the first txn
        try{
          await l2userplugin.fulfillCondition(transfer.id, fulfillment);
          console.log('\nbalance after fulfillment = ', await l2userplugin.getBalance());  
        } catch(err){
          console.log('fulfillment error', err);
          reject(err);
        }
        resolve();
      });
      //console.log('\nl1escrow balance after send transfer = ', await l1escrowplugin.getBalance());  
      //console.log('\nl2escrow balance after send transfer = ', await l2escrowplugin.getBalance());  
      //console.log('l2user balance = ', await l2userplugin.getBalance());  
    })
  await receiverFulfilledPromise;
}
run();
