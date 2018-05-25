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

function getSignedTxn( tx, user){
  const txInitialCoins = driver.Transaction.makeCreateTransaction(
    {'data':{'currency' : 'XYZ', 'company' : 'XYZ Limited'}},
    { type: 'ilp:coin', timestamp: moment().format('X') },
    [
        driver.Transaction.makeOutput(
            driver.Transaction.makeEd25519Condition(user.publicKey),
            '100')],
    user.publicKey
  )
  // sign, post and poll status
  const txInitialCoinsSigned =
    driver.Transaction.signTransaction(txInitialCoins, user.privateKey)

  console.log('\nsinged txn= ', JSON.stringify(txInitialCoinsSigned) + '\n'); 
  return txInitialCoinsSigned;
}

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

async function run(){
  const l1escrowplugin = new BigchainDBLedgerPlugin({
      server: BDB_SERVER_API,
      ws: BDB_WS_API,
      keyPair: l1escrow
  });

  
  const l2escrowplugin = new BigchainDBLedgerPlugin({
      server: BDB_SERVER_API2,
      ws: BDB_WS_API2,
      keyPair: l2escrow
  });

  const l2userplugin = new BigchainDBLedgerPlugin({
      server: BDB_SERVER_API2,
      ws: BDB_WS_API2,
      keyPair: l2user
  });

  await l1escrowplugin.connect();
  await l2escrowplugin.connect();
  await l2userplugin.connect();
  console.log('l1escrow balance = ', await l1escrowplugin.getBalance());  
  console.log('l2escrow balance = ', await l2escrowplugin.getBalance());  
  var id;
  const receiverFulfilledPromise = new Promise((resolve, reject) => {
    l1escrowplugin.on('incoming_prepare', async (transfer) => {
      id = transfer.id;
      //console.log('\nreceiver got incoming prepare notification', JSON.stringify(transfer));
      //console.log('l1escrow balance = ', await l1escrowplugin.getBalance());  
      //create txn in l2
      //console.log('\ntransfer = ', JSON.stringify(transfer));
      //let l1txId = transfer.custom.asset_id;
      //let tx = await conn1.getTransaction(l1txId);
      let l2tx = getSignedTxn({}, l2escrow);
      await conn2.postTransactionCommit(l2tx);
      //console.log('\nl1escrow balance = ', await l1escrowplugin.getBalance());  
      //console.log('\nl2escrow balance = ', await l2escrowplugin.getBalance());  
      //subscribe to incoming_fulfill
      //prepare to transfer to user in l2
      l2transfer = createTransfer(l2escrowplugin, l2userplugin, '10', condition, l2tx.id);
      
      console.log('\nl1escrow balance after send transfer = ', await l1escrowplugin.getBalance());  
      console.log('\nl2escrow balance after send transfer = ', await l2escrowplugin.getBalance());  
       
      await l2escrowplugin.sendTransfer(l2transfer);
    })
        l2escrowplugin.on('outgoing_fulfill', async(l2transfer) => {
          //on fulfillment, fulfill the first txn
          try{
            console.log('\nfulfilling first tx');
            await l1escrowplugin.fulfillCondition(id, fulfillment);
            console.log('\nl1escrow balance after fulfillment = ', await l1escrowplugin.getBalance());  
            resolve();
          } catch(err){
            console.log('fulfillment error', err);
            reject(err);
          }
        });
  })
  await receiverFulfilledPromise;
}
run();
