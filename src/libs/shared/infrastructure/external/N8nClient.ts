import { logger } from "../../../common/logger";

export class N8nClient {
    constructor(private readonly baseUrl: string) { }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/healthz`);
            return response.status === 200;
        } catch {
            return false;
        }
    }

    async ownerSetup(data: any): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/owner-setup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`n8n owner setup failed: ${JSON.stringify(errorData)}`);
            }
        } catch (err) {
            logger.error("n8n.owner_setup_failed", { error: String(err) });
            throw err;
        }
    }

    async createCredential(apiKey: string, data: any): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/credentials`, {
                method: "POST",
                headers: {
                    "X-N8N-API-KEY": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`n8n credential creation failed: ${JSON.stringify(errorData)}`);
            }

            const resData = await response.json();
            return resData.id;
        } catch (err) {
            logger.error("n8n.create_credential_failed", { error: String(err) });
            throw err;
        }
    }

    async deployWorkflow(apiKey: string, workflowJson: any): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/workflows`, {
                method: "POST",
                headers: {
                    "X-N8N-API-KEY": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(workflowJson)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`n8n workflow deployment failed: ${JSON.stringify(errorData)}`);
            }

            const resData = await response.json();
            return resData.id;
        } catch (err) {
            logger.error("n8n.deploy_workflow_failed", { error: String(err) });
            throw err;
        }
    }

    async activateWorkflow(apiKey: string, workflowId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/activate`, {
                method: "PATCH",
                headers: { "X-N8N-API-KEY": apiKey }
            });
            if (!response.ok) throw new Error(`n8n workflow activation failed`);
        } catch (err) {
            logger.error("n8n.activate_workflow_failed", { workflowId, error: String(err) });
            throw err;
        }
    }

    async runWorkflow(apiKey: string, workflowId: string, payload: any): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/run`, {
                method: "POST",
                headers: {
                    "X-N8N-API-KEY": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`n8n workflow run failed`);
        } catch (err) {
            logger.error("n8n.run_workflow_failed", { workflowId, error: String(err) });
            throw err;
        }
    }
}
