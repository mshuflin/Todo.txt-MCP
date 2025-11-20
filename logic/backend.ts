import { Todo } from "./todo.ts";

export interface TodoBackend {
  load(): Promise<Todo[]>;
  save(todos: Todo[]): Promise<void>;
}
