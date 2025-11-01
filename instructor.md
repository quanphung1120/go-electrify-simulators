# Go-Electrify Simulators Coding Standards

## Function Declarations

**Rule: Always use `function` declarations instead of `const` function expressions.**

### ✅ Correct

```typescript
function myFunction(param: string): void {
  // implementation
}

async function myAsyncFunction(param: string): Promise<void> {
  // implementation
}
```

### ❌ Incorrect

```typescript
const myFunction = (param: string): void => {
  // implementation
};

const myAsyncFunction = async (param: string): Promise<void> => {
  // implementation
};
```

### Why?

- Function declarations are hoisted, making them available throughout the file
- Better debugging with function names in stack traces
- Consistent with traditional JavaScript/TypeScript patterns
- Easier to read and maintain

## HTTP Client

**Rule: Use native `fetch` API instead of `axios` for HTTP requests.**

### ✅ Correct

```typescript
const response = await fetch("/api/endpoint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(data),
});

if (!response.ok) {
  const errorText = await response.text().catch(() => "Unknown error");
  console.error(`Request failed (status ${response.status}):`, errorText);
  throw new Error(`Request failed: ${response.status}`);
}

const result = await response.json();
```

### ❌ Avoid

```typescript
import axios from "axios";

const response = await axios.post("/api/endpoint", data, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Benefits

- Native browser/Node.js API, no additional dependencies
- Better error handling with response.ok
- More control over request/response handling
- Consistent with modern JavaScript standards

## Export Pattern

**Rule: Use named exports for functions, avoid default exports for functions.**

### ✅ Preferred

```typescript
export function myFunction(): void {
  // implementation
}
```

### ❌ Not Preferred

```typescript
function myFunction(): void {
  // implementation
}

export default myFunction;
```
