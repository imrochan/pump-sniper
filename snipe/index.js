import { getCoinData } from './utils/utils.js';

import { launchInfo } from '../sniperInfo.js';
import { buy } from './utils/buy.js';
import pkg from '@solana/web3.js';
import bs58 from 'bs58';

const {
  PublicKey,
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  TransactionInstruction,
  AccountMeta,
  SYSVAR_RENT_PUBKEY
} = pkg

const POLLING_INTERVAL = 850; 

export default async function snipe(tokenId, connection) {
  try {
    while (true) {
      const coinData = await getCoinData(tokenId);

      console.log('[Coin Data -> ', coinData);

      if (coinData) {
        const virtualSolReserves = coinData.virtual_sol_reserves;
        const virtualTokenReserves = coinData.virtual_token_reserves;
        const MINT = new PublicKey(coinData.mint);
        const BONDING_CURVE = new PublicKey(coinData.bonding_curve);
        const ASSOCIATED_BONDING_CURVE = new PublicKey(coinData.associated_bonding_curve);
  
        let c1 = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 9333333 })
        let c2 = ComputeBudgetProgram.setComputeUnitLimit({ units: 69900 })
  
        const buyPromises = launchInfo.snipers.map(sniper => {
          const payer = Keypair.fromSecretKey(bs58.decode(sniper.privateKey));
          const solIn = sniper.buyAmount;
  
          const instructions = [];
          instructions.push(c1);
          instructions.push(c2);
  
          return buy(tokenId, solIn, 0.8, coinData, payer, connection, virtualSolReserves, virtualTokenReserves, MINT, BONDING_CURVE, ASSOCIATED_BONDING_CURVE, instructions)
            .then(signature => {
              console.log(`Sniper ${sniper.nameTag} successfully bought token. Transaction hash: ${signature}`);
            })
            .catch(error => {
              console.error(`Error buying token with sniper ${sniper.nameTag}:`, error);
            });
        });
  
        await Promise.all(buyPromises);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
  } catch (e) {
    console.log('error @ sniper -> ', e);
  }
};
