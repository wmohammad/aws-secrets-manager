require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
const { getSecrets } = require("./secrets");
const employeeRoutes = require("./routes/employees");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_NAME = process.env.AWS_SECRET_NAME || "employee-api-secrets";

app.use(express.json());
app.use(cors());

// Main function to initialize app with secrets
async function startServer() {
    console.log("Fetching secrets from AWS...");
    await getSecrets(SECRET_NAME);

    // Example of using a secret loaded into process.env
    // If we had a DB_HOST in AWS Secrets Manager, it would be available here
    console.log(`Environment Variable Check: DB_HOST = ${process.env.DB_HOST || "Not Set (This is expected if secret doesn't exist yet)"}`);

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.use("/employees", employeeRoutes);

    // New API to debug secrets from process.env
    app.get("/debug/env-secrets", (req, res) => {
        const getVal = (key) => {
            const val = process.env[key];
            // Check if it's a SecureSecret object
            if (val && typeof val.reveal === "function") {
                return "[SECURE_SECRET] (Use .reveal() in code)";
            }
            return val || "Not Set";
        };

        res.json({
            DB_HOST: getVal("DB_HOST"),
            API_KEY: getVal("API_KEY"),
            PORT: process.env.PORT || "3000 (default)",
            AWS_SECRET_NAME: process.env.AWS_SECRET_NAME || "employee-api-secrets"
        });
    });

    // New API to manually refresh secrets from AWS
    app.post("/debug/refresh-secrets", async (req, res) => {
        try {
            console.log("Manual secret refresh triggered...");
            await getSecrets(SECRET_NAME);
            res.json({ message: "Secrets refreshed successfully", timestamp: new Date().toISOString() });
        } catch (error) {
            res.status(500).json({ error: "Failed to refresh secrets", details: error.message });
        }
    });

    app.get("/", (req, res) => {
        res.send("Employee CRUD API is running. Secrets loaded (if configured).");
    });

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });

    // // Automatically refresh secrets every 5 minutes
    // const REFRESH_INTERVAL = 5 * 60 * 1000;
    // setInterval(async () => {
    //     console.log("Automatically refreshing secrets from AWS...");
    //     await getSecrets(SECRET_NAME);
    // }, REFRESH_INTERVAL);
}

startServer();
