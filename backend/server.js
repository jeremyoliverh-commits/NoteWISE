const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isVercel = !!process.env.VERCEL;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from frontend (not needed on Vercel - Vercel handles it)
if (!isVercel) {
    app.use(express.static(path.join(__dirname, '..', 'frontend')));
}

// Multer config for file uploads (use memory storage on Vercel)
let upload;
if (isVercel) {
    const memoryStorage = multer.memoryStorage();
    upload = multer({ storage: memoryStorage, limits: { fileSize: 20 * 1024 * 1024 } });
} else {
    const diskStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
            cb(null, uniqueName);
        }
    });
    upload = multer({ storage: diskStorage, limits: { fileSize: 20 * 1024 * 1024 } });
}

// ====== DATA STORE (JSON-based for simplicity) ======
const DATA_FILE = isVercel
    ? path.join('/tmp', 'data.json')
    : path.join(__dirname, 'data.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = { folders: [], notes: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ====== FOLDER ROUTES ======
app.get('/api/folders', (req, res) => {
    const data = loadData();
    res.json(data.folders);
});

app.post('/api/folders', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });
    const data = loadData();
    const newFolder = { id: Date.now().toString(), name, createdAt: new Date().toISOString() };
    data.folders.push(newFolder);
    saveData(data);
    res.json(newFolder);
});

app.delete('/api/folders/:id', (req, res) => {
    const data = loadData();
    data.folders = data.folders.filter(f => f.id !== req.params.id);
    // Move notes in deleted folder to uncategorized
    data.notes.forEach(n => { if (n.folderId === req.params.id) n.folderId = null; });
    saveData(data);
    res.json({ success: true });
});

// ====== NOTE ROUTES ======
app.get('/api/notes', (req, res) => {
    const data = loadData();
    res.json(data.notes);
});

app.post('/api/notes', upload.single('file'), (req, res) => {
    const { title, content, source, sourceType, folderId, language } = req.body;
    const data = loadData();
    const newNote = {
        id: Date.now().toString(),
        title: title || 'Untitled Note',
        content: content || '',
        source: source || '',
        sourceType: sourceType || 'text',
        folderId: folderId || null,
        language: language || 'en',
        summary: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    data.notes.push(newNote);
    saveData(data);
    res.json(newNote);
});

app.put('/api/notes/:id', (req, res) => {
    const data = loadData();
    const idx = data.notes.findIndex(n => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Note not found' });
    const { title, content, folderId, summary, language } = req.body;
    if (title !== undefined) data.notes[idx].title = title;
    if (content !== undefined) data.notes[idx].content = content;
    if (folderId !== undefined) data.notes[idx].folderId = folderId;
    if (summary !== undefined) data.notes[idx].summary = summary;
    if (language !== undefined) data.notes[idx].language = language;
    data.notes[idx].updatedAt = new Date().toISOString();
    saveData(data);
    res.json(data.notes[idx]);
});

app.delete('/api/notes/:id', (req, res) => {
    const data = loadData();
    data.notes = data.notes.filter(n => n.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
});

// ====== AI ROUTES (Uses Google Gemini API) ======
const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in backend/.env file.');
    }
    return new GoogleGenerativeAI(apiKey);
}

const GEMINI_MODEL = 'gemini-1.5-flash';

async function generateGeminiContent(prompt, systemInstruction, options = {}) {
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL,
        systemInstruction: systemInstruction
    });
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: options.maxTokens || 1000,
            temperature: options.temperature ?? 0.5,
        },
    });
    return result.response.text();
}

// Summarize notes
app.post('/api/ai/summarize', async (req, res) => {
    try {
        const { content, language = 'en' } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const langMap = { en: 'English', id: 'Indonesian', zh: 'Chinese' };
        const targetLang = langMap[language] || 'English';

        const systemInstruction = `You are an expert note summarizer. Summarize the following notes in ${targetLang}. 
            Provide:
            1. A brief overview (2-3 sentences)
            2. Key points (bullet points, organized)
            3. Simplified explanation
            
            Make it easy to understand. Use clear language and organize it well.`;

        const summary = await generateGeminiContent(content, systemInstruction, { maxTokens: 1000, temperature: 0.5 });
        res.json({ summary });
    } catch (error) {
        console.error('Summarize error:', error.message);
        res.status(500).json({ error: 'AI service error: ' + error.message });
    }
});

// Chat with AI about notes
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, noteContext, language = 'en' } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const langMap = { en: 'English', id: 'Indonesian', zh: 'Chinese' };
        const targetLang = langMap[language] || 'English';

        const systemInstruction = noteContext 
            ? `You are an AI study assistant. Answer questions about the following notes in ${targetLang}. 
               Use the notes as context to provide accurate answers. If the question is not related to the notes, 
               you can still answer generally but mention that it's not from the notes.
               
               Notes context:
               ${noteContext.substring(0, 4000)}`
            : `You are an AI study assistant. Answer questions in ${targetLang} to help with studying and understanding concepts.`;

        const reply = await generateGeminiContent(message, systemInstruction, { maxTokens: 800, temperature: 0.7 });
        res.json({ reply });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: 'AI service error: ' + error.message });
    }
});

// Translate notes
app.post('/api/ai/translate', async (req, res) => {
    try {
        const { content, targetLanguage = 'en' } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const langMap = { en: 'English', id: 'Indonesian', zh: 'Chinese' };
        const targetLang = langMap[targetLanguage] || 'English';

        const systemInstruction = `You are a translator. Translate the following text to ${targetLang}. 
            Maintain the original formatting, structure, and tone. Only respond with the translated text.`;

        const translated = await generateGeminiContent(content, systemInstruction, { maxTokens: 2000, temperature: 0.3 });
        res.json({ translated });
    } catch (error) {
        console.error('Translate error:', error.message);
        res.status(500).json({ error: 'AI service error: ' + error.message });
    }
});

// Extract content from URL
app.post('/api/ai/extract-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const systemInstruction = `You are a web content extractor. Given a URL, identify what kind of content it likely contains 
            based on the URL pattern (YouTube video, Google Doc, Canva presentation, article, etc.) 
            and provide a simulated extraction of what the content might be about. 
            Format the response as a JSON with: title, sourceType, extractedContent.`;

        const resultText = await generateGeminiContent(
            `Extract and summarize content from this URL: ${url}`, 
            systemInstruction, 
            { maxTokens: 1000, temperature: 0.5 }
        );
        
        // Try to parse the response as JSON
        let result;
        try {
            result = JSON.parse(resultText);
        } catch {
            // If not valid JSON, wrap the text
            result = { title: 'URL Extraction', sourceType: 'url', extractedContent: resultText };
        }
        res.json(result);
    } catch (error) {
        console.error('Extract URL error:', error.message);
        res.status(500).json({ error: 'AI service error: ' + error.message });
    }
});

// Start server (only when run directly, not when imported as module for Vercel)
if (require.main === module || process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Note Summarizer server running on http://localhost:${PORT}`);
        console.log(`Open your browser at http://localhost:${PORT}`);
    });
}

module.exports = app;
