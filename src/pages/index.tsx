import { useEffect, useState, useRef } from "react";

type Subscriber = {
  Name: string;
  EmailAddress: string;
};

export default function Home() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  // For Polling
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expectedRef = useRef<Subscriber[]>([]);
  const attemptRef = useRef(0);

  const maxAttempts = 20;

  const statusColorClass = (): string => {
    if (status.includes("All data up to date")) return "text-green-600";
    if (status.includes("Syncing")) return "text-blue-600";
    if (status.includes("may still be syncing")) return "text-orange-500";
    return "text-gray-600";
  };

  // First page load GETS all subs and UPDATES the UI
  const loadAndSetSubscribers = async () => {
    const res = await fetch("/api/subscribers");
    const data = await res.json();
    setSubscribers(data.Results || []);
  };

  // GETS subs but DOES NOT update the UI (used for comparing when polling)
  const loadSubscribers = async (): Promise<Subscriber[]> => {
    const res = await fetch("/api/subscribers");
    const data = await res.json();
    return data.Results || [];
  };

  // Polling to check if UI subs list matches APIs GET subs list results (max attempts)
  const startPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
    }

    attemptRef.current = 0;

    const poll = async () => {
      attemptRef.current++;
      setStatus(`Syncing data in the background... You can keep using the service. Try ${attemptRef.current}/${maxAttempts}`);

      const liveData = await loadSubscribers();
      const expected = expectedRef.current;

      const allMatch = expected.every((s) =>
        liveData.find(
          (r: Subscriber) => r.EmailAddress === s.EmailAddress && r.Name === s.Name
        )
      );

      const sameLength = liveData.length === expected.length;

      if (allMatch && sameLength) {
        setStatus("All data up to date");
        return;
      }

      if (attemptRef.current >= maxAttempts) {
        setStatus("Some data may still be syncing... ");
        return;
      }

      pollingRef.current = setTimeout(poll, 12000);
    };

    poll();
  };

  const addSubscriber = async () => {
    if (!name || !email) return;

    const existing = subscribers.find((s) => s.EmailAddress === email);

    // Email and name already exist -> do nothing
    if (existing && existing.Name === name) {
      alert("Subscriber already exists.");
      return;
    }

    // Same email, different name —> popup confirmation
    if (existing && existing.Name !== name) {
      const confirmReplace = window.confirm(
        `This email already exists with a different name ("${existing.Name}"). Replace it with "${name}"?`
      );
      if (!confirmReplace) return;
    }

    // Update UI with new sub
    const optimisticList = [
      ...subscribers.filter((s) => s.EmailAddress !== email),
      { Name: name, EmailAddress: email },
    ];
    setSubscribers(optimisticList);
    expectedRef.current = optimisticList;

    setName("");
    setEmail("");

    await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    startPolling();
  };

  const deleteSubscriber = async (emailToRemove: string) => {
    // Remove now, sync later
    const optimisticList = subscribers.filter((s) => s.EmailAddress !== emailToRemove);
    setSubscribers(optimisticList);
    expectedRef.current = optimisticList;

    // Try to delete sub from the API list even if the sub is already deleted
    const res = await fetch(`/api/subscribers?email=${encodeURIComponent(emailToRemove)}`, {
      method: "DELETE",
    });

    // If sub is already deleted
    if (!res.ok) {
      setStatus(`Tried to remove ${emailToRemove}, but it may already be deleted.`);
    }

    startPolling();
  };

  useEffect(() => {
    loadAndSetSubscribers();
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-2xl font-bold text-center mb-6">Mailing List</h1>

      <div className={`text-sm mb-4 ${statusColorClass()}`}>
        {status}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: "40px",
          padding: "40px",
          flexWrap: "wrap",
        }}
      >
        {/* Left: Form */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "20px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            minWidth: "250px",
          }}
        >
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px" }}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "8px" }}
          />
          <button
            onClick={addSubscriber}
            style={{
              backgroundColor: "green",
              color: "white",
              padding: "8px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Add
          </button>
        </div>

        {/* Right: Table */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            flex: 1,
          }}
        >
          <h2 style={{ marginBottom: "16px" }}>Current Subscribers</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ textAlign: "left", padding: "8px" }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s, index) => (
                <tr
                  key={s.EmailAddress}
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9f9f9",
                  }}
                >
                  <td style={{ padding: "8px" }}>{s.Name}</td>
                  <td style={{ padding: "8px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{s.EmailAddress}</span>
                      <button
                        onClick={() => deleteSubscriber(s.EmailAddress)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          backgroundColor: "transparent",
                          color: "red",
                          border: "1px solid red",
                          cursor: "pointer",
                          marginLeft: "20px",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
