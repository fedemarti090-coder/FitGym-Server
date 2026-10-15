const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "qwen/qwen3.8-27b";
const PROMPT =
  'Sei un nutrizionista esperto. Analizza la foto del pasto, stima gli ingredienti visibili, il nome del piatto e calcola i macronutrienti totali. Restituisci l\'output ESCLUSIVAMENTE in formato JSON valido con questa struttura esatta: {"dish_name": "string", "calories": number, "protein": number, "carbs": number, "fat": number}';
const EXPECTED_KEYS = ["dish_name", "calories", "protein", "carbs", "fat"];

async function main(imageUrl) {
  const startedAt = Date.now();
  let stage = "configurazione";
  const log = (message) =>
    console.log(
      `[${new Date().toISOString()}] [${Date.now() - startedAt}ms] ${message}`,
    );

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY non configurata nelle variabili d'ambiente");
    }
    if (typeof imageUrl !== "string" || imageUrl.length === 0) {
      throw new Error("URL dell'immagine non valido");
    }
    log("Avvio analisi immagine con Groq");

    stage = "download immagine";
    log("Download immagine in corso");
    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    log(`Risposta download immagine: HTTP ${imageResponse.status}`);
    if (!imageResponse.ok) {
      throw new Error(`Download immagine fallito: HTTP ${imageResponse.status}`);
    }

    const mimeType = imageResponse.headers
      .get("content-type")
      ?.split(";")[0]
      .trim();
    if (!mimeType?.startsWith("image/")) {
      throw new Error(`Tipo di contenuto immagine non valido: ${mimeType}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBuffer.length === 0) {
      throw new Error("L'immagine scaricata è vuota");
    }
    log(`Immagine ricevuta: ${mimeType}, ${imageBuffer.length} byte`);

    stage = "richiesta Groq";
    log(`Invio richiesta di analisi al modello ${MODEL}`);
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const responseBody = await groqResponse.text();
    log(`Risposta API Groq: HTTP ${groqResponse.status}`);
    if (!groqResponse.ok) {
      throw new Error(
        `Richiesta Groq fallita (HTTP ${groqResponse.status}): ${responseBody}`,
      );
    }

    stage = "lettura risposta Groq";
    let completion;
    try {
      completion = JSON.parse(responseBody);
    } catch (error) {
      throw new Error(`Risposta API Groq non è JSON valido: ${error.message}`);
    }

    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("Groq ha restituito una risposta senza contenuto");
    }

    stage = "validazione risposta";
    let result;
    try {
      result = JSON.parse(content);
    } catch (error) {
      throw new Error(`La risposta di Groq non contiene JSON valido: ${error.message}`);
    }
    if (
      !result ||
      typeof result.dish_name !== "string" ||
      EXPECTED_KEYS
        .filter((key) => key !== "dish_name")
        .some(
          (key) =>
            typeof result[key] !== "number" || !Number.isFinite(result[key]),
        )
    ) {
      throw new Error("Groq ha restituito un JSON con una struttura non valida");
    }

    log("Analisi completata");
    return Object.fromEntries(EXPECTED_KEYS.map((key) => [key, result[key]]));
  } catch (error) {
    error.message = `Errore durante la fase "${stage}": ${error.message}`;
    throw error;
  }
}

module.exports = { main };

if (require.main === module) {
  main("https://images.unsplash.com/photo-1546069901-ba9599a7e63c")
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
