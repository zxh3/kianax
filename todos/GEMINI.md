Whenever making a new feature todo list in this folder. Create a <feature_name>.json file and fill in the JSON in the following format.

```
interface Todo {
  "feature": string;
  "description": string;
  "status": "planning" | "in_progress" | "completed",
  "tasks": {
    "task": string;
    "status": "todo" | "completed",
  }[]
}
```