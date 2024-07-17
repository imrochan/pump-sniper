import pkg from '@solana/web3.js';

import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';

import { sendAndConfirmTransactionWrapper, bufferFromUInt64 } from './utils.js';

const {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} =  pkg

// Define constants
const GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FUN_ACCOUNT = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
const SYSTEM_PROGRAM = SystemProgram.programId;
const RENT = SYSVAR_RENT_PUBKEY;

export async function buy(mintStr, solIn = 0.01, slippageDecimal = 0.5, coinData, payer, connection, virtualSolReserves, virtualTokenReserves, MINT, BONDING_CURVE, ASSOCIATED_BONDING_CURVE, instructions) {
  try {
    const owner = payer.publicKey;
    const mint = new PublicKey(mintStr);
    let tokenAccount;
    let tokenAccountInstructions = null;

    // Attempt to retrieve token account, otherwise create associated token account
    /*try {
      const accountData = await connection.getTokenAccountsByOwner(owner, { mint });
      tokenAccount = accountData.value[0].pubkey;
    } catch {

    }*/
    tokenAccount = await getAssociatedTokenAddress(mint, owner);
    tokenAccountInstructions = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      tokenAccount,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const solInLamports = solIn * LAMPORTS_PER_SOL;
    const tokenOut = Math.floor((solInLamports * virtualTokenReserves) / virtualSolReserves);

    // Calculate max_sol_cost and amount
    const solInWithSlippage = solIn * (1 + slippageDecimal);
    const maxSolCost = Math.floor(solInWithSlippage * LAMPORTS_PER_SOL);

    // Define account keys required for the swap
    const ASSOCIATED_USER = tokenAccount;
    const USER = owner;

    // Build account key list
    const keys = [
      { pubkey: GLOBAL, isSigner: false, isWritable: false },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: BONDING_CURVE, isSigner: false, isWritable: true },
      { pubkey: ASSOCIATED_BONDING_CURVE, isSigner: false, isWritable: true },
      { pubkey: ASSOCIATED_USER, isSigner: false, isWritable: true },
      { pubkey: USER, isSigner: true, isWritable: true },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
    ];

    // Define integer values
    const buy = 16927863322537952870n;
    const integers = [buy, tokenOut, maxSolCost];

    // Pack integers into binary segments
    const dataBuffer = Buffer.concat(integers.map(bufferFromUInt64));

    const swapInstruction = new TransactionInstruction({
      keys,
      programId: PUMP_FUN_PROGRAM,
      data: dataBuffer,
    });

    // Create transaction instructions
    console.log("[-] Sending transaction...");
    if (tokenAccountInstructions) {
      instructions.push(tokenAccountInstructions);
    }
    instructions.push(swapInstruction);

    // Create and send transaction
    const transaction = new Transaction().add(...instructions);
    const signature = await sendAndConfirmTransactionWrapper(connection, transaction, [payer]);

    console.log(`\tHash: ${signature}`);
    return signature;
  } catch (error) {
    console.error(`[X] Error buying ${mintStr}`, error);
    return false;
  }
}