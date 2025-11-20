import { Client } from "npm:@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk/server/streamableHttp.js';
async function main() {
    const transport = new SSEStreamableHTTPClientTransport (new URL("http://localhost:3000/sse"));

    const client = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);

        // Read resource
        const result = await client.readResource({ uri: "todos://list" });
        console.log("Todos via MCP (SSE):");
        console.log(result.contents[0].text);
    } catch (error) {
        console.error("Error connecting or reading todos:", error);
    } finally {
        await client.close();
    }
}

main();
