import { serve } from "bun";
import index from "./index.html";

// Taggle agent API — proxied so the tenant header stays server-side and the
// browser avoids CORS. Override via env in deployment.
const TAGGLE_API_BASE_URL = process.env.TAGGLE_API_BASE_URL ?? "http://localhost:8000";
const TAGGLE_API_PREFIX = process.env.TAGGLE_API_PREFIX ?? "/chat2/api/v1";
const TAGGLE_ORGANIZATION = process.env.TAGGLE_ORGANIZATION ?? "TAGGLE";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/workflow": {
      async GET() {
        const file = Bun.file("data/workflow.json");
        if (!(await file.exists())) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(file, {
          headers: { "Content-Type": "application/json" },
        });
      },
      async PUT(req) {
        const body = await req.json();
        await Bun.write("data/workflow.json", JSON.stringify(body, null, 2));
        return new Response(null, { status: 204 });
      },
    },

    "/api/agents": {
      async GET(req) {
        const incoming = new URL(req.url);
        const target = new URL(`${TAGGLE_API_BASE_URL}${TAGGLE_API_PREFIX}/agents`);
        incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));
        try {
          const upstream = await fetch(target, {
            headers: { Organization: TAGGLE_ORGANIZATION },
          });
          if (!upstream.ok) {
            return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
          }
          return new Response(upstream.body, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response("Agent service unreachable", { status: 502 });
        }
      },
    },

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
