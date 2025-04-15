import { useEffect, useState } from "react";

type Subscriber = {
  Name: string;
  EmailAddress: string;
};

export default function Home() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const getStatusColor = () => {
    if (status.includes("All data up to date")) return "green";
    if (status.includes("Syncing")) return "blue";
    if (status.includes("may still be syncing")) return "orange";
    return "#777";
  };
  
  const loadAndSetSubscribers = async () => {
    const res = await fetch("/api/subscribers");
    const data = await res.json();
    setSubscribers(data.Results || []);
  };

  const loadSubscribers = async (): Promise<Subscriber[]> => {
    const res = await fetch("/api/subscribers");
    const data = await res.json();
    return data.Results || [];
  };

  const pollUntilSynced = async (expected: Subscriber[]) => {
    setStatus("Syncing data in the background... You can keep using the app.");

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // 12 seconds between each background refresh
      await new Promise((resolve) => setTimeout(resolve, 12000));
      const liveData = await loadSubscribers();

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

      attempts++;
    }

    setStatus("Some data may still be syncing... ");
  };

  const addSubscriber = async () => {
    if (!name || !email) return;
  
    const optimisticList = [...subscribers, { Name: name, EmailAddress: email }];
    setSubscribers(optimisticList);
  
    setName("");
    setEmail("");
  
    await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
  
    // Polling in background until API data matches UI data.
    pollUntilSynced(optimisticList);
  };
  

  const deleteSubscriber = async (emailToRemove: string) => {
    setLoading(true);

    // Remove now, sync later
    const optimisticList = subscribers.filter((s) => s.EmailAddress !== emailToRemove);
    setSubscribers(optimisticList);

    await fetch(`/api/subscribers?email=${encodeURIComponent(emailToRemove)}`, {
      method: "DELETE",
    });

    // Poll (in background)  until data matches or max tries reached again
    await pollUntilSynced(optimisticList);
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
