import pkg from '@solana/web3.js';

const { TransactionSignature, ComputeBudgetProgram, LAMPORTS_PER_SOL, Keypair, Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, SystemProgram } = pkg;
import bs58 from 'bs58';
import { sha256 } from '@noble/hashes/sha256';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import fetch from 'node-fetch';
import { Buffer } from 'buffer';

export async function getKeyPairFromPrivateKey(key) {
  return Keypair.fromSecretKey(
    new Uint8Array(bs58.decode(key))
  );
}

export async function createTransaction(connection, instructions, payer) {
  const transaction = new Transaction().add(...instructions);
  transaction.feePayer = payer;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return transaction;
}

export async function sendAndConfirmTransactionWrapper(connection, transaction, signers) {
  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, signers, { skipPreflight: true });
    console.log('Transaction confirmed with signature:', signature);
    return signature;
  } catch (error) {
    console.error('Error sending transaction:', error);
    return null;
  }
}

export function bufferFromUInt64(value) {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

export function generatePubKey({ fromPublicKey, programId = TOKEN_PROGRAM_ID }) {
  const seed = Keypair.generate().publicKey.toBase58().slice(0, 32);
  const publicKey = createWithSeed(fromPublicKey, seed, programId);
  return { publicKey, seed };
}

export function createWithSeed(fromPublicKey, seed, programId) {
  const buffer = Buffer.concat([fromPublicKey.toBuffer(), Buffer.from(seed), programId.toBuffer()]);
  const publicKeyBytes = sha256(buffer);
  return new PublicKey(publicKeyBytes);
}

export function bufferFromString(value) {
  const buffer = Buffer.alloc(4 + value.length);
  buffer.writeUInt32LE(value.length, 0);
  buffer.write(value, 4);
  return buffer;
}

//-------------------------------------------------

function findData(data, field) {
  if (typeof data === 'object') {
    if (data[field] !== undefined) {
      return data[field];
    } else {
      for (const key in data) {
        const result = findData(data[key], field);
        if (result !== undefined) {
          return result;
        }
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data) {
      const result = findData(item, field);
      if (result !== undefined) {
        return result;
      }
    }
  }
  return undefined;
}

async function getTokenBalance(baseMint) {
  try {
    const payload = {
      id: 1,
      jsonrpc: '2.0',
      method: 'getTokenAccountsByOwner',
      params: [
        PUB_KEY,
        { mint: baseMint },
        { encoding: 'jsonParsed' },
      ],
    };

    const response = await fetch(RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    const uiAmount = findData(responseData, 'uiAmount');
    return parseFloat(uiAmount);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getCoinData(mintStr) {
  const url = `https://client-api-2-74b1891ee9f9.herokuapp.com/coins/${mintStr}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.pump.fun/',
    'Origin': 'https://www.pump.fun',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'If-None-Match': 'W/"43a-tWaCcS4XujSi30IFlxDCJYxkMKg"',
  };

  const response = await fetch(url, { headers });
  if (response.ok) {
    return response.json();
  } else {
    console.error(`Failed to fetch coin data: ${response.statusText}`);
    return null;
  }
}

export async function confirmTxn(txnSig, maxRetries = 10, retryInterval = 2000, client) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const txnRes = await client.getTransaction(txnSig, {
        encoding: 'json',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (txnRes && txnRes.meta && txnRes.meta.err === null) {
        console.log(`Transaction confirmed... try count: ${retries + 1}`);
        return true;
      }

      console.log('Error: Transaction not confirmed. Retrying...');
      if (txnRes && txnRes.meta && txnRes.meta.err) {
        console.log('Transaction failed.');
        return false;
      }
    } catch (error) {
      console.log(`Awaiting confirmation... try count: ${retries + 1}`);
    }

    retries += 1;
    await new Promise(resolve => setTimeout(resolve, retryInterval));
  }

  return false;
}




