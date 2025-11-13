"use client";

import { useState } from "react";

export default function EmailTestPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState("all");

  const testTypes = [
    { value: "all", label: "All Email Types" },
    { value: "simple", label: "Simple Email" },
    { value: "model-ready", label: "Model Ready for Review" },
    { value: "weekly-summary", label: "Weekly Status Summary" },
    { value: "batch-completion", label: "Batch Completion" },
    { value: "stale-models", label: "Stale Model Reminder" },
  ];

  const runTest = async () => {
    if (!email) {
      alert("Please enter an email address");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testEmail: email,
          testType: selectedTest,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results || [data]);
      } else {
        setResults([{ success: false, error: data.error }]);
      }
    } catch (error) {
      setResults([
        {
          success: false,
          error: `Network error: ${(error as Error).message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Email Service Test Page
          </h1>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Test Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="testType"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Test Type
              </label>
              <select
                id="testType"
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {testTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runTest}
              disabled={loading || !email}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Testing..." : "Run Email Test"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Test Results
              </h2>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`text-2xl mr-3 ${
                            result.success ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {result.success ? "✅" : "❌"}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {result.testType || "Test"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {result.success ? "Success" : "Failed"}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.devMode ? "Dev Mode" : "Production"}
                      </div>
                    </div>

                    {result.messageId && (
                      <div className="mt-2 text-xs text-gray-500">
                        Message ID: {result.messageId}
                      </div>
                    )}

                    {result.error && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">How to Use</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>Enter your email address above</li>
              <li>Select the type of email to test</li>
              <li>Click &ldquo;Run Email Test&rdquo;</li>
              <li>Check your email inbox for the test emails</li>
              <li>
                Make sure your Resend API key is configured for real email
                sending
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
