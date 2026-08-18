import mongoose from "mongoose";
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import Groq from "groq-sdk";
import User from "./user.js";
import Task from "./Task.js";
import bcrypt from "bcryptjs";


// ======================================================
// APP
// ======================================================

const app = express();


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

app.use(bodyParser.json());


// ======================================================
// ENVIRONMENT VARIABLES
// ======================================================

const MONGODB_URI =
    process.env.MONGODB_URI;

const GROQ_API_KEY =
    process.env.GROQ_API_KEY;


// ======================================================
// ENVIRONMENT CHECK
// ======================================================

console.log(
    "MongoDB URI loaded:",
    MONGODB_URI ? "YES" : "NO"
);

console.log(
    "Groq API key loaded:",
    GROQ_API_KEY ? "YES" : "NO"
);

console.log(
    "Groq API key length:",
    GROQ_API_KEY?.length || 0
);


// ======================================================
// MONGODB CONNECTION
// ======================================================

let mongoConnectionPromise = null;


async function connectMongoDB() {

    if (!MONGODB_URI) {

        throw new Error(
            "MONGODB_URI environment variable is missing."
        );
    }


    // Already connected
    if (
        mongoose.connection.readyState === 1
    ) {

        return;

    }


    // Connection already in progress
    if (
        mongoConnectionPromise
    ) {

        await mongoConnectionPromise;

        return;

    }


    mongoConnectionPromise =
        mongoose.connect(
            MONGODB_URI
        );


    try {

        await mongoConnectionPromise;


        console.log(
            "MongoDB Connected Successfully"
        );

    }

    catch (error) {

        console.error(
            "MongoDB Connection Error:",
            error.message
        );


        mongoConnectionPromise =
            null;


        throw error;
    }
}


// ======================================================
// GROQ AI
// ======================================================

const client =
    GROQ_API_KEY
        ? new Groq({
            apiKey:
                GROQ_API_KEY
        })
        : null;


// Fixed model that is already working
// in your local project.
const GROQ_MODEL =
    "openai/gpt-oss-20b";


console.log(
    "Active Groq model:",
    GROQ_MODEL
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Consistency Tracker API is running",

            groq:
                !!GROQ_API_KEY,

            mongodb:
                mongoose.connection.readyState === 1

        });

    }
);


// ======================================================
// SIGNUP
// ======================================================

app.post(
    "/signup",
    async (req, res) => {

        try {

            await connectMongoDB();


            const {
                email,
                password
            } = req.body;


            // Validate input

            if (
                !email ||
                !password
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Email and password are required"

                    });

            }


            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            // Password validation

            if (
                password.length < 6
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Password must contain at least 6 characters"

                    });

            }


            // Check existing user

            const existingUser =
                await User.findOne({
                    email:
                        cleanEmail
                });


            if (existingUser) {

                return res
                    .status(400)
                    .json({

                        error:
                            "User already exists"

                    });

            }


            // Hash password

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            // Create user

            const user =
                await User.create({

                    email:
                        cleanEmail,

                    password:
                        hashedPassword

                });


            res
                .status(201)
                .json({

                    message:
                        "Account created successfully",

                    user: {

                        id:
                            user._id,

                        email:
                            user.email

                    }

                });


        }

        catch (err) {

            console.error(
                "Signup Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Server error during signup"

                });

        }

    }
);


// ======================================================
// LOGIN
// ======================================================

app.post(
    "/login",
    async (req, res) => {

        try {

            await connectMongoDB();


            const {
                email,
                password
            } = req.body;


            if (
                !email ||
                !password
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Email and password are required"

                    });

            }


            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            const user =
                await User.findOne({

                    email:
                        cleanEmail

                });


            if (!user) {

                return res
                    .status(401)
                    .json({

                        error:
                            "Invalid email or password"

                    });

            }


            const passwordMatch =
                await bcrypt.compare(

                    password,

                    user.password

                );


            if (!passwordMatch) {

                return res
                    .status(401)
                    .json({

                        error:
                            "Invalid email or password"

                    });

            }


            res.json({

                message:
                    "Login successful",

                user: {

                    id:
                        user._id,

                    email:
                        user.email

                }

            });


        }

        catch (err) {

            console.error(
                "Login Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Server error during login"

                });

        }

    }
);


// ======================================================
// CREATE TASK
// ======================================================

app.post(
    "/tasks",
    async (req, res) => {

        try {

            await connectMongoDB();


            const {
                title,
                date,
                userId
            } = req.body;


            if (
                !title ||
                !date ||
                !userId
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Title, date and userId are required"

                    });

            }


            const user =
                await User.findById(
                    userId
                );


            if (!user) {

                return res
                    .status(404)
                    .json({

                        error:
                            "User not found"

                    });

            }


            const cleanTitle =
                String(title)
                    .trim();


            if (!cleanTitle) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Task title cannot be empty"

                    });

            }


            const task =
                await Task.create({

                    title:
                        cleanTitle,

                    date:
                        date,

                    userId:
                        userId,

                    completed:
                        false

                });


            res
                .status(201)
                .json(
                    task
                );


        }

        catch (err) {

            console.error(
                "Create Task Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Server error while creating task"

                });

        }

    }
);


// ======================================================
// GET TASKS
// ======================================================

app.get(
    "/tasks/:userId",
    async (req, res) => {

        try {

            await connectMongoDB();


            const tasks =
                await Task.find({

                    userId:
                        req.params.userId

                })
                .sort({

                    createdAt:
                        -1

                });


            res.json(
                tasks
            );


        }

        catch (err) {

            console.error(
                "Get Tasks Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Server error while fetching tasks"

                });

        }

    }
);


// ======================================================
// UPDATE TASK
// ======================================================

app.patch(
    "/tasks/:id",
    async (req, res) => {

        try {

            await connectMongoDB();


            const updateData = {};


            if (
                req.body.completed !==
                undefined
            ) {

                updateData.completed =
                    Boolean(
                        req.body.completed
                    );

            }


            if (
                req.body.title !==
                undefined
            ) {

                updateData.title =
                    String(
                        req.body.title
                    ).trim();

            }


            if (
                req.body.date !==
                undefined
            ) {

                updateData.date =
                    req.body.date;

            }


            const task =
                await Task.findByIdAndUpdate(

                    req.params.id,

                    updateData,

                    {
                        new: true
                    }

                );


            if (!task) {

                return res
                    .status(404)
                    .json({

                        error:
                            "Task not found"

                    });

            }


            res.json(
                task
            );


        }

        catch (err) {

            console.error(
                "Update Task Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Server error while updating task"

                });

        }

    }
);


// ======================================================
// DELETE TASK
// ======================================================

app.delete(
    "/tasks/:id",
    async (req, res) => {

        try {

            await connectMongoDB();


            const task =
                await Task.findByIdAndDelete(
                    req.params.id
                );


            if (!task) {

                return res
                    .status(404)
                    .json({

                        error:
                            "Task not found"

                    });

            }


            res.json({

                message:
                    "Task deleted successfully"

            });


        }

        catch (err) {

            console.error(
                "Delete Task Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Server error while deleting task"

                });

        }

    }
);


// ======================================================
// GROQ AI CLASSIFICATION + SLOGAN
// ======================================================

app.post(
    "/classify",
    async (req, res) => {

        const task =
            String(
                req.body.task || ""
            ).trim();


        if (!task) {

            return res
                .status(400)
                .json({

                    error:
                        "Task is required"

                });

        }


        if (!client) {

            return res
                .status(500)
                .json({

                    error:
                        "GROQ_API_KEY is not configured"

                });

        }


        try {

            console.log(
                "Classifying task:",
                task
            );


            console.log(
                "Using Groq model:",
                GROQ_MODEL
            );


            const completion =
                await client
                    .chat
                    .completions
                    .create({

                        model:
                            GROQ_MODEL,

                        temperature:
                            0.9,

                        response_format: {

                            type:
                                "json_object"

                        },

                        messages: [

                            {

                                role:
                                    "system",

                                content: `

You are a smart habit and lifestyle coach.

Analyze the EXACT task given by the user.

Classify the task as either GOOD or BAD.

GOOD means:
- healthy
- productive
- educational
- useful
- positive
- beneficial
- self-improving

BAD means:
- harmful
- dangerous
- unhealthy
- destructive
- clearly negative

After classification, generate ONE short,
unique slogan specifically related to
the exact task.

For GOOD tasks:
Create a positive and motivating slogan
that explains the benefit.

For BAD tasks:
Create a respectful warning slogan
that explains the possible harm.

IMPORTANT:
- Generate a fresh slogan every time.
- Do NOT always return the same slogan.
- Make the slogan relevant to the exact task.
- Keep it between 10 and 25 words.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not add explanations outside JSON.

Example GOOD:

{
  "type": "good",
  "quote": "Staying hydrated keeps your body energized and your mind refreshed. Keep drinking water!"
}

Example BAD:

{
  "type": "bad",
  "quote": "Alcohol can harm your health over time. Choose habits that protect your body and future."
}

`

                            },

                            {

                                role:
                                    "user",

                                content:
                                    `Analyze this exact task:

"${task}"

Generate a NEW slogan specifically
for this task.

Return:

{"type":"good|bad","quote":"unique slogan"}`

                            }

                        ]

                    });


            const text =
                completion
                    .choices?.[0]
                    ?.message
                    ?.content
                    ?.trim();


            console.log(
                "Groq Raw Response:",
                text
            );


            if (!text) {

                return res
                    .status(500)
                    .json({

                        error:
                            "Groq returned an empty response"

                    });

            }


            let result;


            try {

                result =
                    JSON.parse(
                        text
                    );

            }

            catch (parseError) {

                console.error(
                    "Groq JSON Parse Error:",
                    parseError
                );


                return res
                    .status(500)
                    .json({

                        error:
                            "Groq returned invalid JSON"

                    });

            }


            const type =
                String(
                    result.type || ""
                )
                    .trim()
                    .toLowerCase();


            const quote =
                String(
                    result.quote || ""
                )
                    .trim();


            if (
                type !== "good" &&
                type !== "bad"
            ) {

                return res
                    .status(500)
                    .json({

                        error:
                            "Invalid task classification"

                    });

            }


            if (!quote) {

                return res
                    .status(500)
                    .json({

                        error:
                            "Groq did not generate a slogan"

                    });

            }


            console.log(
                "AI RESULT:",
                {
                    task,
                    type,
                    quote
                }
            );


            res.json({

                type,

                quote

            });


        }

        catch (err) {

            console.error(
                "Groq Error:",
                err
            );


            res
                .status(500)
                .json({

                    error:
                        "Groq server error",

                    details:
                        err?.error?.message ||
                        err?.message ||
                        "Unknown Groq error"

                });

        }

    }
);


// ======================================================
// VERCEL EXPORT
// ======================================================

export default app;