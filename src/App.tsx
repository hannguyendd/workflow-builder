import { Provider } from "react-redux";
import { store } from "@/store";
import { WorkflowBuilderPage } from "@/features/workflow";
import "./index.css";

export function App() {
  return (
    <Provider store={store}>
      <WorkflowBuilderPage />
    </Provider>
  );
}

export default App;
