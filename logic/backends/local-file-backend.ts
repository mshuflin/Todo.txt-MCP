import { TodoBackend } from "../backend.ts";
import { Todo } from "../todo.ts";
import { readTodosFromFile, writeTodosToFile } from "../todo-file-helpers.ts";

export class LocalFileBackend implements TodoBackend {
  constructor(private filename: string) {}

  async load(): Promise<Todo[]> {
    return await readTodosFromFile(this.filename);
  }

  async save(todos: Todo[]): Promise<void> {
    await writeTodosToFile(todos, this.filename);
  }
}
