# Frsh 🔥 - Simple Session Management

A simple and lightweight utility class to manage user sessions with [Firebase RTDB](https://firebase.google.com/docs/database)

## Why Frsh?

-   Firebase RTDB charges mainly for storage, you can do tons of session reads and writes without worrying about the cost—perfect for busy apps.
-   Realtime Database is lightning fast, so your app can handle session info quickly, keeping everything smooth and responsive.
-   Whether you’re using Node.js with the Admin SDK or making HTTP requests on the edge, Frsh got the adapters to fit right into your setup.
-   Built with TypeScript, Frsh types super easy to tweak and extend, making your dev life a clean and simple.

```ts
import { Frsh } from '@frsh-auth/frsh'
import { AdminAdaptor } from '@frsh-auth/admin-adaptor'

const frsh = new Frsh(new AdminAdaptor())

await frsh.createSession(userId, {
    name: 'Frsh Session',
    age: 1738,
    isAdmin: true,
})
```

Frsh is also open source! Please feel free to help out with the project.

## Resource

coming soon!
