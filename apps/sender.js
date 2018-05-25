const crypto = require('crypto')
var pyShell = require('python-shell')
const moment = require('moment')
const uuid = require('uuid/v4')
const preimage = 'abcd1234';
const l1user = {
          privateKey: 'g5VTXVJG2dhnhh4DdqCSDLCdyWYRwZidDVpGMfWcBtR',
          publicKey: '3EnoLUQ6t8YqugQbHZyN7h4ivMYT412uzpbECXgqsyqS'
      }

const l1escrow = {
          privateKey: 'EnkodmZ8Gcj8CaS66kr9dBbaDRWw5D7uC1qEg5tSTpRo',
          publicKey: 'CLqzCtvFpcN5xmropzfrQgENYZMwjHB32C42YdNgZ9Xg'
      }

const driver = require('bigchaindb-driver/dist/node')
const BigchainDBLedgerPlugin = require('../cjs/lib/bigchaindb_ledger_plugin')

const BDB_SERVER_URL = process.env.BDB_SERVER_URL || 'http://192.168.56.101:9984'
const BDB_WS_URL = process.env.BDB_WS_URL || 'ws://192.168.56.101:9985'

const BDB_SERVER_API = `${BDB_SERVER_URL}/api/v1/`
const BDB_WS_API = `${BDB_WS_URL}/api/v1/streams/valid_transactions`

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


const conn = new driver.Connection(BDB_SERVER_API)
const txInitialCoins = driver.Transaction.makeCreateTransaction(
    {'data':{'currency' : 'ABC', 'company' : 'ABC Limited'}},
    { type: 'ilp:coin', timestamp: moment().format('X') },
    [
        driver.Transaction.makeOutput(
            driver.Transaction.makeEd25519Condition(l1user.publicKey),
            '100')],
    l1user.publicKey
)
// sign, post and poll status
const txInitialCoinsSigned =
    driver.Transaction.signTransaction(txInitialCoins, l1user.privateKey)

console.log('\nsinged txn= ', JSON.stringify(txInitialCoinsSigned) + '\n'); 



function createTransfer(sender, receiver, amt, condition, assetid){
  const transfer = {
      id: uuid(),
      from: sender.getAccount(),
      to: receiver.getAccount(),
      ledger: sender.getInfo().prefix,
      amount: amt,
      ilp: 'blah',
      noteToSelf: {
          'transfer': 'coins transfer'
      },
      executionCondition: condition,
      expiresAt: moment().add(5, 'seconds').toISOString(),
      custom: {
          'asset_id': assetid
      }
  }
  return transfer;
}

async function sender(){
await conn
    .postTransactionCommit(txInitialCoinsSigned)
    .then((res) => {
        console.log('Response from BDB server', res)
        return conn.getTransaction(txInitialCoinsSigned.id)
    })
  const l1plugin = new BigchainDBLedgerPlugin({
      server: BDB_SERVER_API,
      ws: BDB_WS_API,
      keyPair: l1user
  });
  
  const l1escrowplugin = new BigchainDBLedgerPlugin({
      server: BDB_SERVER_API,
      ws: BDB_WS_API,
      keyPair: l1escrow
  });

  
  await l1plugin.connect();
  await l1escrowplugin.connect();

  console.log('l1user balance = ', await l1plugin.getBalance());  
  console.log('l1escrow balance = ', await l1escrowplugin.getBalance());  
  
  transfer = createTransfer(l1plugin, l1escrowplugin, 1, condition, txInitialCoinsSigned.id);
  console.log('transfer = ', JSON.stringify(transfer));
  
  const transferFulfillment = new Promise((resolve, reject) => {
    l1plugin.once('outgoing_fulfill', async(transfer) => {
      console.log('transfer is successful');
      resolve();
    }); 
    l1plugin.once('outgoing_reject', async(transfer) => {
      console.log('transfer rejected');
      reject();
    });
  });
  await l1plugin.sendTransfer(transfer);
}

sender().catch(err => console.log('error occured', err)); 
