const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8281";

const App = (): JSX.Element => {
  return (
    <main className="app-shell">
      <h1>qualitycat academy</h1>
      <p>React + Vite + TypeScript is running.</p>
      <p>
        API URL: <code>{apiUrl}</code>
      </p>
    </main>
  );
};

export default App;
