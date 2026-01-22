const {
  SecretsManagerClient,
  GetSecretValueCommand,
  DescribeSecretCommand,
} = require("@aws-sdk/client-secrets-manager");
const util = require("util");

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

const clients = {};

function getClient(region) {
  if (!clients[region]) {
    clients[region] = new SecretsManagerClient({ region });
  }
  return clients[region];
}

async function getSecrets(secretName, region = "us-west-2") {
  try {
    const client = getClient(region);
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT",
      })
    );

    if ("SecretString" in response) {
      const secrets = JSON.parse(response.SecretString);

      // Wrap each secret in the SecureSecret protector and inject into process.env
      Object.keys(secrets).forEach((key) => {
        process.env[key] = new SecureSecret(secrets[key]);
      });

      console.log(`Successfully loaded and SECURED secrets from ${secretName} (${region})`);
      return secrets;
    } else {
      console.warn("Secret binary data found, but not handled.");
    }
  } catch (error) {
    console.error(`Error fetching secrets from AWS (${secretName} in ${region}): ${error.message}`);
  }
}
async function getSecretMetadata(secretName, region = "us-west-2") {
  try {
    const client = getClient(region);
    const response = await client.send(
      new DescribeSecretCommand({
        SecretId: secretName,
      })
    );
    return response;
  } catch (error) {
    console.error(`Error fetching metadata for ${secretName}: ${error.message}`);
    return null;
  }
}

module.exports = { getSecrets, getSecretMetadata, SecureSecret };
