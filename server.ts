import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "npm:zod@3.21.4";
import { StreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "npm:express";
import cors from "npm:cors";

import {
  readTodosFromFile,
  writeTodosToFile,
} from "./logic/todo-file-helpers.ts";
import { Todo } from "./logic/todo.ts";
import { TodoStateEnum } from "./types/enums.ts";

if (Deno.args.length < 1) {
  console.error("Please provide a filename as an argument.");
  Deno.exit(1);
}

const filename = Deno.args[0];

function createTodoServer() {
  const server = new McpServer({
    name: "TodoTui",
    version: "1.0.0",
  });

  // Helper to get todos
  async function getTodos() {
    return await readTodosFromFile(filename);
  }

  // Helper to save todos
  async function saveTodos(todos: Todo[]) {
    await writeTodosToFile(todos, filename);
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
  server.tool(
    "add_todo",
    {
      text: z.string().describe("The todo text, supports todo.txt format"),
    },
    async ({ text }) => {
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
  server.tool(
    "edit_todo",
    {
      index: z.number().describe("Index of the todo to edit"),
      text: z.string().describe("New text for the todo"),
    },
    async ({ index, text }) => {
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
  server.tool(
    "mark_done",
    {
      index: z.number().describe("Index of the todo to mark as done"),
    },
    async ({ index }) => {
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
  server.tool(
    "mark_todo",
    {
      index: z.number().describe("Index of the todo to mark as not done (active)"),
    },
    async ({ index }) => {
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
const server: McpServer = createTodoServer();

// Start the server
const app = express();
app.use(cors());

app.post('/mcp', async (req, res) => {
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


