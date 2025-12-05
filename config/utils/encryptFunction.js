const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const privateKey = process.env.PRIVATE_KEY;
const publicKey = process.env.PUBLIC_KEY;
const secretKey = process.env.SECRET_KEY;

const decryptData = (encrypted) => {
  try {
    return crypto.privateDecrypt({
      key: privateKey,
      padding: crypto.constants.RSA_OAEP_PADDING,
      oaepHash: 'sha256' 
    }, Buffer.from(encrypted, 'base64')).toString('utf8');
  } catch (error) {
    console.error("Decryption error:", error);
    throw error; 
  }
};

const encryptResponseData = (data) => {
  const buffer = Buffer.from(JSON.stringify(data));
  return crypto.publicEncrypt(publicKey, buffer).toString('base64');
};

const encryptWithSymmetricKey = (data) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
};

const decryptWithSymmetricKey = (encrypted) => {
  const bytes = CryptoJS.AES.decrypt(encrypted, secretKey);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

module.exports = { decryptData, encryptResponseData, encryptWithSymmetricKey, decryptWithSymmetricKey };