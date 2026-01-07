const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const client = new SecretsManagerClient({
  region: "ap-south-1",
});

async function getSecrets(secretName) {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );

    if ("SecretString" in response) {
      const secrets = JSON.parse(response.SecretString);
      // Inject secrets into process.env
      Object.keys(secrets).forEach((key) => {
        process.env[key] = secrets[key];
      });
      console.log(`Successfully loaded secrets from ${secretName}`);
      return secrets;
    } else {
      console.warn("Secret binary data found, but not handled.");
    }
  } catch (error) {
    console.error(`Error fetching secrets from AWS: ${error.message}`);
    // If we fail to fetch from AWS, we might want to fall back to .env or exit
    // For this hands-on, we'll just log and proceed (which might fail later)
  }
}

module.exports = { getSecrets };
