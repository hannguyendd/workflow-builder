import { configureStore } from "@reduxjs/toolkit";
import workflowReducer from "@/features/workflow/workflowSlice";
import themeReducer from "@/features/theme/themeSlice";
import agentsReducer from "@/features/workflow/agents/agentsSlice";

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
    theme: themeReducer,
    agents: agentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
