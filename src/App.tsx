import { Provider } from "react-redux";
import { store } from "@/store";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
import { WorkflowBuilderPage } from "@/features/workflow";
import "./index.css";

function AppShell() {
  useApplyTheme();
  return <WorkflowBuilderPage />;
}

export function App() {
  return (
    <Provider store={store}>
      <AppShell />
    </Provider>
  );
}

export default App;
