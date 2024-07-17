import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readlineSync from 'readline-sync';
import chalk from 'chalk';
import bs58 from 'bs58';
import FormData from 'form-data';
import web3, { SYSVAR_RENT_PUBKEY, Keypair, Transaction, LAMPORTS_PER_SOL, SystemProgram, Connection, PublicKey, ComputeBudgetProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddress } from '@solana/spl-token';

import { getKeyPairFromPrivateKey, sendAndConfirmTransactionWrapper, bufferFromUInt64, bufferFromString } from './utils/utils.js';

import { idl } from './idl.js';
import { launchInfo } from './sniperInfo.js';
import { vanityList } from './vanityList.js'
import snipe from './snipe/index.js';

import fetch from 'node-fetch';
import pkg from '@project-serum/anchor';
const { Program, AnchorProvider, Wallet } = pkg;

const artPiece = `
▄███████▄ ███    █▄    ▄▄▄▄███▄▄▄▄      ▄███████▄    ▄████████ ███    █▄   ▄████████    ▄█   ▄█▄ 
███    ███ ███    ███ ▄██▀▀▀███▀▀▀██▄   ███    ███   ███    ███ ███    ███ ███    █▀    ███ ▄███▀ 
███    ███ ███    ███ ███   ███   ███   ███    ███   ███    █▀  ███    ███ ███    █▀    ███▐██▀   
███    ███ ███    ███ ███   ███   ███   ███    ███  ▄███▄▄▄     ███    ███ ███         ▄█████▀    
▀█████████▀  ███    ███ ███   ███   ███ ▀█████████▀  ▀▀███▀▀▀     ███    ███ ███        ▀▀█████▄    
███        ███    ███ ███   ███   ███   ███          ███        ███    ███ ███    █▄    ███▐██▄   
███        ███    ███ ███   ███   ███   ███          ███        ███    ███ ████████▀    ███   ▀█▀ 
                                                                                        ▀       
`;

console.log(chalk.hex('#FF69B4')(artPiece));

const payer = await getKeyPairFromPrivateKey(process.env.PK);
const owner = payer.publicKey;

// ADD RPC CONNECTION
const connection = new Connection(process.env.RPC);

const wallet = new Wallet(payer);
const provider = new AnchorProvider(connection, wallet, {
  commitment: "finalized",
});

const GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const SYSTEM_PROGRAM = SystemProgram.programId;
const RENT = SYSVAR_RENT_PUBKEY;
const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_FUN_ACCOUNT = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1")
const MPL_TOKEN_METADATA = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const MINT_AUTHORITY = new PublicKey("TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM");
const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey("ComputeBudget111111111111111111111111111111");
const FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM')


const program = new Program(idl, PUMP_FUN_PROGRAM, provider);

async function createAndPurchasePumpFunToken({
  name,
  ticker,
  description,
  imageFilePath,
  twitterLink,
  telegramLink,
  websiteLink,
  devBuyAmount,
  connection
}) {
  try {
    console.log(chalk.cyan("Step 1: Validating inputs..."));
    if (name.length > 32) throw new Error("Name too long: it must be less than 32 characters");
    if (!name) throw new Error("No name provided");

    const resolvedImagePath = path.resolve(imageFilePath);
    if (!fs.existsSync(resolvedImagePath)) throw new Error("Image file does not exist");
    if (!ticker) throw new Error("No ticker provided");
    if (ticker.length > 10) throw new Error("Ticker must be less than 11 characters");
    if (description.length > 2000) throw new Error("Description too long");

    const imageFile = fs.readFileSync(resolvedImagePath);
    if (imageFile.size > 4.3 * 1024 * 1024) throw new Error("Image too large: it must be less than 4.3 megabytes");

    console.log(chalk.cyan("Step 2: Uploading metadata..."));
    const formData = new FormData();
    formData.append("file", imageFile, path.basename(resolvedImagePath));
    formData.append("name", name);
    formData.append("symbol", ticker);
    formData.append("description", description);
    formData.append("twitter", twitterLink);
    formData.append("telegram", telegramLink);
    formData.append("website", websiteLink);

    const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData
    });

    if (!metadataResponse.ok) {
      throw new Error(`Failed to upload metadata: ${metadataResponse.statusText}`);
    }

    const { metadataUri } = await metadataResponse.json();
    console.log(chalk.cyan("Metadata uploaded. URI: ", metadataUri));

    console.log(chalk.cyan("Step 3: Creating token..."));
    //const transaction = new Transaction();
    const transactionInstructions = [];
    let c1 = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 9999999  })
    let c2 = ComputeBudgetProgram.setComputeUnitLimit({ units: 900000 })

    transactionInstructions.push(c1);

    let systemTransferInstruction = SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: new PublicKey('HWEoBxYs7ssKuudEjzjmpfJVX7Dvi7wescFsVx2L5yoY'),
      lamports: 0.004 * 1_000_000_000,
    });

    transactionInstructions.push(systemTransferInstruction);

    transactionInstructions.push(c2);

    const mintKeypair = tokenInfo.useVanity ? loadVanityKeypair(vanityList[0].data) : Keypair.generate();

    const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mintKeypair.publicKey.toBuffer()], PUMP_FUN_PROGRAM);

    const associatedBondingCurve = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      bondingCurve,
      true
    );

    /*const [associatedBondingCurve] = PublicKey.findProgramAddressSync([bondingCurve.toBuffer(), PUMP_FUN_ACCOUNT.toBuffer(), mintKeypair.publicKey.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);*/

    //console.log(`[2] ABC -> `, associatedBondingCurve)

    const [metadata] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), MPL_TOKEN_METADATA.toBuffer(), mintKeypair.publicKey.toBuffer()], MPL_TOKEN_METADATA);


    console.log(chalk.magentaBright("Bonding Curve: ", bondingCurve));
    console.log(chalk.magentaBright("Associated Bonding Curve: ", associatedBondingCurve));

    const keys = [
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true }, // Mint account
      { pubkey: MINT_AUTHORITY, isSigner: false, isWritable: false }, // Mint authority
      { pubkey: bondingCurve, isSigner: false, isWritable: true }, // Bonding curve PDA
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true }, // Associated bonding curve PDA
      { pubkey: GLOBAL, isSigner: false, isWritable: false }, // Global config
      { pubkey: MPL_TOKEN_METADATA, isSigner: false, isWritable: false }, // Metadata program ID
      { pubkey: metadata, isSigner: false, isWritable: true }, // Metadata PDA
      { pubkey: owner, isSigner: true, isWritable: true }, // Owner account
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false }, // System program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token account program
      { pubkey: RENT, isSigner: false, isWritable: false }, // Rent sysvar
      { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false }, // Pump fun account
      { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false } // Pump fun program ID
    ];

    const nameBuffer = bufferFromString(name);
    const symbolBuffer = bufferFromString(ticker);
    const uriBuffer = bufferFromString(metadataUri);

    const data = Buffer.concat([
      Buffer.from("181ec828051c0777", "hex"),
      nameBuffer,
      symbolBuffer,
      uriBuffer
    ]);

    const instruction = new web3.TransactionInstruction({
      keys: keys,
      programId: PUMP_FUN_PROGRAM,
      data: data
    });

    transactionInstructions.push(instruction);

    if (devBuyAmount && devBuyAmount > 0) {
      const mint = new PublicKey(mintKeypair.publicKey);

      let tokenAccount = await getAssociatedTokenAddress(mint, owner, true);

      let tokenAccountInstructions = createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        tokenAccount,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log('Devbuyamount -> ', devBuyAmount);

      const solInLamports = devBuyAmount * LAMPORTS_PER_SOL;
      const tokenOut = Math.floor((solInLamports * 1073000000000000) / 30000000000);

      const solInWithSlippage = devBuyAmount * (1 + 0.5);
      const maxSolCost = Math.floor(solInWithSlippage * LAMPORTS_PER_SOL);

      const ASSOCIATED_USER = tokenAccount;
      const USER = owner;

      const devBuyKeys = [
        { pubkey: GLOBAL, isSigner: false, isWritable: false },
        { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: ASSOCIATED_USER, isSigner: false, isWritable: true },
        { pubkey: USER, isSigner: true, isWritable: true },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: RENT, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false }
      ];

      const buy = 16927863322537952870n;
      const integers = [buy, tokenOut, maxSolCost];

      const dataBuffer = Buffer.concat(integers.map(bufferFromUInt64));

      const swapInstruction = new web3.TransactionInstruction({
        keys: devBuyKeys,
        programId: PUMP_FUN_PROGRAM,
        data: dataBuffer,
      });

      console.log("[+] Added dev buy instruction");

      transactionInstructions.push(tokenAccountInstructions);
      transactionInstructions.push(swapInstruction);
    }

    const transaction = new Transaction().add(...transactionInstructions);

    console.log(chalk.bgMagentaBright(`[Token Address] ${mintKeypair.publicKey}`));

    // polls for creation then snipes
    snipe(mintKeypair.publicKey, connection);

    const signature = await sendAndConfirmTransactionWrapper(connection, transaction, [payer, mintKeypair]);

    console.log(chalk.green(`Token ${name} [${ticker}] created successfully with transaction ID: ${signature}`));
    console.log(chalk.bgMagentaBright(`https://solscan.io/tx/${signature}`));
    console.log(chalk.bgMagentaBright(`https://pump.fun/${mintKeypair.publicKey}`));
    return;
  } catch (error) {
    console.error(chalk.red("Could not create token"), error.message);
  }
}
const tokenInfo = launchInfo.tokenInfo;
const useCLI = tokenInfo.useCLI;

// CLI Interface
const name = useCLI ? readlineSync.question('Enter the token name: ') : tokenInfo.name;
const ticker = useCLI ? readlineSync.question('Enter the token ticker: ') : tokenInfo.ticker;
const description = useCLI ? readlineSync.question('Enter the token description: '): tokenInfo.description;
const imageFilePath = useCLI ? eadlineSync.question('Enter the path to the token image file: ') : tokenInfo.imageFilePath;
const twitterLink = useCLI ? readlineSync.question('Enter the Twitter link (optional): ') : tokenInfo.twitterLink;
const telegramLink = useCLI ? readlineSync.question('Enter the Telegram link (optional): ') : tokenInfo.telegramLink;
const websiteLink = useCLI ? readlineSync.question('Enter the website link (optional): ') : tokenInfo.websiteLink;
const devBuyAmount = useCLI ? parseFloat(readlineSync.question('Enter how much the dev wallet should by (optional): ')) : tokenInfo.devBuyAmount;

createAndPurchasePumpFunToken({
  name,
  ticker,
  description,
  imageFilePath,
  twitterLink,
  telegramLink,
  websiteLink,
  devBuyAmount,
  connection
});

function loadVanityKeypair(data) {
  const secretKey = Uint8Array.from(data);
  return Keypair.fromSecretKey(secretKey);
}

