import express from 'express';

let mongoURI = "mongodb+srv://admin:admin123@cluster0.gsp1kmw.mongodb.net/?appName=Cluster0";

const mongoose = require('mongoose');
mongoose.connect(mongoURI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('Connected successfully');
});


const app = express();

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});