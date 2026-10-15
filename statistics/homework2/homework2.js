/*
 * Homework 2: From a wallet mnemonic to an Ethereum address.
 * JavaScript implementation using ethers.js v6.
 *
 * SECURITY NOTE: This fixed phrase is a public test vector only. Never use a
 * real recovery phrase/private key in a demo page or publish it on GitHub Pages.
 */
(() => {
  'use strict';

  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const DERIVATION_PREFIX = "m/44'/60'/0'/0";
  const $ = (id) => document.getElementById(id);

  const idsToClear = [
    'out-seed', 'out-master-key', 'out-chain-code', 'out-path',
    'out-private-key', 'out-public-key', 'out-keccak',
    'out-address-lower', 'out-address-checksum'
  ];

  function setStatus(message, success = true) {
    const node = $('pipeline-status');
    node.textContent = message;
    node.className = `status ${success ? 'pass' : 'fail'}`;
  }

  function resetOutputs() {
    idsToClear.forEach((id) => { $(id).textContent = '—'; });
    $('out-check').textContent = 'Waiting…';
    $('out-check').className = '';
  }

  function countSetBits(hex) {
    const bytes = ethers.getBytes(hex);
    let count = 0;
    for (const byte of bytes) {
      let value = byte;
      while (value !== 0) {
        count += value & 1;
        value >>>= 1;
      }
    }
    return count;
  }

  function deriveAddress(wallet) {
    // Ethereum hashes the 64-byte X || Y coordinates, not the 0x04 prefix.
    const uncompressedPublicKey = ethers.SigningKey.computePublicKey(wallet.privateKey, false);
    const coordinates = ethers.dataSlice(uncompressedPublicKey, 1);
    const digest = ethers.keccak256(coordinates); // Ethereum Keccak-256 (not standardized SHA3-256)
    const twentyByteAddress = ethers.dataSlice(digest, 12);
    return {
      publicKey: uncompressedPublicKey,
      digest,
      lowercaseAddress: twentyByteAddress.toLowerCase(),
      checksummedAddress: ethers.getAddress(twentyByteAddress)
    };
  }

  function renderStats(master) {
    const counts = Object.fromEntries('0123456789abcdef'.split('').map((character) => [character, 0]));
    let setBits = 0;
    let totalBits = 0;
    const rows = [];

    for (let index = 0; index < 16; index += 1) {
      const path = `${DERIVATION_PREFIX}/${index}`;
      const child = master.derivePath(path);
      const addressData = deriveAddress(child);
      const addressText = addressData.lowercaseAddress.slice(2);
      for (const character of addressText) counts[character] += 1;
      const ones = countSetBits(addressData.lowercaseAddress);
      setBits += ones;
      totalBits += 160;

      const tr = document.createElement('tr');
      [String(index), path, addressData.checksummedAddress, `${ones} / 160`].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      rows.push(tr);
    }

    const tbody = $('address-samples');
    tbody.replaceChildren(...rows);
    const charsTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const frequencies = Object.entries(counts).map(([character, count]) => `${character}: ${count}`).join(' · ');
    const bitPercent = (100 * setBits / totalBits).toFixed(2);
    $('stats-summary').textContent = `Sample size: 16 addresses (${charsTotal} hexadecimal characters). Set bits: ${setBits}/${totalBits} (${bitPercent}%). Hex-character frequencies: ${frequencies}. This fixed sample is too small to establish uniformity or security.`;
  }

  function run() {
    resetOutputs();
    if (!window.ethers) {
      setStatus('Could not load ethers.js. Check your internet connection and reload the page.', false);
      return;
    }

    const index = Number($('address-index').value);
    if (!Number.isInteger(index) || index < 0 || index > 1000) {
      setStatus('Enter a whole-number address index between 0 and 1000.', false);
      return;
    }

    try {
      // BIP-39: mnemonic + optional passphrase -> 512-bit seed.
      const mnemonic = ethers.Mnemonic.fromPhrase(TEST_MNEMONIC);
      const seed = mnemonic.computeSeed();

      // BIP-32: seed -> master HD node (master key and chain code).
      const master = ethers.HDNodeWallet.fromSeed(seed);

      // BIP-44: select an Ethereum child using purpose 44', coin type 60',
      // account 0', external chain 0, and the selected address index.
      const path = `${DERIVATION_PREFIX}/${index}`;
      const wallet = master.derivePath(path);

      // secp256k1 public-key operation, then Keccak-256 and EIP-55 checksum.
      const addressData = deriveAddress(wallet);
      const derivedByLibrary = ethers.getAddress(wallet.address);
      const agrees = addressData.checksummedAddress === derivedByLibrary;

      $('out-mnemonic').textContent = TEST_MNEMONIC;
      $('out-seed').textContent = seed;
      $('out-master-key').textContent = master.privateKey;
      $('out-chain-code').textContent = master.chainCode;
      $('out-path').textContent = path;
      $('out-private-key').textContent = wallet.privateKey;
      $('out-public-key').textContent = addressData.publicKey;
      $('out-keccak').textContent = addressData.digest;
      $('out-address-lower').textContent = addressData.lowercaseAddress;
      $('out-address-checksum').textContent = addressData.checksummedAddress;
      $('out-check').textContent = agrees
        ? `PASS — independently derived address matches ethers.js: ${derivedByLibrary}`
        : `FAIL — derived ${addressData.checksummedAddress}; ethers.js returned ${derivedByLibrary}`;
      $('out-check').className = agrees ? 'pass' : 'fail';

      renderStats(master);
      setStatus(agrees
        ? `Pipeline completed successfully for address index ${index}.`
        : 'The consistency check failed. Review the calculation before submitting.', agrees);
    } catch (error) {
      console.error(error);
      setStatus(`Pipeline error: ${error && error.message ? error.message : String(error)}`, false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('run-pipeline').addEventListener('click', run);
    $('address-index').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') run();
    });
    $('out-mnemonic').textContent = TEST_MNEMONIC;
    if (window.ethers) run();
    else setStatus('Loading ethers.js… If this message remains, check your internet connection.', false);
  });
})();
