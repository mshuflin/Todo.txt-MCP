import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "npm:zod@3.21.4";
import { StreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "npm:express";
import cors from "npm:cors";

import { Todo } from "./logic/todo.ts";
import { TodoStateEnum } from "./types/enums.ts";
import { TodoBackend } from "./logic/backend.ts";
import { LocalFileBackend } from "./logic/backends/local-file-backend.ts";
import { WebDavBackend } from "./logic/backends/webdav-backend.ts";

// Configuration Interface
interface TodoTuiConfig {
  backend: "local" | "webdav";
  local?: {
    filename: string;
  };
  webdav?: {
    url: string;
    username?: string;
    password?: string;
  };
}

async function loadConfig(): Promise<TodoTuiConfig> {
  try {
    const text = await Deno.readTextFile("todotui-config.json");
    return JSON.parse(text) as TodoTuiConfig;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("Config file not found, defaulting to local 'todo.txt'");
      return {
        backend: "local",
        local: { filename: "todo.txt" },
      };
    }
    throw error;
  }
}

function createBackend(config: TodoTuiConfig): TodoBackend {
  if (config.backend === "webdav") {
    if (!config.webdav || !config.webdav.url) {
      throw new Error("WebDAV configuration missing URL");
    }
    return new WebDavBackend(
      config.webdav.url,
      config.webdav.username,
      config.webdav.password
    );
  } else {
    // Default to local
    const filename = config.local?.filename || "todo.txt";
    return new LocalFileBackend(filename);
  }
}

async function createTodoServer() {
  const config = await loadConfig();
  const backend = await createBackend(config);

  const server = new McpServer({
    name: "TodoTui",
    version: "1.0.0",
  });

  // Helper to get todos
  async function getTodos() {
    return await backend.load();
  }

  // Helper to save todos
  async function saveTodos(todos: Todo[]) {
    await backend.save(todos);
  }

  // Tool: list_todos
  server.tool("list_todos", {}, async () => {
    const todos = await getTodos();
    return {
      content: [
        {
          type: "text",
          text: todos
            .map((todo, index) => `[${index}] ${todo.toString()}`)
            .join("\n"),
        },
      ],
    };
  });

  // Tool: add_todo
  // @ts-ignore: Zod version mismatch with McpServer
  server.tool(
    "add_todo",
    {
      text: z.string().describe("The todo text, supports todo.txt format"),
    } as any,
    async ({ text }: { text: string }) => {
      const todos = await getTodos();
      const newTodo = new Todo(text);
      if (!newTodo.creationDate) {
        newTodo.creationDate = new Date();
      }
      todos.push(newTodo);
      await saveTodos(todos);
      return {
        content: [
          {
            type: "text",
            text: `Added todo: ${newTodo.toString()}`,
          },
        ],
      };
    }
  );

  // Tool: edit_todo
  // @ts-ignore: Zod version mismatch with McpServer
  server.tool(
    "edit_todo",
    {
      index: z.number().describe("Index of the todo to edit"),
      text: z.string().describe("New text for the todo"),
    } as any,
    async ({ index, text }: { index: number; text: string }) => {
      const todos = await getTodos();
      if (index < 0 || index >= todos.length) {
        return {
          isError: true,
          content: [{ type: "text", text: "Index out of bounds" }],
        };
      }
      const todo = todos[index];
      todo.setText(text);
      await saveTodos(todos);
      return {
        content: [
          {
            type: "text",
            text: `Edited todo [${index}]: ${todo.toString()}`,
          },
        ],
      };
    }
  );

  // Tool: mark_done
  // @ts-ignore: Zod version mismatch with McpServer
  server.tool(
    "mark_done",
    {
      index: z.number().describe("Index of the todo to mark as done"),
    } as any,
    async ({ index }: { index: number }) => {
      const todos = await getTodos();
      if (index < 0 || index >= todos.length) {
        return {
          isError: true,
          content: [{ type: "text", text: "Index out of bounds" }],
        };
      }
      const todo = todos[index];
      if (todo.state !== TodoStateEnum.done) {
        todo.toggleState();
        await saveTodos(todos);
      }
      return {
        content: [
          {
            type: "text",
            text: `Marked todo [${index}] as done: ${todo.toString()}`,
          },
        ],
      };
    }
  );

  // Tool: mark_todo
  // @ts-ignore: Zod version mismatch with McpServer
  server.tool(
    "mark_todo",
    {
      index: z.number().describe("Index of the todo to mark as not done (active)"),
    } as any,
    async ({ index }: { index: number }) => {
      const todos = await getTodos();
      if (index < 0 || index >= todos.length) {
        return {
          isError: true,
          content: [{ type: "text", text: "Index out of bounds" }],
        };
      }
      const todo = todos[index];
      if (todo.state === TodoStateEnum.done) {
        todo.toggleState();
        await saveTodos(todos);
      }
      return {
        content: [
          {
            type: "text",
            text: `Marked todo [${index}] as todo: ${todo.toString()}`,
          },
        ],
      };
    }
  );

  return server;
}

// Global server and transport
const server = await createTodoServer();

// Start the server
const app = express();
app.use(cors());

app.post('/mcp', async (req: any, res: any) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = 3000;
app.listen(port,  () => {
  console.log(`TodoTui MCP Server running on http://localhost:${port}`);
  console.log(`MCP Endpoint: http://localhost:${port}/mcp`);
});


