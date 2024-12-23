const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');

const app = express();
let db = null;
let cache = null;

app.use(express.json());

const initMysql = async () => {
    db = await mysql.createConnection({
        host: "localhost",
        port: 3307,
        user: "root",
        password: "password",
        database: "std02",
    });
};

const initRedis = async () => {
    cache = redis.createClient({
        url: "redis://localhost:6379",
        legacyMode: true,
    });
    cache.on('error', (err) => console.error('Redis Client Error', err));
    await cache.connect();
};

app.get('/users', async (req, res) => {
    try {
        const cacheData = await cache.get('users');
        if (cacheData) {
            const fetchUser = JSON.parse(cacheData);
            return res.json({ message: 'hello cache', fetchUser });
        }
        const [fetchUser] = await db.execute('SELECT * FROM users');
        await cache.set('users', JSON.stringify(fetchUser));
        res.json(fetchUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

app.post('/add-user', async (req, res) => {
    const {name,age,description} = req.body;
    try {
        const [results] = await db.execute('INSERT INTO users (name,age,description) VALUES( ?, ?, ? )',[name,age,description]);
        const [newUser] = await db.execute('SELECT * FROM users WHERE id = ?', [results.insertId]);

        const cacheData = await cache.get('users');
        let updatedUsers = [];
        if (cacheData) {
            updatedUsers = JSON.parse(cacheData);
        }
        updatedUsers.push(newUser[0]);
        await cache.set('users', JSON.stringify(updatedUsers));

        res.status(201).json({ message: 'User added successfully', user: newUser[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding user' });
    }
});

app.listen(8000, async () => {
    await initMysql();
    await initRedis();
    console.log('Server running on port 8000');
});