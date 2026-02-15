import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/http";
import { InternalBugsResponse } from "../lib/types";

type BugsPageProps = {
  token: string | null;
};

const BugsPage = ({ token }: BugsPageProps): JSX.Element => {
  const bugsQuery = useQuery({
    queryKey: ["internal", "bugs", token],
    queryFn: ({ signal }) =>
      apiRequest<InternalBugsResponse>("/internal/bugs", {
        token,
        signal,
      }),
    enabled: Boolean(token),
  });

  if (!token) {
    return (
      <section className="panel">
        <h1>Bugs</h1>
        <p className="error">Authentication required (mentor/admin only).</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Bugs</h1>
      {bugsQuery.isPending ? <p>Loading internal bug flags...</p> : null}
      {bugsQuery.error ? <p className="error">Cannot load bug flags.</p> : null}

      {bugsQuery.data ? (
        <>
          <p>Backend mode: {bugsQuery.data.data.backendBugs ? "ON" : "OFF"}</p>
          <p>Frontend mode: {bugsQuery.data.data.frontendBugs ? "ON" : "OFF"}</p>
          <pre className="debug-json">{JSON.stringify(bugsQuery.data.data.flags, null, 2)}</pre>
        </>
      ) : null}
    </section>
  );
};

export default BugsPage;
