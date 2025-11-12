"use client";

import { useMemo, useState } from "react";

type ResultFile = {
  Type?: string;
  Url?: string;
};

type ApiResponse = {
  upstreamStatus?: number;
  response?: {
    Response?: {
      JobId?: string;
      Status?: string;
      ResultFile3Ds?: ResultFile[];
      Error?: {
        Code?: string;
        Message?: string;
      };
    };
  };
  error?: string;
};

export default function TencentHunyuanTestPage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);

  const hasCredentialsError = useMemo(
    () =>
      lastResponse?.error?.toLowerCase().includes("credentials") ||
      lastResponse?.error?.toLowerCase().includes("secret"),
    [lastResponse]
  );

  const submitJob = async () => {
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }

    setSubmitLoading(true);
    setError(null);
    setStatus("");
    setResultFiles([]);
    setLastResponse(null);

    try {
      const payload: Record<string, string> = {
        prompt: prompt.trim(),
      };

      if (imageUrl.trim()) {
        payload.imageUrl = imageUrl.trim();
      }

      const response = await fetch("/api/tencent/hunyuan3d/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;
      setLastResponse(data);

      if (!response.ok) {
        const upstreamError =
          data.error ||
          data.response?.Response?.Error?.Message ||
          "Failed to submit job.";
        setError(upstreamError);
        return;
      }

      const upstreamJobId = data.response?.Response?.JobId;

      if (upstreamJobId) {
        setJobId(upstreamJobId);
      } else {
        setError(
          "No JobId returned from Tencent. Check response details below."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error during submission."
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const queryJob = async () => {
    if (!jobId.trim()) {
      setError("Job ID is required to query status.");
      return;
    }

    setQueryLoading(true);
    setError(null);
    setLastResponse(null);

    try {
      const response = await fetch("/api/tencent/hunyuan3d/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: jobId.trim() }),
      });

      const data = (await response.json()) as ApiResponse;
      setLastResponse(data);

      if (!response.ok) {
        const upstreamError =
          data.error ||
          data.response?.Response?.Error?.Message ||
          "Failed to query job.";
        setError(upstreamError);
        return;
      }

      const responseData = data.response?.Response;
      setStatus(responseData?.Status ?? "");
      setResultFiles(responseData?.ResultFile3Ds ?? []);

      if (responseData?.JobId) {
        setJobId(responseData.JobId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected error during query."
      );
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4">
        <header className="rounded-lg bg-white p-6 shadow">
          <h1 className="text-3xl font-bold text-slate-900">
            Tencent Hunyuan 3D Pro — Test Console
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Submit prompts for 3D generation and poll job status using your
            Tencent Cloud credentials. Requests are proxied through Next.js API
            routes so your keys stay on the server.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6 rounded-lg bg-white p-6 shadow">
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-slate-700"
              >
                Prompt *
              </label>
              <textarea
                id="prompt"
                className="mt-2 h-32 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="A red sports car with glossy paint"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="imageUrl"
                className="block text-sm font-medium text-slate-700"
              >
                Reference Image URL (optional)
              </label>
              <input
                id="imageUrl"
                type="url"
                className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/reference.jpg"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={submitJob}
              disabled={submitLoading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLoading ? "Submitting…" : "Submit 3D Job"}
            </button>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Setup Checklist</p>
              <ul className="mt-2 space-y-1">
                <li>
                  • Set `TENCENT_SECRET_ID` and `TENCENT_SECRET_KEY` in `.env`
                </li>
                <li>
                  • Ensure the account has `QcloudAI3DFullAccess` permissions
                </li>
                <li>• Respect the concurrency limit (max 3 active jobs)</li>
                <li>• Poll every 5–10 seconds until status becomes `DONE`</li>
              </ul>
            </div>
          </div>

          <div className="space-y-6 rounded-lg bg-white p-6 shadow">
            <div>
              <label
                htmlFor="jobId"
                className="block text-sm font-medium text-slate-700"
              >
                Job ID
              </label>
              <input
                id="jobId"
                className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Job ID will appear after submission"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={queryJob}
              disabled={queryLoading || !jobId}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {queryLoading ? "Checking…" : "Check Job Status"}
            </button>

            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Job Status
                </p>
                <p className="mt-2 text-xl font-bold text-slate-900">
                  {status || "—"}
                </p>
                {status === "DONE" && resultFiles.length > 0 && (
                  <ul className="mt-4 space-y-2 text-sm text-blue-600">
                    {resultFiles.map((file, index) => (
                      <li key={`${file.Url ?? "result"}-${index}`}>
                        <a
                          href={file.Url}
                          className="underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {file.Type ?? "File"} #{index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">Error</p>
                  <p className="mt-1">{error}</p>
                  {hasCredentialsError && (
                    <p className="mt-2 text-xs">
                      Double-check that Tencent Cloud credentials are configured
                      on the server and the process has access to them.
                    </p>
                  )}
                </div>
              )}

              {lastResponse && (
                <details className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                    Raw Response
                  </summary>
                  <pre className="mt-3 max-h-64 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </section>

        <footer className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-slate-900">Polling Tips</h2>
          <p className="mt-2 text-sm text-slate-600">
            Tencent suggests checking every 5–10 seconds. Status values
            indicate:{" "}
            <span className="font-semibold text-emerald-600">DONE</span> when
            the model is ready,{" "}
            <span className="font-semibold text-amber-600">WAIT</span> or{" "}
            <span className="font-semibold text-amber-600">RUN</span> for
            in-progress jobs, and{" "}
            <span className="font-semibold text-rose-600">FAIL</span> for failed
            attempts (check `ErrorCode` / `ErrorMessage` in the response).
          </p>
        </footer>
      </div>
    </div>
  );
}
