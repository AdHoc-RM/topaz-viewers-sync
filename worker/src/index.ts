import { handleExport } from "./export";
import { handleRegister } from "./register";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/r") {
      return handleRegister(request, env);
    }
    if (request.method === "GET" && pathname === "/export") {
      return handleExport(request, env);
    }
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
