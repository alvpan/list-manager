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

  const getStatusColor = () => {
    if (status.includes("All data up to date")) return "green";
    if (status.includes("Syncing")) return "blue";
    if (status.includes("may still be syncing")) return "orange";
    return "#777";
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

  // Polling to check if UI subs list matches APIs GET subs list results (max 10 tries)
  const startPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
    }

    attemptRef.current = 0;

    const poll = async () => {
      attemptRef.current++;
      setStatus(`Syncing data in the background... You can keep using the service. Try ${attemptRef.current}/10`);

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

      if (attemptRef.current >= 10) {
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

    // Polling in background until API data matches UI data
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

    // Poll (in background) until data matches or max tries reached again
    startPolling();
  };

  useEffect(() => {
    loadAndSetSubscribers();
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "auto" }}>
      <h1>Mailing List</h1>

      <div style={{ margin: "1rem 0", color: getStatusColor() }}>{status}</div>

      <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={addSubscriber}>
          Add
        </button>
      </div>

      <ul>
        {subscribers.map((s) => (
          <li key={s.EmailAddress} style={{ marginBottom: "0.5rem" }}>
            {s.Name} ({s.EmailAddress}){" "}
            <button onClick={() => deleteSubscriber(s.EmailAddress)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
