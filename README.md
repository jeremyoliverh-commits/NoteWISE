# 🌿 NoteWise AI - Smart Note Summarizer

An intelligent web application that helps you organize, summarize, and understand your notes using AI.

## ✨ Features

- **📤 Multi-Source Upload** - Upload notes from YouTube, Google Drive, Canva, files, or direct text
- **📁 Folder Organization** - Create folders to keep your notes organized
- **🤖 AI Summarization** - Automatically summarize notes for better understanding
- **💬 AI Chat** - Built-in AI tutor to answer questions about your notes
- **🌍 Language Translation** - Translate notes between English, Indonesian, and Chinese
- **🎨 Beautiful UI** - Soft green pastel theme with creative decorations

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure OpenAI API Key

Copy `.env.example` to `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-actual-key-here
```

> Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 3. Start the Server

```bash
npm start
```

The app will be available at **http://localhost:3001**

## 🎯 Usage

1. **Add Notes** - Click "Add Notes" and paste a link, type text, or upload a file
2. **Organize** - Create folders and drag notes into them
3. **Summarize** - Open any note and click "Summarize" for AI-powered simplification
4. **Chat** - Use the AI tutor on the right panel to ask questions
5. **Translate** - Change the language of your notes with one click

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **AI**: OpenAI GPT-3.5 Turbo
- **Storage**: JSON file-based

## 📁 Project Structure

```
note-summarizer/
├── frontend/          # Static website files
│   ├── index.html     # Main HTML
│   ├── css/style.css  # Styles
│   └── js/app.js      # Frontend logic
├── backend/           # Node.js server
│   ├── server.js      # Express server & API routes
│   ├── package.json   # Dependencies
│   └── .env           # Environment variables
└── README.md
```
