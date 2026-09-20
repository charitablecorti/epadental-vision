// netlify/functions/synthesize.js
//
// Questa funzione gira sul server di Netlify, non nel browser della persona
// che usa VisionBOT. Il suo unico compito è:
//   1) ricevere dal sito (index.html) il "system prompt" e il testo scritto dall'utente,
//   2) chiamare lei stessa, in modo sicuro, l'API di Anthropic usando la chiave segreta
//      salvata come variabile d'ambiente ANTHROPIC_API_KEY (mai scritta nel codice,
//      mai visibile a chi visita il sito),
//   3) restituire la risposta al sito, che la mostra all'utente.
//
// In questo modo la chiave API non è mai esposta pubblicamente e chi usa VisionBOT
// non ha bisogno di un account Claude.

exports.handler = async (event) => {
  // Il sito chiama questa funzione solo con richieste POST.
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Metodo non consentito" })
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Questo succede solo se qualcuno dimentica di impostare la chiave su Netlify
    // (Site settings → Environment variables → ANTHROPIC_API_KEY).
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chiave API non configurata sul server" })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Corpo della richiesta non valido" })
    };
  }

  const { system, messages } = payload;
  if (!system || !messages) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Richiesta incompleta: mancano system o messages" })
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: system,
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Errore da Anthropic:", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Errore nella chiamata al modello", details: data })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error("Errore imprevisto nella funzione synthesize:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore imprevisto del server" })
    };
  }
};
