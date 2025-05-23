import React from "react";
import { useEffect, useState, useRef } from "react";

// Mail category checker
const GENERIC_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com',
  'yahoo.com', 'icloud.com', 'protonmail.com',
  'aol.com',
];

function classifyEmail(address: string) {
  const domain = address.split('@')[1]?.toLowerCase() || '';
  return GENERIC_DOMAINS.includes(domain) ? 'generic' : 'work/personal';
}

type Subscriber = {
  Name: string;
  EmailAddress: string;
};

export default function Home() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  // GA trackers
  const typingStartRef = useRef<number | null>(null);
  const fieldErrorRef  = useRef<boolean>(false)

  // For Typing Abortion check
  const hasStartedTypingRef = useRef<boolean>(false);
  const formSubmittedRef = useRef<boolean>(false);

  // For Polling
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expectedRef = useRef<Subscriber[]>([]);
  const attemptRef = useRef(0);

  const maxAttempts = 20;

  // Helper for GA error tracking
  function trackApiError(message: string, action: 'add' | 'remove') {
    if (window.gtag) {
      window.gtag('event', 'cm_error', {
        error_response: message,
        action,
      });
    }
  }  

  const statusColorStyle = (): React.CSSProperties => {
    if (status.includes("All data up to date")) return { color: "#00a106" };
    if (status.includes("Syncing")) return { color: "#387db2" };
    if (status.includes("may still be syncing")) return { color: "orange" };
    return { color: "gray" };
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
      setStatus(`Syncing... You can keep using the service. Try ${attemptRef.current}/${maxAttempts}`);

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
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Basic validation
    if (!trimmedName || !trimmedEmail) {
      alert("Both name and email are required.");
      fieldErrorRef.current = true;
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      alert("Please enter a valid email address.");
      fieldErrorRef.current = true;
      return;
    }

    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(trimmedName)) {
      alert("Name can only contain letters, spaces, hyphens (-), and apostrophes (').");
      fieldErrorRef.current = true;
      return;
    }

    if (trimmedName.length > 50) {
      alert("Name is too long (max 50 characters).");
      fieldErrorRef.current = true;
      return;
    }

    const existing = subscribers.find((s) => s.EmailAddress === trimmedEmail);

    // Email and name already exist → do nothing
    if (existing && existing.Name === trimmedName) {
      alert("Subscriber already exists.");
      fieldErrorRef.current = true;
      return;
    }

    // Same email, different name → confirm replace
    if (existing && existing.Name !== trimmedName) {
      const confirmReplace = window.confirm(
        `This email already exists with a different name ("${existing.Name}"). Replace it with "${trimmedName}"?`
      );
      if (!confirmReplace) {
        fieldErrorRef.current = true;
        return;
      }
    }

    // Update UI with new sub
    const optimisticList = [
      // Copy subs to new array (...) (after deleting the email match)
      ...subscribers.filter((s) => s.EmailAddress !== trimmedEmail),
      // Add new sub
      { Name: trimmedName, EmailAddress: trimmedEmail },
    ];

    setSubscribers(optimisticList);
    expectedRef.current = optimisticList;

    formSubmittedRef.current = true;

    setName("");
    setEmail("");

    // POST with GA error response tracker
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });
    
      if (!res.ok) {
        const text = await res.text();
        trackApiError(text || `HTTP ${res.status}`, "add");
      }
    } catch (err) {
      trackApiError((err as Error).message, "add");
    }
   
    // GA event tracker
    if (window.gtag) {
      const timeToClick = typingStartRef.current
        ? (performance.now() - typingStartRef.current) / 1000
        : null;
    
      window.gtag('event', 'click_add_subscriber', {
        time_needed: timeToClick,
        email_type: classifyEmail(trimmedEmail),
        error: fieldErrorRef.current
      });
    }
    // Reset
    typingStartRef.current = null;
    fieldErrorRef.current  = false;

    startPolling();
  };


  const deleteSubscriber = async (emailToRemove: string) => {

    // GA helpers
    // Get row position before deleting it
    const totalSubs = subscribers.length;
    const index = subscribers.findIndex(
      (s) => s.EmailAddress === emailToRemove
    );

    const position = `${index + 1}/${totalSubs}`;
    const emailType = classifyEmail(emailToRemove);

    // Send event to GA
    if (window.gtag) {
      window.gtag('event', 'click_remove_subscriber', {
        position: position,
        email_type: emailType,
      });
    }

    // Remove now, sync later
    const optimisticList = subscribers.filter((s) => s.EmailAddress !== emailToRemove);
    setSubscribers(optimisticList);
    expectedRef.current = optimisticList;

    // DELETE with GA error response tracker
    let res;
    try {
      res = await fetch(`/api/subscribers?email=${encodeURIComponent(emailToRemove)}`, {
        method: "DELETE",
      });
    } catch (err) {
      setStatus(`Error while removing: ${(err as Error).message}`);
      trackApiError((err as Error).message, "remove");
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      setStatus(`Tried to remove ${emailToRemove}, but it may already be deleted.`);
      trackApiError(text || `HTTP ${res.status}`, "remove");
      return;
    }

    startPolling();
  };


  // When the page first loads
  useEffect(() => {
    loadAndSetSubscribers();
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
  }, []);

  // Send GA error log (typing time) if user Typed but did not Add
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasStartedTypingRef.current && !formSubmittedRef.current) {
        if (window.gtag) {
          window.gtag('event', 'form_abandonment', {
            time_spent_typing: typingStartRef.current
              ? (performance.now() - typingStartRef.current) / 1000
              : null,
          });
        }
      }
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  

  useEffect(() => {
    if (window.gtag) {
      window.gtag('set', 'user_properties', {
        subscriber_count: subscribers.length,
      });
    }
  }, [subscribers.length]); // Call when the list length changes ( gets ALSO called on first page load [not correct behaviour])

  return (
    //BG
    <div
      style={{
        background: "linear-gradient(135deg, #f7f7f7, #ffffff)",
        minHeight: "100vh",
      }}
    >

      {/* Main Container */}
      <div style={{ maxWidth: "1500px", width: "100%", margin: "0 auto" }}>

        <div>
          <h1
            style={{
              textAlign: "center",
              width: "100%",
              fontSize: "20px",
              color: "#303030",
              marginTop: "0px",
              paddingTop: "40px",
              opacity: 0.4,
            }}
          >
            Margera&apos;s Mailing List
          </h1>
          
          {/* 2 Box Container */}
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
                onChange={(e) => {
                  if (typingStartRef.current === null) typingStartRef.current = performance.now();
                  if (!hasStartedTypingRef.current) hasStartedTypingRef.current = true;
                  setName(e.target.value);
                }}                
                style={{ borderRadius: "6px", padding: "8px", border: "1px solid  #ececec " }}
              />
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  if (typingStartRef.current === null) typingStartRef.current = performance.now();
                  if (!hasStartedTypingRef.current) hasStartedTypingRef.current = true;
                  setEmail(e.target.value);
                }}
                style={{ borderRadius: "6px", padding: "8px", border: "1px solid  #ececec " }}
              />
              <button
                onClick={addSubscriber}
                style={{
                  backgroundColor: "#40b238",
                  color: "white",
                  padding: "10px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Add
              </button>
            </div>

            {/* Right: Table Box*/}
            <div
              style={{
                backgroundColor: "#fff",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                flex: 1,
              }}
            >
              {/* Table Title and Info Message Bar */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px"
              }}>
                <h2 style={{ margin: 0, color: "#303030" }}>Current Subscribers</h2>
                <span style={{ fontStyle: "italic", fontWeight: "200", ...statusColorStyle() }}>
                  {status}
                </span>
              </div>

              {/* Table Box */}
              <div
                style={{
                  borderRadius: "8px",
                  overflow: "hidden",
                  boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(to bottom, #d5d5d5, #e1e1e1)" }}>
                      <th style={{ textAlign: "left", padding: "8px", color: "#303030" }}>Name</th>
                      <th style={{ textAlign: "left", padding: "8px", color: "#303030" }}>Email</th>
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
                        <td style={{ padding: "8px", }}>{s.Name}</td>
                        
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
        </div>
      </div>
    </div>
  );
}
