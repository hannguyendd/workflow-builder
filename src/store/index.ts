import { configureStore } from "@reduxjs/toolkit";
import workflowReducer from "@/features/workflow/workflowSlice";
import themeReducer from "@/features/theme/themeSlice";

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
    theme: themeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
