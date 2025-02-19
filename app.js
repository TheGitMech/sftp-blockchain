// app.js (ES Module Version)
import express from 'express';
import multer from 'multer';
import SftpClient from 'ssh2-sftp-client';
import Web3 from 'web3';
import fs from 'fs';
import { readFile } from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// Set __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract artifact
let contractJson;
try {
  // Try to use a dynamic import with assertions (Node v17.5+ with proper flags)
  const contractModule = await import('./build/contracts/FileRegistry.json', { assert: { type: 'json' } });
  contractJson = contractModule.default;
} catch (err) {
  // Fallback: read the JSON file manually using fs/promises
  const jsonData = await readFile(new URL('./build/contracts/FileRegistry.json', import.meta.url));
  contractJson = JSON.parse(jsonData);
}

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' }); // Temporary local upload folder

// Blockchain Setup
const web3 = new Web3('http://localhost:8545');
let contractInstance;
let accounts;

async function initBlockchain() {
  accounts = await web3.eth.getAccounts();
  const networkId = await web3.eth.net.getId();
  const deployedNetwork = contractJson.networks[networkId];
  if (!deployedNetwork) {
    throw new Error("Contract not deployed on the current network. Please migrate the contract first.");
  }
  contractInstance = new web3.eth.Contract(
    contractJson.abi,
    deployedNetwork.address,
  );
}
initBlockchain().catch(console.error);

// SFTP configuration for Server 1 and Server 2
const sftp1Config = {
  host: 'localhost',
  port: 2222,
  username: 'foo',
  password: 'pass'
};

const sftp2Config = {
  host: 'localhost',
  port: 2223,
  username: 'foo',
  password: 'pass'
};

// Upload Endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const localFilePath = req.file.path;
    const fileName = req.file.originalname;
    const remoteFilePath = `/upload/${fileName}`;

    // --- Upload to SFTP Server 1 ---
    const sftp1 = new SftpClient();
    await sftp1.connect(sftp1Config);
    await sftp1.put(localFilePath, remoteFilePath);
    await sftp1.end();

    // --- Compute File Hash ---
    const fileBuffer = fs.readFileSync(localFilePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // --- Record the File on the Blockchain ---
    await contractInstance.methods.addFile(fileName, fileHash)
  	.send({ from: accounts[0], gas: 300000, gasPrice: '20000000000' });


    // --- Replicate to SFTP Server 2 ---
    const sftp2 = new SftpClient();
    await sftp2.connect(sftp2Config);
    await sftp2.put(localFilePath, remoteFilePath);
    await sftp2.end();

    // Remove temporary local file
    fs.unlinkSync(localFilePath);

    res.send({
      message: 'File successfully uploaded, hash stored on blockchain, and replicated to SFTP Server 2.'
    });
  } catch (error) {
    console.error('Error in /upload:', error);
    res.status(500).send({ error: 'Error uploading file.' });
  }
});

// Simple homepage with upload form
app.get('/', (req, res) => {
  res.send(`
    <h2>Upload a File</h2>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="file" /><br/><br/>
      <input type="submit" value="Upload File" />
    </form>
  `);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

