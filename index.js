import express from 'express';

let mongoURI = "mongodb+srv://admin:admin123@cluster0.gsp1kmw.mongodb.net/?appName=Cluster0";

const app = express();

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});