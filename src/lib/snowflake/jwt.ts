import { importPKCS8, SignJWT } from 'jose';
import { createHash, createPublicKey } from 'crypto';

/**
 * Generate a JWT for Snowflake SQL API authentication (Keypair auth).
 *
 * The JWT uses RS256 algorithm and contains:
 * - iss: <ACCOUNT_LOCATOR>.<USER>.<PUBLIC_KEY_FINGERPRINT>
 * - sub: <ACCOUNT_LOCATOR>.<USER>
 * - iat/exp: current time, 60 second lifetime
 *
 * IMPORTANT: JWT claims must use the account locator (e.g. XY12345),
 * NOT the org-account format (e.g. MYORG-MYACCOUNT).
 */
export async function generateSnowflakeJwt(params: {
  accountIdentifier: string;
  accountLocator: string;
  username: string;
  privateKeyPem: string;
}): Promise<string> {
  const { accountLocator, username, privateKeyPem } = params;

  // JWT claims use account locator (uppercase), not org-account format
  const accountId = accountLocator.toUpperCase();
  const user = username.toUpperCase();

  // Import the private key for signing
  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  // Derive public key fingerprint using Node.js crypto
  const fingerprint = getPublicKeyFingerprint(privateKeyPem);

  const iss = `${accountId}.${user}.${fingerprint}`;
  const sub = `${accountId}.${user}`;

  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(iss)
    .setSubject(sub)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(privateKey);

  return jwt;
}

/**
 * Extract the SHA-256 fingerprint of the public key from a PEM private key.
 * Returns format: "SHA256:<base64_hash>"
 *
 * The private key must be PKCS#8 format (BEGIN PRIVATE KEY), not PKCS#1.
 */
function getPublicKeyFingerprint(privateKeyPem: string): string {
  // Derive public key from private key using Node.js crypto
  const publicKey = createPublicKey(privateKeyPem);

  // Export as DER format
  const derBytes = publicKey.export({ type: 'spki', format: 'der' });

  // SHA-256 hash of the DER-encoded public key
  const hash = createHash('sha256').update(derBytes).digest('base64');

  return `SHA256:${hash}`;
}
