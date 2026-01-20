const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const util = require("util");

const client = new SecretsManagerClient({
  region: "ap-south-1",
});

/**
 * A wrapper class to prevent secrets from being accidentally printed in logs.
 */
class SecureSecret {
  #value;
  constructor(value) {
    this.#value = value;
  }

  reveal() {
    return this.#value;
  }

  toString() { return "[SECURE_SECRET]"; }
  toJSON() { return "[SECURE_SECRET]"; }
  [util.inspect.custom]() { return "[SECURE_SECRET]"; }
}

async function getSecrets(secretName) {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT",
      })
    );

    if ("SecretString" in response) {
      const secrets = JSON.parse(response.SecretString);

      // Wrap each secret in the SecureSecret protector
      Object.keys(secrets).forEach((key) => {
        process.env[key] = new SecureSecret(secrets[key]);
      });

      console.log(`Successfully loaded and SECURED secrets from ${secretName}`);
      return secrets;
    } else {
      console.warn("Secret binary data found, but not handled.");
    }
  } catch (error) {
    console.error(`Error fetching secrets from AWS: ${error.message}`);
  }
}

module.exports = { getSecrets, SecureSecret };
