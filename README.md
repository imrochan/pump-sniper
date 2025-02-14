PumpFun token creator + sniper
	•	Automatically deploys a custom token on Pump.fun
	•	Configurable parameters: name, supply, tax, LP lock duration, etc.
 	•	Scans for newly launched Pump.fun tokens
	•	Front-runs purchases by instantly buying upon listing
	•	Implements auto-sell triggers for profit-taking


 🔧 How It Works
	1.	Token Creation
	•	Uses ethers.js to interact with Pump.fun’s token deployment contracts
	•	Automates deployment via a preset config file
	2.	Sniping Bot
	•	Monitors the Pump.fun mempool for new token launches
	•	Sends high-priority transactions to secure early entry
	•	Uses sell triggers based on price action

 👨‍💻 Developed with: Node.js, ethers.js, web3.js, and Pump.fun API.
