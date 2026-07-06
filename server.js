const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// MONGODB CONNECTION
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://yadavjinit08_db_user:aV8xYK4BSf95EZTG@cluster0.db92m3x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, '❌ Connection error:'));
db.once('open', () => console.log('✅ Connected to MongoDB Atlas!'));

// ============================================================
// SCHEMAS
// ============================================================

// 1. Planner Schema
const plannerSchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    ticks: { type: Object, required: true },
    history: { type: Object, default: {} },
    snapshots: { type: Array, default: [] },
    lastUpdated: { type: Date, default: Date.now }
});

// 2. Mistake Schema
const mistakeSchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correct: { type: String, required: true },
    userAnswer: { type: String, required: true },
    subject: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    reason: { type: String, enum: ['Concept Error', 'Calculation Error', 'Guess', 'Silly Mistake', 'Time Pressure'], required: true },
    aiFeedback: { type: String, default: '' },
    memoryTrick: { type: String, default: '' },
    isRevised: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    revisedAt: { type: Date },
    revisionCount: { type: Number, default: 0 }
});

// 3. Tracker Schema - ADDED userId
const trackerSchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    progress: { type: Object, default: {} },
    today: { type: Object, default: {} },
    streak: { type: Object, default: { lastDate: null, streak: 0 } },
    lastUpdated: { type: Date, default: Date.now }
});

// 4. Syllabus Schemas - ADDED userId
const syllabusTopicSchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    moduleTitle: { type: String, required: true },
    topicTitle: { type: String, required: true },
    checked: { type: Boolean, default: false },
    isDA: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
});

const syllabusAddedTopicSchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    moduleTitle: { type: String, required: true },
    title: { type: String, required: true },
    isDA: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const syllabusModuleSchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    moduleTitle: { type: String, required: true },
    topics: { type: [String], default: [] },
    isDA: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Planner = mongoose.model('Planner', plannerSchema);
const Mistake = mongoose.model('Mistake', mistakeSchema);
const Tracker = mongoose.model('Tracker', trackerSchema);
const SyllabusTopic = mongoose.model('SyllabusTopic', syllabusTopicSchema);
const SyllabusAddedTopic = mongoose.model('SyllabusAddedTopic', syllabusAddedTopicSchema);
const SyllabusModule = mongoose.model('SyllabusModule', syllabusModuleSchema);

// ============================================================
// ROUTES - PLANNER (Already uses userId correctly)
// ============================================================

// GET planner data
app.get('/api/planner/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        let data = await Planner.findOne({ userId });
        if (!data) {
            data = new Planner({ 
                userId,
                ticks: {},
                history: {},
                snapshots: []
            });
            await data.save();
        }
        res.json(data);
    } catch (error) {
        console.error('GET Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST/UPDATE planner data
app.post('/api/planner/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        const { ticks, history, snapshots } = req.body;
        const updated = await Planner.findOneAndUpdate(
            { userId },
            { 
                ticks: ticks || {},
                history: history || {},
                snapshots: snapshots || [],
                lastUpdated: new Date() 
            },
            { upsert: true, new: true }
        );
        res.json(updated);
    } catch (error) {
        console.error('POST Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Reset all ticks
app.delete('/api/planner/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        const updated = await Planner.findOneAndUpdate(
            { userId },
            { 
                ticks: {},
                history: {},
                snapshots: [],
                lastUpdated: new Date() 
            },
            { new: true }
        );
        res.json(updated);
    } catch (error) {
        console.error('DELETE Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTES - MISTAKES (Added userId support)
// ============================================================

// GET all mistakes for a user
app.get('/api/mistakes/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        const mistakes = await Mistake.find({ userId }).sort({ createdAt: -1 });
        res.json(mistakes);
    } catch (error) {
        console.error('GET Mistakes Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET a single mistake
app.get('/api/mistakes/:id', async (req, res) => {
    try {
        const mistake = await Mistake.findById(req.params.id);
        if (!mistake) {
            return res.status(404).json({ error: 'Mistake not found' });
        }
        res.json(mistake);
    } catch (error) {
        console.error('GET Mistake Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ADD a new mistake
app.post('/api/mistakes', async (req, res) => {
    try {
        const mistakeData = req.body;
        if (!mistakeData.userId) {
            mistakeData.userId = 'default_user';
        }
        const mistake = new Mistake(mistakeData);
        await mistake.save();
        res.status(201).json(mistake);
    } catch (error) {
        console.error('POST Mistake Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE a mistake
app.put('/api/mistakes/:id', async (req, res) => {
    try {
        const mistake = await Mistake.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!mistake) {
            return res.status(404).json({ error: 'Mistake not found' });
        }
        res.json(mistake);
    } catch (error) {
        console.error('PUT Mistake Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE a mistake
app.delete('/api/mistakes/:id', async (req, res) => {
    try {
        const mistake = await Mistake.findByIdAndDelete(req.params.id);
        if (!mistake) {
            return res.status(404).json({ error: 'Mistake not found' });
        }
        res.json({ message: 'Mistake deleted successfully' });
    } catch (error) {
        console.error('DELETE Mistake Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// MARK as revised
app.patch('/api/mistakes/:id/revision', async (req, res) => {
    try {
        const mistake = await Mistake.findByIdAndUpdate(
            req.params.id,
            { 
                isRevised: true, 
                revisedAt: new Date(),
                $inc: { revisionCount: 1 }
            },
            { new: true }
        );
        if (!mistake) {
            return res.status(404).json({ error: 'Mistake not found' });
        }
        res.json(mistake);
    } catch (error) {
        console.error('PATCH Mistake Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET analytics for mistakes
app.get('/api/mistakes/analytics/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        const mistakes = await Mistake.find({ userId });
        
        const analytics = {
            total: mistakes.length,
            bySubject: {},
            byReason: {},
            byDifficulty: { Easy: 0, Medium: 0, Hard: 0 },
            revised: mistakes.filter(m => m.isRevised).length,
            pending: mistakes.filter(m => !m.isRevised).length
        };
        
        mistakes.forEach(m => {
            analytics.bySubject[m.subject] = (analytics.bySubject[m.subject] || 0) + 1;
            analytics.byReason[m.reason] = (analytics.byReason[m.reason] || 0) + 1;
            analytics.byDifficulty[m.difficulty] = (analytics.byDifficulty[m.difficulty] || 0) + 1;
        });
        
        res.json(analytics);
    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTES - TRACKER (FIXED - NOW USES userId)
// ============================================================

// GET tracker data
app.get('/api/tracker/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        let data = await Tracker.findOne({ userId });
        if (!data) {
            data = new Tracker({
                userId,
                progress: {},
                today: {},
                streak: { lastDate: null, streak: 0 }
            });
            await data.save();
        }
        res.json(data);
    } catch (error) {
        console.error('GET Tracker Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST/UPDATE tracker data
app.post('/api/tracker/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        const { progress, today, streak } = req.body;
        
        let tracker = await Tracker.findOne({ userId });
        if (!tracker) {
            tracker = new Tracker({ 
                userId,
                progress: progress || {},
                today: today || {},
                streak: streak || { lastDate: null, streak: 0 }
            });
        } else {
            if (progress) tracker.progress = progress;
            if (today) tracker.today = today;
            if (streak) tracker.streak = streak;
            tracker.lastUpdated = new Date();
        }
        
        await tracker.save();
        res.json(tracker);
    } catch (error) {
        console.error('POST Tracker Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Reset all tracker progress
app.delete('/api/tracker/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        let tracker = await Tracker.findOne({ userId });
        if (!tracker) {
            tracker = new Tracker({
                userId,
                progress: {},
                today: {},
                streak: { lastDate: null, streak: 0 }
            });
        } else {
            tracker.progress = {};
            tracker.today = {};
            tracker.streak = { lastDate: null, streak: 0 };
            tracker.lastUpdated = new Date();
        }
        await tracker.save();
        res.json(tracker);
    } catch (error) {
        console.error('DELETE Tracker Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTES - SYLLABUS (FIXED - NOW USES userId)
// ============================================================

// GET all syllabus state
app.get('/api/syllabus/state', async (req, res) => {
    try {
        const userId = req.query.userId || 'default_user';
        const topicStates = await SyllabusTopic.find({ userId });
        const addedTopics = await SyllabusAddedTopic.find({ userId });
        return res.json({ topicStates, addedTopics });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// POST - Save topic checkbox state
app.post('/api/syllabus/topic/check', async (req, res) => {
    try {
        const { moduleTitle, topicTitle, checked, userId, isDA } = req.body;
        const uid = userId || 'default_user';
        if (!moduleTitle || !topicTitle) {
            return res.status(400).json({ error: 'moduleTitle and topicTitle required' });
        }
        
        await SyllabusTopic.findOneAndUpdate(
            { userId: uid, moduleTitle, topicTitle },
            { checked: !!checked, isDA: !!isDA, updatedAt: new Date() },
            { upsert: true }
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// POST - Add new topic
app.post('/api/syllabus/module/add-topic', async (req, res) => {
    try {
        const { moduleTitle, title, userId, isDA } = req.body;
        const uid = userId || 'default_user';
        if (!moduleTitle || !title) {
            return res.status(400).json({ error: 'moduleTitle and title required' });
        }
        
        const newTopic = new SyllabusAddedTopic({ 
            userId: uid, 
            moduleTitle, 
            title,
            isDA: !!isDA 
        });
        await newTopic.save();
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// GET custom modules
app.get('/api/syllabus/modules', async (req, res) => {
    try {
        const userId = req.query.userId || 'default_user';
        const modules = await SyllabusModule.find({ userId });
        return res.json(modules);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// POST - Add a new custom module
app.post('/api/syllabus/modules/add', async (req, res) => {
    try {
        const { moduleTitle, topics, userId, isDA } = req.body;
        const uid = userId || 'default_user';
        if (!moduleTitle) {
            return res.status(400).json({ error: 'moduleTitle is required' });
        }
        
        // Check if module already exists for this user
        const existing = await SyllabusModule.findOne({ userId: uid, moduleTitle });
        if (existing) {
            return res.status(400).json({ error: 'Module already exists' });
        }
        
        const newModule = new SyllabusModule({
            userId: uid,
            moduleTitle,
            topics: topics || [],
            isDA: !!isDA
        });
        await newModule.save();
        return res.json({ ok: true, module: newModule });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// POST - Add topic to a custom module
app.post('/api/syllabus/modules/:moduleTitle/topic', async (req, res) => {
    try {
        const { moduleTitle } = req.params;
        const { topic, userId } = req.body;
        const uid = userId || 'default_user';
        
        if (!topic) {
            return res.status(400).json({ error: 'topic is required' });
        }
        
        const module = await SyllabusModule.findOne({ userId: uid, moduleTitle });
        if (!module) {
            return res.status(404).json({ error: 'Module not found' });
        }
        
        if (module.topics.includes(topic)) {
            return res.status(400).json({ error: 'Topic already exists in this module' });
        }
        
        module.topics.push(topic);
        await module.save();
        return res.json({ ok: true, module });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// DELETE - Remove a custom module
app.delete('/api/syllabus/modules/:moduleTitle', async (req, res) => {
    try {
        const { moduleTitle } = req.params;
        const userId = req.query.userId || 'default_user';
        const result = await SyllabusModule.findOneAndDelete({ userId, moduleTitle });
        if (!result) {
            return res.status(404).json({ error: 'Module not found' });
        }
        return res.json({ ok: true, message: 'Module deleted' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// DELETE - Reset all syllabus topics
app.delete('/api/syllabus/reset', async (req, res) => {
    try {
        const userId = req.query.userId || 'default_user';
        await SyllabusTopic.deleteMany({ userId });
        await SyllabusAddedTopic.deleteMany({ userId });
        await SyllabusModule.deleteMany({ userId });
        return res.json({ ok: true, message: 'All syllabus data reset' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        routes: ['/api/planner/:userId?', '/api/tracker/:userId?', '/api/mistakes/:userId?', '/api/syllabus']
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 GATE Planner API is running!',
        endpoints: {
            health: '/api/health',
            planner: {
                get: '/api/planner/:userId?',
                post: '/api/planner/:userId?',
                delete: '/api/planner/:userId?'
            },
            mistakes: {
                get: '/api/mistakes/:userId?',
                post: '/api/mistakes',
                getOne: '/api/mistakes/:id',
                put: '/api/mistakes/:id',
                delete: '/api/mistakes/:id',
                revision: '/api/mistakes/:id/revision',
                analytics: '/api/mistakes/analytics/:userId?'
            },
            tracker: {
                get: '/api/tracker/:userId?',
                post: '/api/tracker/:userId?',
                delete: '/api/tracker/:userId?'
            },
            syllabus: {
                state: '/api/syllabus/state?userId=...',
                topicCheck: '/api/syllabus/topic/check',
                addTopic: '/api/syllabus/module/add-topic',
                modules: '/api/syllabus/modules?userId=...',
                addModule: '/api/syllabus/modules/add',
                deleteModule: '/api/syllabus/modules/:moduleTitle?userId=...',
                reset: '/api/syllabus/reset?userId=...'
            }
        }
    });
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.url}`,
        availableRoutes: ['/api/planner/:userId?', '/api/tracker/:userId?', '/api/mistakes/:userId?', '/api/syllabus/state', '/api/health']
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📍 Planner: http://localhost:${PORT}/api/planner/{userId}`);
    console.log(`📍 Tracker: http://localhost:${PORT}/api/tracker/{userId}`);
    console.log(`📍 Mistakes: http://localhost:${PORT}/api/mistakes/{userId}`);
    console.log(`📍 Syllabus: http://localhost:${PORT}/api/syllabus/state?userId={userId}`);
});
