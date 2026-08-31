# NoorAI

> **Your AI-powered study and revision companion.**
>
> Turn lengthy study material into **short notes, structured summaries, flowcharts, visual explanations, and AI-generated audio narration** — making revision faster, easier, and more effective.

## 📚 About NoorAI

**NoorAI** is an AI-powered learning and revision platform designed to help students transform lengthy and difficult study material into **simple, structured, and revision-friendly content**.

Studying from large PDFs, textbooks, lecture notes, and other learning materials can be time-consuming. Students often spend more time **organizing and understanding their material** than actually revising it. NoorAI addresses this problem by transforming uploaded study material into multiple learning formats that make important concepts easier to understand, remember, and revise.

Instead of repeatedly going through dozens or hundreds of pages, NoorAI helps students create a **compact revision environment** from their existing study material.

### 🎯 The core idea

**Upload your study material → Understand it → Condense it → Visualize it → Listen to it → Revise it**

NoorAI can transform study material into:

* 📝 **Short Notes** — concise, exam-oriented summaries of important concepts
* 📌 **Key Points** — important facts, definitions, concepts, and takeaways
* 🔄 **Flowcharts** — visualize processes, sequences, and relationships between concepts
* 🧠 **AI Explanations** — simplify complex topics into easier-to-understand explanations
* 🎧 **Audio Narration** — listen to your study material instead of reading everything
* 📚 **Structured Revision Material** — organize large documents into manageable sections
* 🔎 **Context-aware Information Retrieval** — retrieve relevant information from uploaded documents
* 📊 **Visual Learning Aids** — make complicated information easier to comprehend
* 🔁 **Revision Support** — revisit important concepts without repeatedly reading the original material

The goal is not simply to summarize a document.

The goal is to **turn passive reading into an efficient revision experience**.

---

## 💡 Why NoorAI?

Traditional revision often looks like this:

```text
Large PDF / Textbook
        ↓
Read Everything
        ↓
Find Important Information
        ↓
Make Notes
        ↓
Organize Notes
        ↓
Create Diagrams
        ↓
Revise
        ↓
Forget Something
        ↓
Go Back to the Original Material
        ↓
Repeat
```

This process is repetitive and time-consuming.

NoorAI aims to simplify this workflow:

```text
                 ┌──────────────────┐
                 │  Study Material  │
                 │   PDF / Notes    │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │      NoorAI      │
                 │   AI Processing  │
                 └────────┬─────────┘
                          ↓
       ┌──────────────────┼──────────────────┐
       ↓                  ↓                  ↓
 ┌───────────┐      ┌───────────┐      ┌───────────┐
 │ Short     │      │ Flowcharts│      │ Key Points│
 │ Notes     │      │ & Visuals │      │ & Concepts│
 └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ↓
                 ┌──────────────────┐
                 │  Easy Revision   │
                 │  & Understanding │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ Better Learning  │
                 │   Experience     │
                 └──────────────────┘
```

This allows students to spend less time **searching, organizing, and condensing information** and more time **understanding and revising it**.

---

## ✨ Key Features

### 📝 Short Notes

Long chapters and documents are transformed into concise notes containing the most important information.

Instead of revisiting an entire chapter, students can quickly review the essential concepts.

Short notes are particularly useful for:

* Last-minute revision
* Exam preparation
* Quick topic review
* Revisiting previously studied material
* Identifying the most important concepts in a chapter

---

### 🔄 Flowcharts

Some concepts are easier to understand visually than through paragraphs of text.

NoorAI can convert suitable topics and processes into structured **flowcharts**, helping students understand:

* Processes
* Sequences
* Decision paths
* Cause-and-effect relationships
* Step-by-step procedures
* Concept relationships

This makes complicated topics easier to visualize and recall.

---

### 🧠 Simplified AI Explanations

Academic material can often be unnecessarily complicated.

NoorAI uses AI to explain concepts in a simpler and more accessible way while maintaining the context of the original study material.

The objective is to answer the question:

> **"How can this topic be explained so that I can understand it quickly?"**

This is especially useful when the original material contains:

* Complex terminology
* Long explanations
* Dense paragraphs
* Technical concepts
* Difficult-to-follow descriptions

---

### 📌 Key Points & Important Concepts

Instead of manually identifying what matters in a chapter, NoorAI can highlight the important information.

This can include:

* Definitions
* Important facts
* Core concepts
* Formulas
* Processes
* Important relationships
* Exam-relevant information
* Major takeaways

The result is a much more focused revision experience.

---

### 🎧 AI Audio Narration

NoorAI can convert generated study content into audio narration.

This allows students to revise while:

* Walking
* Travelling
* Taking a break from the screen
* Doing routine activities
* Reviewing material away from their desk

Audio narration provides another way of consuming the same study material without having to continuously read from a screen.

---

### 📚 Document-Based Learning

NoorAI is designed around the student's own study material.

Students can upload documents such as:

* Lecture notes
* Study PDFs
* Course material
* Textbooks
* Reference documents
* Academic notes

The system processes the uploaded material and uses it as the foundation for generating revision content.

This helps keep generated information **relevant to the student's actual source material**.

---

### 🔎 Intelligent Retrieval

NoorAI uses a retrieval-based architecture to find relevant information from uploaded documents.

Large documents are processed into smaller chunks and indexed so that relevant information can be retrieved when generating summaries, explanations, and other learning content.

This allows the AI system to work with significantly larger study materials while maintaining contextual relevance.

---

## 🏗️ How NoorAI Works

At a high level, the platform follows this workflow:

```text
User Uploads Study Material
            ↓
       Document Processing
            ↓
        Text Extraction
            ↓
        Text Chunking
            ↓
      Vector Embeddings
            ↓
       FAISS Indexing
            ↓
      Relevant Retrieval
            ↓
        Groq LLM
            ↓
   ┌────────┼───────────┐
   ↓        ↓           ↓
Notes   Flowcharts   Explanations
   │        │           │
   └────────┼───────────┘
            ↓
      Revision Workspace
            ↓
       Audio Narration
```

The architecture combines **document processing, retrieval-augmented generation, large language models, text-to-speech, and a modern web interface** to create a unified study environment.

---

## 🧩 Technology Stack

| Layer               | Technology             |
| ------------------- | ---------------------- |
| Frontend            | React.js               |
| Build Tool          | Vite                   |
| Styling             | Tailwind CSS           |
| Backend             | FastAPI                |
| Communication       | REST APIs + WebSockets |
| Speech Recognition  | faster-whisper         |
| LLM                 | Groq                   |
| Text-to-Speech      | ElevenLabs             |
| TTS Fallback        | Google TTS / Edge-TTS  |
| Vector Search       | FAISS                  |
| Database            | PostgreSQL             |
| Database Hosting    | Neon                   |
| Frontend Deployment | Vercel                 |
| Backend Deployment  | Render                 |

---

## 🚀 What Makes NoorAI Different?

NoorAI is designed around a simple principle:

> **Revision should not require repeatedly going through the entire learning material.**

The platform combines multiple learning formats in one place.

A student can take a large document and progressively transform it into:

```text
                    Original Material
                           │
                           ↓
                    ┌─────────────┐
                    │   Summary   │
                    └──────┬──────┘
                           ↓
                 ┌───────────────────┐
                 │    Short Notes    │
                 └─────────┬─────────┘
                           ↓
             ┌─────────────┴─────────────┐
             ↓                           ↓
      ┌─────────────┐             ┌─────────────┐
      │  Flowcharts │             │ Key Concepts│
      └──────┬──────┘             └──────┬──────┘
             │                           │
             └─────────────┬─────────────┘
                           ↓
                  ┌────────────────┐
                  │   AI Explained  │
                  └───────┬────────┘
                          ↓
                  ┌────────────────┐
                  │ Audio Narration│
                  └───────┬────────┘
                          ↓
                  ┌────────────────┐
                  │    REVISION    │
                  └────────────────┘
```

This gives students **multiple ways to learn the same concept**:

**Read it → Understand it → Visualize it → Listen to it → Revise it**

---

## 🎓 Designed for Students

NoorAI is particularly useful for students who need to process large amounts of academic material within limited time.

It can be useful for:

* University students
* Competitive-exam aspirants
* Technical students
* Students preparing from PDFs and lecture notes
* Learners revising large subjects
* Anyone who wants to convert lengthy material into concise revision resources

Whether the goal is **learning a new topic or revising something already studied**, NoorAI provides a structured environment for working with study material.

---

## 🌟 The Vision

The long-term vision of NoorAI is to become an **AI-powered personal learning environment** where students do not have to manage their study material manually.

Instead of:

> **Read → Highlight → Write Notes → Draw Diagrams → Revise**

the experience becomes:

> **Upload → Understand → Organize → Visualize → Revise**

NoorAI aims to make studying **simpler, more structured, and more efficient** by allowing AI to handle the repetitive work involved in preparing revision material.

The student can then focus on what matters most:

> **Understanding the subject and remembering it.**
