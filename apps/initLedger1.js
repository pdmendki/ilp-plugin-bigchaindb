const crypto = require('crypto')
var pyShell = require('python-shell')
const moment = require('moment')
const uuid = require('uuid/v4')

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

const conn = new driver.Connection(BDB_SERVER_API)

async function createAsset (user,amount){
  const assetdata = {'data': {'coins': 'ABC'}};
  const metadata = { 'company' : 'ABC Limited', timestamp: moment().format('X')};
  const txInitialCoins = driver.Transaction.makeCreateTransaction(
      assetdata,
      metadata,
      //{ type: 'ilp:coin', timestamp: moment().format('X') },
      [
          driver.Transaction.makeOutput(
              driver.Transaction.makeEd25519Condition(user.publicKey),
              amount)],
      user.publicKey
  );

  // sign, post and poll status
  const txInitialCoinsSigned =
      driver.Transaction.signTransaction(txInitialCoins, user.privateKey);

  console.log('singed txn= ',txInitialCoinsSigned); 

  await conn
      .postTransactionCommit(txInitialCoinsSigned)
      .then((res) => {
          console.log('Response from BDB server', res)
          return conn.getTransaction(txInitialCoinsSigned.id)
      });
}

async function run() {
  await createAsset(l1user,'100');
  await createAsset(l1escrow, '100');
}

run(); 
