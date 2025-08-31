#!/usr/bin/env node

/**
 * JWT Secret Generator
 * Generates cryptographically secure JWT secrets for production use
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecureSecret() {
  // Generate 64 random bytes (512 bits) and convert to hex
  return crypto.randomBytes(64).toString('hex');
}

function validateSecretStrength(secret) {
  const minLength = 64; // 256 bits in hex
  const hasGoodEntropy = /^[a-f0-9]+$/i.test(secret); // Only hex chars
  
  return {
    isSecure: secret.length >= minLength && hasGoodEntropy,
    length: secret.length,
    entropyBits: secret.length * 4 // Each hex char = 4 bits
  };
}

function updateEnvFile(secret) {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  try {
    // Update .env if it exists
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('JWT_SECRET=')) {
        envContent = envContent.replace(
          /JWT_SECRET=.*/,
          `JWT_SECRET=${secret}`
        );
      } else {
        envContent += `\nJWT_SECRET=${secret}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file with new JWT secret');
    } else {
      // Create .env from .env.example
      if (fs.existsSync(envExamplePath)) {
        let envContent = fs.readFileSync(envExamplePath, 'utf8');
        envContent = envContent.replace(
          /JWT_SECRET=.*/,
          `JWT_SECRET=${secret}`
        );
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Created .env file with secure JWT secret');
      }
    }
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
JWT Secret Generator

Usage:
  node generate-jwt-secret.js [options]

Options:
  --update-env    Update the .env file with the new secret
  --check-env     Check the current JWT secret strength
  --help, -h      Show this help message

Examples:
  node generate-jwt-secret.js
  node generate-jwt-secret.js --update-env
  node generate-jwt-secret.js --check-env
    `);
    return;
  }
  
  if (args.includes('--check-env')) {
    require('dotenv').config();
    const currentSecret = process.env.JWT_SECRET;
    
    if (!currentSecret) {
      console.log('❌ No JWT_SECRET found in environment');
      return;
    }
    
    const validation = validateSecretStrength(currentSecret);
    console.log(`
Current JWT Secret Analysis:
  Length: ${validation.length} characters
  Entropy: ${validation.entropyBits} bits
  Security: ${validation.isSecure ? '✅ SECURE' : '❌ INSECURE'}
  
${validation.isSecure ? 
  'Your JWT secret meets security requirements.' : 
  'Your JWT secret is too weak. Generate a new one with this script.'}
    `);
    return;
  }
  
  // Generate new secret
  const newSecret = generateSecureSecret();
  const validation = validateSecretStrength(newSecret);
  
  console.log(`
🔐 Generated Secure JWT Secret:
${newSecret}

Security Details:
  Length: ${validation.length} characters
  Entropy: ${validation.entropyBits} bits
  Security Level: ✅ CRYPTOGRAPHICALLY SECURE

⚠️  IMPORTANT SECURITY NOTES:
1. Keep this secret confidential
2. Never commit it to version control
3. Use different secrets for different environments
4. Rotate secrets periodically in production
  `);
  
  if (args.includes('--update-env')) {
    updateEnvFile(newSecret);
    console.log(`
Next steps:
1. Restart your application server
2. Invalidate all existing JWT tokens
3. Users will need to log in again
    `);
  } else {
    console.log(`
To use this secret:
1. Copy the secret above
2. Update your .env file: JWT_SECRET=${newSecret}
3. Or run: node generate-jwt-secret.js --update-env
    `);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateSecureSecret,
  validateSecretStrength
};
