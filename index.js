require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
const { getSecrets, getSecretMetadata } = require("./secrets");
const employeeRoutes = require("./routes/employees");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_NAME = "employee-api-secrets";
const RDS_SECRET_NAME = "rds!db-ca8aa633-7fd4-4a19-ac62-223f5f4be264";

// Shared cache to hold secrets and ensure they are updated across scopes
let secretsCache = {
    employeeSecrets: null,
    rdsSecrets: null,
    lastKnownRotationDate: null
};

app.use(express.json());
app.use(cors());

// Main function to initialize app with secrets
async function startServer() {
    console.log("Fetching secrets from AWS...");

    // Initial fetch of secrets and metadata
    secretsCache.employeeSecrets = await getSecrets(SECRET_NAME, "us-west-2");
    secretsCache.rdsSecrets = await getSecrets(RDS_SECRET_NAME, "us-west-2");

    const metadata = await getSecretMetadata(RDS_SECRET_NAME, "us-west-2");
    if (metadata && metadata.LastRotatedDate) {
        secretsCache.lastKnownRotationDate = new Date(metadata.LastRotatedDate).getTime();
    }

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.use("/employees", employeeRoutes);

    // API to debug secrets (CAUTION: Reveals real secrets)
    app.get("/debug/env-secrets", (req, res) => {
        const reveal = (obj) => {
            if (!obj) return "Not Found";
            // If it's a SecureSecret (wrapped in process.env), we'd need to reveal it.
            // But here we are using the returned object from getSecrets which is raw data.
            return obj;
        };

        res.json({
            "employee-api-secrets": reveal(secretsCache.employeeSecrets),
            "rds-secrets": {
                "username": secretsCache.rdsSecrets?.username || "Not Found",
                "password": secretsCache.rdsSecrets?.password || "Not Found"
            },
            "metadata": {
                PORT: PORT,
                AWS_SECRET_NAME: SECRET_NAME,
                RDS_SECRET_NAME: RDS_SECRET_NAME,
                TIMESTAMP: new Date().toISOString(),
                WARNING: "REVEALING ACTUAL SECRETS - FOR DEBUGGING ONLY"
            }
        });
    });

    // New API to manually refresh secrets from AWS
    app.post("/debug/refresh-secrets", async (req, res) => {
        try {
            console.log("Manual secret refresh triggered...");
            secretsCache.employeeSecrets = await getSecrets(SECRET_NAME, "us-west-2");
            secretsCache.rdsSecrets = await getSecrets(RDS_SECRET_NAME, "us-west-2");
            res.json({ message: "Secrets refreshed successfully", timestamp: new Date().toISOString() });
        } catch (error) {
            res.status(500).json({ error: "Failed to refresh secrets", details: error.message });
        }
    });

    app.get("/", (req, res) => {
        res.send("Employee CRUD API is running. Multi-region secrets loaded.");
    });

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

let nextRefreshTimeout = null;

async function scheduleNextRefresh() {
    if (nextRefreshTimeout) {
        clearTimeout(nextRefreshTimeout);
    }
    console.log(`Checking for next rotation date of ${RDS_SECRET_NAME}...`);
    const metadata = await getSecretMetadata(RDS_SECRET_NAME, "us-west-2");

    let refreshDelay = 5 * 60 * 1000; // Default: 5 minutes

    if (metadata && metadata.NextRotationDate) {
        const nextRotation = new Date(metadata.NextRotationDate);
        const now = new Date();
        const timeUntilRotation = nextRotation.getTime() - now.getTime();

        // Add 1 second as requested
        refreshDelay = timeUntilRotation + 1000;

        if (refreshDelay < 0) {
            console.warn("Next rotation date is in the past, refreshing in 10 seconds...");
            refreshDelay = 10 * 1000;
        } else {
            console.log(`Next rotation scheduled at: ${nextRotation.toISOString()}`);
            console.log(`Refresh scheduled in: ${Math.round(refreshDelay / 1000)} seconds`);
        }
    } else {
        console.warn("Could not determine next rotation date, falling back to 5 minute refresh.");
    }

    nextRefreshTimeout = setTimeout(async () => {
        try {
            console.log("Dynamically scheduled refresh triggered...");
            secretsCache.employeeSecrets = await getSecrets(SECRET_NAME, "us-west-2");
            secretsCache.rdsSecrets = await getSecrets(RDS_SECRET_NAME, "us-west-2");

            // Update last known rotation date after refresh
            const meta = await getSecretMetadata(RDS_SECRET_NAME, "us-west-2");
            if (meta && meta.LastRotatedDate) {
                secretsCache.lastKnownRotationDate = new Date(meta.LastRotatedDate).getTime();
            }

            // Schedule the next one
            scheduleNextRefresh();
        } catch (error) {
            console.error("Failed during scheduled refresh:", error.message);
            // Retry in 5 minutes on failure
            nextRefreshTimeout = setTimeout(scheduleNextRefresh, 5 * 60 * 1000);
        }
    }, refreshDelay);
}

function startManualRotationPolling() {
    console.log("Starting 15-second polling for manual rotation detection...");
    setInterval(async () => {
        try {
            const metadata = await getSecretMetadata(RDS_SECRET_NAME, "us-west-2");
            if (metadata && metadata.LastRotatedDate) {
                const currentRotationDate = new Date(metadata.LastRotatedDate).getTime();

                if (secretsCache.lastKnownRotationDate && currentRotationDate > secretsCache.lastKnownRotationDate) {
                    console.log("Manual rotation detected in AWS Console! Triggering immediate refresh...");

                    // Update cache
                    secretsCache.employeeSecrets = await getSecrets(SECRET_NAME, "us-west-2");
                    secretsCache.rdsSecrets = await getSecrets(RDS_SECRET_NAME, "us-west-2");
                    secretsCache.lastKnownRotationDate = currentRotationDate;

                    // Reschedule the long-term timer since rotation schedule might have shifted
                    scheduleNextRefresh();
                }
            }
        } catch (error) {
            console.error("Error during manual rotation polling:", error.message);
        }
    }, 15000); // 15 seconds
}

startServer().then(() => {
    scheduleNextRefresh();
    startManualRotationPolling();
});
