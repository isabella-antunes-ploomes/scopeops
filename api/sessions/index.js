const { supabase } = require("../_lib/supabase");
const { verifyAuth } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });
  const user = auth.user;

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_email", user.email)
        .order("started_at", { ascending: true });
      if (error) throw error;

      res.json(data.map(s => ({
        id: s.id,
        featureName: s.feature_name,
        startedAt: s.started_at,
        steps: s.steps || []
      })));

    } else if (req.method === "POST") {
      const { featureName, steps } = req.body;

      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_email: user.email, feature_name: featureName, steps: steps || [] })
        .select()
        .single();
      if (error) throw error;

      res.json({
        id: data.id,
        featureName: data.feature_name,
        startedAt: data.started_at,
        steps: data.steps || []
      });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar sessões." });
  }
};
