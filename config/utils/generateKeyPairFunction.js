const crypto = require('crypto');

// Function to generate RSA key pair
function generateKeyPair() {
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair('rsa', {
            modulusLength: 2048, // Key size
            publicKeyEncoding: {
                type: 'spki', // Recommended for public keys
                format: 'pem' // Output format
            },
            privateKeyEncoding: {
                type: 'pkcs8', // Recommended for private keys
                format: 'pem' // Output format
            }
        }, (err, publicKey, privateKey) => {
            if (err) {
                return reject(err);
            }
            resolve({ publicKey, privateKey });
        });
    });
}

// Usage
generateKeyPair()
    .then(keyPair => {
        console.log("Public Key:", keyPair.publicKey);
        console.log("Private Key:", keyPair.privateKey);
    })
    .catch(err => {
        console.error("Error generating keys:", err);
    });