import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import Groq from "groq-sdk";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new Groq({
    apiKey: "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"
});

app.post("/classify", async (req, res) => {
    const { task } = req.body;
    try {
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "user",
                    content: `Classify this task as GOOD or BAD and give a short quote.
Task: "${task}"
Respond strictly in JSON: {"type":"good|bad", "quote":"..."}`
                }
            ]
        });

        const text = completion.choices[0].message.content.trim();

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            // fallback if model adds extra text
            result = { type: "good", quote: text };
        }

        res.json(result);

    } catch (err) {
        console.error("Groq Error:", err);
        res.status(500).json({ error: "Groq server error" });
    }
});

app.listen(4000, () => console.log("Groq AI Server running on port 4000"));
