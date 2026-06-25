import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { AgentConfig } from "@/types/agent";
import { listAgents } from "@/services/agents";

export interface AgentsState {
  byId: Record<string, AgentConfig>;
  ids: string[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const initialState: AgentsState = { byId: {}, ids: [], status: "idle", error: null };

/** Fetch the agent list into the cache. Dispatched once on page mount. */
export const loadAgents = createAsyncThunk("agents/load", () => listAgents());

const slice = createSlice({
  name: "agents",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadAgents.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadAgents.fulfilled, (state, action) => {
        state.byId = {};
        state.ids = [];
        for (const agent of action.payload) {
          state.byId[agent.id] = agent;
          state.ids.push(agent.id);
        }
        state.status = "ready";
      })
      .addCase(loadAgents.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Failed to load agents";
      });
  },
});

export default slice.reducer;
