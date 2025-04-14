import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const API_KEY = process.env.CM_API_KEY;
  const LIST_ID = process.env.CM_LIST_ID;

  // Endpoint for ADD and REMOVE only
  const baseURL = `https://api.createsend.com/api/v3.3/subscribers/${LIST_ID}.json`;

  // Auth (basic) using the API key as username and 'x' as password
  const headers = {
    Authorization: "Basic " + Buffer.from(`${API_KEY}:x`).toString("base64"),
    "Content-Type": "application/json",
  };

  if (req.method === "GET") {

    // Disabling caching (server side)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    // Use the 'active subscribers' endpoint from CM to get all subs
    const r = await fetch(`https://api.createsend.com/api/v3.3/lists/${LIST_ID}/active.json`, 
    {
      headers,
      // Disabling cache so data updates dynamically
      cache: "no-store",
    });
    const data = await r.json();
    return res.status(200).json(data);
  }
  

  if (req.method === "POST") {
    // Get creds from input
    const { name, email } = req.body;
    const r = await fetch(baseURL, {
      method: "POST",
      headers,
      // Send the actual creds to the server (string format) and not JS code
      body: JSON.stringify({
        EmailAddress: email,
        Name: name,
        // User can be added again after deletion
        Resubscribe: true,
        // Without this requests do not work
        ConsentToTrack: "Yes",
      }),
    });
    return res.status(200).json(await r.json());
  }

  if (req.method === "DELETE") {
    // Get the email from the query (in string format)
    const email = encodeURIComponent(req.query.email as string);
    const r = await fetch(`${baseURL}?email=${email}`, { method: "DELETE", headers });
    return res.status(r.status).end();
  }

}
