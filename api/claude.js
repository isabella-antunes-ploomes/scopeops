import { verifyAuth } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  try {
    const { system, userText, kbItems, fileParts, model, maxTokens } = req.body;
    if (!userText) return res.status(400).json({ error: "userText obrigatório." });

    const content = [];

    if (kbItems) {
      for (const item of kbItems) {
        if (item && item.type === "pdf") {
          content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: item.data } });
        }
      }
    }

    if (fileParts) {
      for (const p of fileParts) {
        if (p.pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdf.data } });
      }
    }

    const textFiles = (fileParts || []).filter(p => p.text).map(p => p.text).join("\n\n");
    const kbTexts = (kbItems || []).filter(i => i && i.type === "text").map((i, x) =>
      "[BASE" + ((kbItems || []).length > 1 ? " " + (x + 1) : "") + "]\n" + i.content + "\n[FIM]"
    ).join("\n\n");

    content.push({ type: "text", text: userText + (textFiles ? "\n\n" + textFiles : "") + (kbTexts ? "\n\n" + kbTexts : "") });

    const body = {
      model: model || "claude-sonnet-4-20250514",
      max_tokens: maxTokens || 8000,
      system: system || "",
      messages: [{ role: "user", content }]
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) return res.status(response.status).json({ error: data.error.message });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    res.json({ text });
  } catch (e) {
    console.error("[claude proxy]", e);
    res.status(500).json({ error: "Erro ao chamar Claude: " + e.message });
  }
}
