import { serve } from "bun";
import index from "./index.html";
import { AGENT_FIXTURES } from "./services/agentFixtures";

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

    // Dummy agent list for offline development. The Taggle backend isn't wired
    // up here, so we serve fixtures (see src/services/agentFixtures.ts) shaped
    // like the real `PagingResponse<AgentConfigResponse>`. Swap back to live
    // forwarding (fetch the chat service with an `Organization` header) once the
    // backend is reachable — see docs/superpowers/plans/2026-06-17-workflow-agent-node.md.
    "/api/agents": {
      GET() {
        return Response.json({
          items: AGENT_FIXTURES,
          currentPage: 1,
          pageSize: AGENT_FIXTURES.length,
          totalItems: AGENT_FIXTURES.length,
        });
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
